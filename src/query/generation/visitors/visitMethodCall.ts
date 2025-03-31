// --- START OF FILE src/query/generation/visitors/visitMethodCall.ts ---

import {
  MethodCallExpression,
  LambdaExpression,
  Expression,
  ConstantExpression,
  ExpressionType,
  ParameterExpression,
  NewObjectExpression,
  MemberExpression,
  LiteralExpression,
  ScopeExpression, // Importar ScopeExpression
} from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
import { VisitFn, SourceInfo, SelectClause, SqlResult } from "../types";
import {
  escapeIdentifier,
  getTableName,
  generateSqlLiteral,
} from "../utils/sqlUtils";
import { QueryGenerator } from "../../QueryGenerator";

// Helper processProjection (Inalterado desde a última correção)
function processProjection(
  // ... (código completo da função processProjection) ...
  projectionBody: Expression,
  projectionParams: ReadonlyArray<ParameterExpression>,
  paramSourceInfos: ReadonlyArray<SourceInfo>,
  context: QueryBuilderContext,
  visitFn: VisitFn,
  queryGenerator: QueryGenerator
): { selectClauses: SelectClause[]; providesAll: boolean } {
  const selectClauses: SelectClause[] = [];
  let providesAll = false;

  if (projectionBody.type === ExpressionType.Parameter) {
    const paramExpr = projectionBody as ParameterExpression;
    const paramIndex = projectionParams.findIndex(
      (p) => p === paramExpr || p.name === paramExpr.name
    );
    if (paramIndex !== -1) {
      const sourceInfo = paramSourceInfos[paramIndex];
      selectClauses.push({ sql: `${escapeIdentifier(sourceInfo.alias)}.*` });
      providesAll = sourceInfo.providesAllColumns ?? sourceInfo.isBaseTable;
    } else {
      throw new Error(
        `Could not find source info for identity projection parameter '${paramExpr.name}'`
      );
    }
    return { selectClauses, providesAll };
  }

  if (projectionBody.type === ExpressionType.NewObject) {
    providesAll = false;
    const newObjectExpr = projectionBody as NewObjectExpression;
    for (const [
      propName,
      propValueExpr,
    ] of newObjectExpr.properties.entries()) {
      if (propValueExpr.type === ExpressionType.Parameter) {
        const param = propValueExpr as ParameterExpression;
        const sourceIdx = projectionParams.findIndex((p) => p === param);
        if (sourceIdx !== -1) {
          const paramSource = paramSourceInfos[sourceIdx];
          selectClauses.push({
            sql: `${escapeIdentifier(
              paramSource.alias
            )}.*` /* Sem alias aqui */,
          });
        } else {
          throw new Error(
            `Internal Error: Could not find source for parameter '${param.name}' in NewObject projection.`
          );
        }
      } else if (propValueExpr.type === ExpressionType.Call) {
        const subquerySqlResult = (queryGenerator as any).visitSubquery.call(
          queryGenerator,
          propValueExpr as MethodCallExpression,
          context
        );
        if (subquerySqlResult?.sql) {
          selectClauses.push({ sql: subquerySqlResult.sql, alias: propName });
        } else {
          throw new Error(
            `visitSubquery failed to return SQL for property '${propName}'.`
          );
        }
      } else if (propValueExpr.type === ExpressionType.MemberAccess) {
        const valueResult = visitFn(propValueExpr, context);
        if (
          valueResult &&
          typeof valueResult === "object" &&
          "sql" in valueResult
        ) {
          selectClauses.push({
            sql: (valueResult as SqlResult).sql,
            alias: propName,
          });
        } else if (
          valueResult &&
          typeof valueResult === "object" &&
          "alias" in valueResult &&
          "expression" in valueResult
        ) {
          const sourceInfoResult = valueResult as SourceInfo;
          selectClauses.push({
            sql: `${escapeIdentifier(
              sourceInfoResult.alias
            )}.*` /* Sem alias aqui */,
          });
        } else {
          console.error(
            "processProjection MemberAccess visit failed:",
            valueResult
          );
          throw new Error(
            `Could not resolve member access property '${propName}' to SQL value or Source. Expression: ${propValueExpr.toString()}`
          );
        }
      } else if (
        propValueExpr.type === ExpressionType.Literal ||
        (propValueExpr.type === ExpressionType.Constant &&
          !(propValueExpr as ConstantExpression).value?.type)
      ) {
        const literalSql = generateSqlLiteral(
          propValueExpr.type === ExpressionType.Literal
            ? (propValueExpr as LiteralExpression).value
            : (propValueExpr as ConstantExpression).value
        );
        selectClauses.push({ sql: literalSql, alias: propName });
      } else {
        const valueResult = visitFn(propValueExpr, context);
        if (
          valueResult &&
          typeof valueResult === "object" &&
          "sql" in valueResult
        ) {
          selectClauses.push({
            sql: (valueResult as SqlResult).sql,
            alias: propName,
          });
        } else {
          console.error(
            `processProjection (NewObject): Failed to get SQL for property '${propName}' value. Visit Result:`,
            valueResult,
            "Value Expr:",
            propValueExpr.toString()
          );
          throw new Error(
            `Could not resolve property '${propName}' to SQL value within NewObject projection. Expression: ${propValueExpr.toString()}`
          );
        }
      }
    }
    return { selectClauses, providesAll };
  }

  const projectionVisitResult = visitFn(projectionBody, context);
  if (
    projectionVisitResult &&
    typeof projectionVisitResult === "object" &&
    "sql" in projectionVisitResult
  ) {
    selectClauses.push({ sql: (projectionVisitResult as SqlResult).sql });
  } else if (projectionBody.type === ExpressionType.Literal) {
    selectClauses.push({
      sql: generateSqlLiteral((projectionBody as LiteralExpression).value),
    });
  } else if (
    projectionBody.type === ExpressionType.Constant &&
    !(projectionBody as ConstantExpression).value?.type
  ) {
    selectClauses.push({
      sql: generateSqlLiteral((projectionBody as ConstantExpression).value),
    });
  } else if (
    projectionVisitResult &&
    typeof projectionVisitResult === "object" &&
    "alias" in projectionVisitResult &&
    "expression" in projectionVisitResult
  ) {
    selectClauses.push({
      sql: `${escapeIdentifier((projectionVisitResult as SourceInfo).alias)}.*`,
    });
    providesAll =
      (projectionVisitResult as SourceInfo).providesAllColumns ??
      (projectionVisitResult as SourceInfo).isBaseTable;
  } else {
    console.error("Projection visit result:", projectionVisitResult);
    console.error("Original projection body:", projectionBody.toString());
    throw new Error(
      `Internal Error: Visiting the simple projection failed to generate SQL or SourceInfo. Projection: ${projectionBody?.toString()}`
    );
  }

  if (selectClauses.length === 0) {
    throw new Error(
      "Internal processing of projection resulted in zero SELECT clauses."
    );
  }
  return { selectClauses, providesAll };
}

export function visitMethodCall(
  expression: MethodCallExpression,
  context: QueryBuilderContext,
  visitFn: VisitFn,
  queryGenerator: QueryGenerator
): SourceInfo {
  const methodName = expression.methodName;
  if (!expression.source) {
    throw new Error(
      `Method call '${methodName}' requires a source expression.`
    );
  }

  let sourceVisitResult = visitFn(expression.source, context);
  if (sourceVisitResult?.type === ExpressionType.Parameter) {
    sourceVisitResult = context.getSourceInfoStrict(sourceVisitResult);
  }
  // Verifica se é um objeto SourceInfo válido
  if (
    !(
      sourceVisitResult instanceof Object &&
      "alias" in sourceVisitResult &&
      "expression" in sourceVisitResult &&
      "isBaseTable" in sourceVisitResult
    )
  ) {
    throw new Error(
      `Visiting the source expression for '${methodName}' did not yield a valid SourceInfo.`
    );
  }
  let sourceInfo = sourceVisitResult as SourceInfo;

  switch (methodName) {
    case "where": {
      // ... (código do where inalterado) ...
      if (
        expression.args.length !== 1 ||
        expression.args[0].type !== ExpressionType.Lambda
      )
        throw new Error("Invalid 'where' args.");
      const lambda = expression.args[0] as LambdaExpression;
      if (lambda.parameters.length !== 1)
        throw new Error("'where' lambda needs 1 parameter.");
      const p = lambda.parameters[0];
      context.registerParameter(p, sourceInfo);
      const predicateResult = visitFn(lambda.body, context);
      context.unregisterParameter(p);
      if (
        !(
          predicateResult &&
          typeof predicateResult === "object" &&
          "sql" in predicateResult
        )
      )
        throw new Error(
          `Failed SQL for 'where' predicate: ${lambda.body.toString()}`
        );
      context.whereClauses.push((predicateResult as SqlResult).sql);

      const whereSourceInfo: SourceInfo = {
        alias: sourceInfo.alias,
        expression: expression, // A expressão que criou esta fonte é a chamada 'where'
        isBaseTable: sourceInfo.isBaseTable, // Mantém o status da fonte original
        providesAllColumns: sourceInfo.providesAllColumns, // Mantém da fonte original
        // Copia informações de projeção se a fonte original tinha
        projectionBody: sourceInfo.projectionBody,
        projectionParameters: sourceInfo.projectionParameters,
        projectionSourceInfos: sourceInfo.projectionSourceInfos,
        parameters: [], // Para a próxima operação
      };
      return whereSourceInfo;
    }

    case "select": {
      // ... (código do select inalterado) ...
      if (
        expression.args.length !== 1 ||
        expression.args[0].type !== ExpressionType.Lambda
      )
        throw new Error("Invalid 'select' args.");
      const lambda = expression.args[0] as LambdaExpression;
      if (lambda.parameters.length !== 1)
        throw new Error("'select' lambda needs 1 parameter.");
      const p = lambda.parameters[0];

      context.registerParameter(p, sourceInfo);
      const { selectClauses, providesAll } = processProjection(
        lambda.body,
        [p],
        [sourceInfo],
        context,
        visitFn,
        queryGenerator
      );
      context.unregisterParameter(p);

      context.selectClauses = selectClauses;

      const virtualSourceInfo: SourceInfo = {
        alias: `select_${sourceInfo.alias}`,
        expression: expression,
        isBaseTable: false, // Select sempre cria fonte virtual
        providesAllColumns: providesAll,
        projectionBody: lambda.body,
        projectionParameters: [p],
        projectionSourceInfos: [sourceInfo],
        parameters: [],
      };
      return virtualSourceInfo;
    }

    case "join": {
      // ... (validações e obtenção de innerInfo inalteradas) ...
      if (
        expression.args.length !== 4 ||
        expression.args[0].type === ExpressionType.Lambda ||
        expression.args[1].type !== ExpressionType.Lambda ||
        expression.args[2].type !== ExpressionType.Lambda ||
        expression.args[3].type !== ExpressionType.Lambda
      )
        throw new Error("Invalid 'join' args.");
      const innerSourceExpr = expression.args[0] as Expression;
      const outerLambda = expression.args[1] as LambdaExpression;
      const innerLambda = expression.args[2] as LambdaExpression;
      const resultLambda = expression.args[3] as LambdaExpression;
      if (
        outerLambda.parameters.length !== 1 ||
        innerLambda.parameters.length !== 1 ||
        resultLambda.parameters.length !== 2
      )
        throw new Error("'join' lambdas param count mismatch.");

      let innerVisitResult = visitFn(innerSourceExpr, context);
      if (innerVisitResult?.type === ExpressionType.Parameter)
        innerVisitResult = context.getSourceInfoStrict(innerVisitResult);
      if (
        !(
          innerVisitResult instanceof Object &&
          "alias" in innerVisitResult &&
          "expression" in innerVisitResult &&
          "isBaseTable" in innerVisitResult
        )
      )
        throw new Error("Join inner source visit failed.");
      const innerInfo = innerVisitResult as SourceInfo;

      // ... (resolução de chaves inalterada) ...
      const outerP = outerLambda.parameters[0];
      const innerP = innerLambda.parameters[0];
      const resultOuterP = resultLambda.parameters[0];
      const resultInnerP = resultLambda.parameters[1];
      context.registerParameter(outerP, sourceInfo);
      const outerKey = visitFn(outerLambda.body, context);
      context.unregisterParameter(outerP);
      context.registerParameter(innerP, innerInfo);
      const innerKey = visitFn(innerLambda.body, context);
      context.unregisterParameter(innerP);
      if (
        !(outerKey && typeof outerKey === "object" && "sql" in outerKey) ||
        !(innerKey && typeof innerKey === "object" && "sql" in innerKey)
      )
        throw new Error("Join key SQL generation failed.");

      // --- *** CORREÇÃO: Determinação de innerTableSqlSource *** ---
      let innerTableSqlSource: string;
      let baseTableExpression: ConstantExpression | null = null;

      // 1. Tenta encontrar a expressão da tabela base subjacente, mesmo que innerInfo seja de um 'where'
      let expr: Expression | null = innerInfo.expression;
      const visited = new Set<Expression>();
      while (expr && !visited.has(expr)) {
        visited.add(expr);
        if (
          expr.type === ExpressionType.Constant &&
          (expr as ConstantExpression).value?.type === "Table"
        ) {
          baseTableExpression = expr as ConstantExpression;
          break;
        } else if (expr.type === ExpressionType.Call) {
          expr = (expr as MethodCallExpression).source;
        } else if (expr.type === ExpressionType.Scope) {
          expr = (expr as ScopeExpression).sourceExpression;
        } else {
          expr = null; // Não pode traçar mais
        }
      }

      // 2. Decide se usa nome da tabela ou subquery
      if (baseTableExpression) {
        // Se encontramos uma tabela base (direta ou via 'where'), usamos o nome da tabela.
        // A condição 'where' já foi adicionada ao context.whereClauses principal.
        const tableName = getTableName(baseTableExpression);
        if (!tableName)
          throw new Error(
            `Could not get table name from traced base expression for ${innerInfo.alias}`
          );
        innerTableSqlSource = escapeIdentifier(tableName);
        console.log(
          `JOIN inner source resolved to base table: ${tableName} (alias: ${innerInfo.alias})`
        );
      } else if (!innerInfo.isBaseTable && innerInfo.expression) {
        // Se innerInfo foi criado por select/join (é virtual e não tem base table direta)
        // precisamos gerar uma subquery.
        console.log(
          `--- Generating Subquery for INNER JOIN source: ${innerInfo.alias} ---`
        );
        const subQueryGenerator = new QueryGenerator();
        // Gera o SQL para a expressão que criou innerInfo (ex: o 'select' anterior)
        const subQuerySql = subQueryGenerator.generate(innerInfo.expression);
        if (!subQuerySql)
          throw new Error(
            `Failed to generate subquery SQL for inner join source: ${innerInfo.alias}`
          );
        innerTableSqlSource = `(${subQuerySql})`; // Envolve em parênteses
        console.log(
          `--- Finished Subquery for INNER JOIN source: ${innerInfo.alias} ---`
        );
      } else {
        // Não conseguiu determinar a fonte
        console.error("Unhandled inner join source type:", innerInfo);
        throw new Error(
          `Cannot determine SQL source for inner join table/subquery: ${innerInfo.alias}`
        );
      }
      // --- *** FIM DA CORREÇÃO *** ---

      const joinClause = `INNER JOIN ${innerTableSqlSource} AS ${escapeIdentifier(
        innerInfo.alias
      )} ON ${(outerKey as SqlResult).sql} = ${(innerKey as SqlResult).sql}`;
      context.fromClauseParts.push(joinClause);

      // ... (criação de virtualJoinSourceInfo e processProjection inalterados) ...
      const virtualJoinSourceInfo: SourceInfo = {
        alias: `join_${sourceInfo.alias}_${innerInfo.alias}`,
        expression: expression,
        isBaseTable: false,
        providesAllColumns: false,
        projectionBody: resultLambda.body,
        projectionParameters: [resultOuterP, resultInnerP],
        projectionSourceInfos: [sourceInfo, innerInfo],
        parameters: [],
      };

      context.registerParameter(resultOuterP, sourceInfo);
      context.registerParameter(resultInnerP, innerInfo);
      const { selectClauses, providesAll } = processProjection(
        resultLambda.body,
        [resultOuterP, resultInnerP],
        [sourceInfo, innerInfo],
        context,
        visitFn,
        queryGenerator
      );
      context.unregisterParameter(resultOuterP);
      context.unregisterParameter(resultInnerP);

      context.selectClauses = selectClauses;
      virtualJoinSourceInfo.providesAllColumns = providesAll;

      return virtualJoinSourceInfo;
    }
    default:
      throw new Error(`Unsupported method call: ${methodName}`);
  }
}
// --- END OF FILE src/query/generation/visitors/visitMethodCall.ts ---
