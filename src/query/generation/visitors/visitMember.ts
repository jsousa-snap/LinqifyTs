// --- START OF FILE src/query/generation/visitors/visitMember.ts ---

import {
  MemberExpression,
  Expression,
  ExpressionType,
  ParameterExpression,
  NewObjectExpression,
  MethodCallExpression,
  LambdaExpression,
  ConstantExpression,
  LiteralExpression,
} from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
import { VisitFn, SourceInfo, SqlResult } from "../types";
import { escapeIdentifier, generateSqlLiteral } from "../utils/sqlUtils";

// Retorna {sql: string} se resolvido para coluna SQL,
// ou SourceInfo se resolvido para uma fonte inteira (ex: up.user -> Users source info),
// ou Expression/SqlResult para literais/constantes, ou lança erro.
export function visitMember(
  expression: MemberExpression,
  context: QueryBuilderContext,
  visitFn: VisitFn
): SqlResult | SourceInfo | Expression {
  let currentExpr: Expression = expression;
  const members: string[] = [];

  while (currentExpr.type === ExpressionType.MemberAccess) {
    const m = currentExpr as MemberExpression;
    members.unshift(m.memberName);
    currentExpr = m.objectExpression;
  }

  if (currentExpr.type !== ExpressionType.Parameter) {
    console.error("Member access base object:", currentExpr.toString());
    throw new Error(`Member access chain must start with a ParameterExpression. Found: ${currentExpr.type}`);
  }

  let baseParam = currentExpr as ParameterExpression; // Ex: 'joinedResult' ou 'u'
  let currentSourceInfo: SourceInfo | null = context.getSourceInfoStrict(baseParam);

  for (let i = 0; i < members.length; i++) {
    const memberName = members[i]; // Ex: 'UserName' ou 'name'

    if (!currentSourceInfo) {
      throw new Error(
        `Internal Error: Lost SourceInfo while resolving member '${memberName}' for parameter '${baseParam.name}'.`
      );
    }

    // --- Navegação em Fontes Virtuais ---
    if (!currentSourceInfo.isBaseTable && currentSourceInfo.projectionBody) {
      const projectionBody = currentSourceInfo.projectionBody;
      const projectionParams: ReadonlyArray<ParameterExpression> | undefined = currentSourceInfo.projectionParameters;
      const projectionSources: ReadonlyArray<SourceInfo> | undefined = currentSourceInfo.projectionSourceInfos;

      if (!projectionParams || !projectionSources) {
        throw new Error(
          `Internal Error: Virtual source '${currentSourceInfo.alias}' is missing projection parameters or sources.`
        );
      }

      let mappedExpr: Expression | undefined; // A expressão dentro da projeção correspondente a 'memberName'

      // Caso A: Projeção é NewObjectExpression { prop: val, ... }
      if (projectionBody.type === ExpressionType.NewObject) {
        mappedExpr = (projectionBody as NewObjectExpression).properties.get(memberName);

        if (!mappedExpr) {
          console.error(`Member '${memberName}' requested from virtual source '${currentSourceInfo.alias}'.`);
          console.error(
            `Available projection properties: ${Array.from(
              (projectionBody as NewObjectExpression).properties.keys()
            ).join(", ")}`
          );
          console.error(`Projection body: ${projectionBody.toString()}`);
          throw new Error(
            `Member '${memberName}' not found in projection of virtual source '${currentSourceInfo.alias}'.`
          );
        }

        // --- Analisa a Expressão Mapeada ---

        // Subcaso A.1: Mapeado para Parâmetro (ex: { user: u })
        if (mappedExpr.type === ExpressionType.Parameter) {
          // ... (código inalterado aqui) ...
          const projectionParam = mappedExpr as ParameterExpression;
          const paramIndex: number = projectionParams.findIndex(
            (p: ParameterExpression) => p.name === projectionParam.name
          );

          if (paramIndex === -1 || paramIndex >= projectionSources.length) {
            throw new Error(
              `Internal Error: Could not link projection parameter '${projectionParam.name}' back to source in '${currentSourceInfo.alias}'.`
            );
          }

          baseParam = projectionParams[paramIndex];
          currentSourceInfo = projectionSources[paramIndex];

          if (i === members.length - 1) {
            if (!currentSourceInfo)
              throw new Error("Internal error: currentSourceInfo became null unexpectedly before return.");
            return currentSourceInfo;
          }
          continue; // Continua o loop FOR principal
        }
        // Subcaso A.2: Mapeado para MemberExpression (ex: { UserName: user.name })
        else if (mappedExpr.type === ExpressionType.MemberAccess) {
          // *** LÓGICA REFINADA: Resolve recursivamente com contexto temporário ***

          // 1. Decompõe a expressão mapeada (user.name)
          // *** CORREÇÃO TS2339: Cast mappedExpr para MemberExpression ***
          let mappedBaseExpr: Expression = (mappedExpr as MemberExpression).objectExpression;
          const mappedMembers: string[] = [(mappedExpr as MemberExpression).memberName];
          while (mappedBaseExpr.type === ExpressionType.MemberAccess) {
            // *** CORREÇÃO TS2339: Cast mappedBaseExpr para MemberExpression ***
            mappedMembers.unshift((mappedBaseExpr as MemberExpression).memberName);
            mappedBaseExpr = (mappedBaseExpr as MemberExpression).objectExpression;
          }

          if (mappedBaseExpr.type !== ExpressionType.Parameter) {
            throw new Error(
              `Mapped expression '${mappedExpr.toString()}' in virtual source does not start with a parameter.`
            );
          }
          const mappedBaseParam = mappedBaseExpr as ParameterExpression;

          // 2. Encontra a fonte original correspondente ao parâmetro base mapeado ('user')
          const paramIndex: number = projectionParams.findIndex((p) => p.name === mappedBaseParam.name);
          if (paramIndex === -1 || paramIndex >= projectionSources.length) {
            throw new Error(
              `Internal Error: Could not link base parameter '${mappedBaseParam.name}' of mapped expression back to source.`
            );
          }
          const originalSourceInfo = projectionSources[paramIndex];

          // 3. Combina os membros restantes da cadeia original com os membros da expressão mapeada
          const remainingOriginalMembers = members.slice(i + 1);
          const finalMembers = mappedMembers.concat(remainingOriginalMembers);

          // 4. Cria a nova expressão MemberExpression para resolver (ex: user.name)
          let finalExprToResolve: Expression = mappedBaseParam;
          for (const member of finalMembers) {
            finalExprToResolve = new MemberExpression(finalExprToResolve, member);
          }

          // 5. Resolve a nova expressão recursivamente com contexto temporário
          context.registerParameter(mappedBaseParam, originalSourceInfo);
          try {
            const result = visitFn(finalExprToResolve, context);
            if (result && typeof result === "object" && "sql" in result) {
              return result as SqlResult;
            }
            // Tratar outros retornos possíveis se necessário
            else if (result && typeof result === "object" && "alias" in result && "expression" in result) {
              console.warn(
                `Recursive member resolution returned SourceInfo: ${
                  (result as SourceInfo).alias
                }. Handling as unresolved.`
              );
              return finalExprToResolve; // Retorna a expressão não resolvida para SQL
            } else {
              throw new Error(`Recursive resolution of '${finalExprToResolve.toString()}' did not yield SQL.`);
            }
          } finally {
            // 6. Garante que o parâmetro temporário seja desregistrado
            context.unregisterParameter(mappedBaseParam);
          }
          // 7. Sai do loop principal FOR, pois a cadeia foi resolvida recursivamente
          break;
        }
        // Subcaso A.3: Mapeado para Literal, Constante, Binário, etc.
        else {
          // ... (código inalterado aqui) ...
          if (i === members.length - 1) {
            const visitedMappedExpr = visitFn(mappedExpr, context);
            if (visitedMappedExpr && typeof visitedMappedExpr === "object" && "sql" in visitedMappedExpr) {
              return visitedMappedExpr as SqlResult;
            } else if (mappedExpr.type === ExpressionType.Literal) {
              return {
                sql: generateSqlLiteral((mappedExpr as LiteralExpression).value),
              } as SqlResult;
            } else if (mappedExpr.type === ExpressionType.Constant && !(mappedExpr as ConstantExpression).value?.type) {
              return {
                sql: generateSqlLiteral((mappedExpr as ConstantExpression).value),
              } as SqlResult;
            } else {
              console.warn(`visitMember returning unresolved expression for mapped value: ${mappedExpr.toString()}`);
              return mappedExpr;
            }
          } else {
            throw new Error(
              `Cannot access nested member '${
                members[i + 1]
              }' on non-source mapped expression '${mappedExpr.toString()}'.`
            );
          }
          // 7. Sai do loop principal FOR, pois a cadeia foi resolvida
          break;
        }
      }
      // Caso B: Projeção é um Parameter (identidade, u => u)
      else if (projectionBody.type === ExpressionType.Parameter) {
        // ... (código inalterado aqui) ...
        const identityParam = projectionBody as ParameterExpression;
        const paramIndex: number = projectionParams.findIndex(
          (p: ParameterExpression) => p.name === identityParam.name
        );
        if (paramIndex === -1 || paramIndex >= projectionSources.length) {
          throw new Error(
            `Internal Error: Could not find source for identity projection parameter '${identityParam.name}'.`
          );
        }
        baseParam = projectionParams[paramIndex];
        currentSourceInfo = projectionSources[paramIndex];
        if (!currentSourceInfo) {
          throw new Error(
            `Internal error: SourceInfo became null after identity projection lookup for '${identityParam.name}'.`
          );
        }
        continue;
      }
      // Case C: Projection is MemberExpression (e.g., select(u => u.profile))
      else if (projectionBody.type === ExpressionType.MemberAccess) {
        // *** CORREÇÃO: Adicionado cast aqui também ***
        let baseOfProjection: Expression = (projectionBody as MemberExpression).objectExpression;
        const projectionMembers = [(projectionBody as MemberExpression).memberName];
        while (baseOfProjection.type === ExpressionType.MemberAccess) {
          // *** CORREÇÃO: Adicionado cast aqui também ***
          projectionMembers.unshift((baseOfProjection as MemberExpression).memberName);
          baseOfProjection = (baseOfProjection as MemberExpression).objectExpression;
        }

        if (baseOfProjection.type === ExpressionType.Parameter) {
          // ... (código inalterado aqui) ...
          const projectionParam = baseOfProjection as ParameterExpression;
          const paramIndex: number = projectionParams.findIndex(
            (p: ParameterExpression) => p.name === projectionParam.name
          );
          if (paramIndex === -1 || paramIndex >= projectionSources.length) {
            throw new Error(`Internal Error: Could not link projection parameter '${projectionParam.name}'...`);
          }
          baseParam = projectionParams[paramIndex];
          currentSourceInfo = projectionSources[paramIndex];
          if (!currentSourceInfo) {
            throw new Error(
              `Internal error: SourceInfo became null after member projection lookup for '${projectionParam.name}'.`
            );
          }
          members.splice(i, members.length - i, ...projectionMembers);
          i = -1;
          continue;
        } else {
          throw new Error(`Projection body MemberExpression base is not a Parameter: ${projectionBody.toString()}`);
        }
      }
      // Caso D: Outros tipos de projeção
      else {
        throw new Error(
          `Cannot access member '${memberName}' on complex projection body type '${
            projectionBody.type
          }'. Body: ${projectionBody.toString()}`
        );
      }
    }
    // --- Navegação em Tabelas Base ---
    else if (currentSourceInfo.isBaseTable) {
      // ... (código inalterado aqui) ...
      if (i === members.length - 1) {
        const finalAlias = escapeIdentifier(currentSourceInfo.alias);
        const finalMember = escapeIdentifier(memberName);
        const sql = `${finalAlias}.${finalMember}`;
        return { sql: sql };
      } else {
        throw new Error(`Cannot access nested member '${members[i + 1]}' on base table property '${memberName}'.`);
      }
    }
    // --- Erro Inesperado ---
    else {
      throw new Error(
        `Internal Error: Cannot resolve member '${memberName}'. Source '${currentSourceInfo?.alias}' is not base table and lacks projection information.`
      );
    }
  } // Fim do loop for (members)

  // Se o loop terminar (porque um 'break' foi atingido nos casos A.2 ou A.3)
  // ou se a expressão original não era um MemberExpression (members.length === 0)
  // O valor correto já deve ter sido retornado DENTRO do loop ou nos branches A.2/A.3
  // Chegar aqui indica um erro na lógica do loop ou nos retornos.
  throw new Error(`Internal Error: Reached end of visitMember unexpectedly for ${expression.toString()}.`);
}
// --- END OF FILE src/query/generation/visitors/visitMember.ts ---
