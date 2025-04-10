// --- START OF FILE src/query/QueryGenerator.ts ---

import {
  Expression,
  ExpressionType,
  MethodCallExpression,
  MemberExpression,
  ConstantExpression,
  LiteralExpression,
  BinaryExpression,
  NewObjectExpression,
  ParameterExpression,
  ScopeExpression,
  LambdaExpression,
} from "../expressions";
import { QueryBuilderContext } from "./generation/QueryBuilderContext";
import { SourceInfo, SelectClause, VisitFn, SqlResult } from "./generation/types";
import { escapeIdentifier, generateSqlLiteral, getTableName } from "./generation/utils/sqlUtils";

// Visitors
import { visitConstant } from "./generation/visitors/visitConstant";
import { visitMethodCall } from "./generation/visitors/visitMethodCall";
import { visitMember } from "./generation/visitors/visitMember";
import { visitLiteral } from "./generation/visitors/visitLiteral";
import { visitBinaryExpression } from "./generation/visitors/visitBinaryExpression";
// import { visitObjectExpression } from "./generation/visitors/visitObjectExpression"; // Não mais necessário aqui
import { visitParameter } from "./generation/visitors/visitParameter";
import { visitScope } from "./generation/visitors/visitScope";

export class QueryGenerator {
  constructor() {}

  public generate(expression: Expression): string {
    const context = new QueryBuilderContext(undefined, 0);
    let finalSourceInfo: SourceInfo | null = null;
    try {
      const visitResult = this.visit(expression, context);

      if (
        visitResult instanceof Object &&
        "alias" in visitResult &&
        "expression" in visitResult &&
        "isBaseTable" in visitResult
      ) {
        finalSourceInfo = visitResult as SourceInfo;
      } else {
        console.error("Final visit result was not a SourceInfo:", visitResult);
        console.error("Original Expression:", expression.toString());
        throw new Error("Internal Error: Query expression did not resolve to a valid SourceInfo object.");
      }

      if (!finalSourceInfo) {
        // Double check after casting
        throw new Error("Internal Error: finalSourceInfo is null after visit.");
      }

      return this.buildSql(finalSourceInfo, context);
    } catch (e: any) {
      console.error("Error during SQL generation:", e.message);
      if (e.stack) console.error("Stack:", e.stack);
      console.error("Expression Tree:", expression.toString());
      console.error("Context State (at error):", {
        sources: Array.from(context.sources.entries()).map(([p, s]) => ({
          param: p.name,
          alias: s.alias,
          expr: s.expression?.toString(),
          isBase: s.isBaseTable,
          projBody: s.projectionBody?.toString(),
        })),
        from: context.fromClauseParts,
        where: context.whereClauses,
        select: context.selectClauses,
        finalSourceInfo: finalSourceInfo
          ? {
              alias: finalSourceInfo.alias,
              expr: finalSourceInfo.expression.toString(),
              projBody: finalSourceInfo.projectionBody?.toString(),
            }
          : "N/A",
      });
      const error = new Error(`SQL Generation Failed: ${e.message}`);
      error.stack = e.stack;
      throw error;
    }
  }

  // visit (dispatcher) - Retorna SourceInfo | SqlResult | ParameterExpression | Expression | null
  private visit(
    expression: Expression,
    context: QueryBuilderContext
  ): SourceInfo | SqlResult | ParameterExpression | Expression | null {
    switch (expression.type) {
      case ExpressionType.Constant:
        return visitConstant(expression as ConstantExpression, context);
      case ExpressionType.Call:
        return visitMethodCall(expression as MethodCallExpression, context, this.visit.bind(this), this);
      case ExpressionType.MemberAccess:
        return visitMember(expression as MemberExpression, context, this.visit.bind(this));
      case ExpressionType.Literal:
        return visitLiteral(expression as LiteralExpression, context);
      case ExpressionType.Binary:
        return visitBinaryExpression(expression as BinaryExpression, context, this.visit.bind(this));
      case ExpressionType.NewObject:
        // Retorna a própria expressão, pois deve ser tratada no contexto da projeção (visitMember/buildSql)
        return expression as NewObjectExpression;
      case ExpressionType.Parameter:
        return visitParameter(expression as ParameterExpression, context);
      case ExpressionType.Scope:
        return visitScope(expression as ScopeExpression, context, this.visit.bind(this));
      case ExpressionType.Lambda:
        // Lambdas não são visitadas diretamente neste fluxo
        throw new Error("Internal Error: Cannot visit LambdaExpression directly.");
      // default: // Removido o default para permitir que o TypeScript cheque exaustividade dos tipos de ExpressionType se usado como enum
      //   // Correção TS2322: Atribui expression.type, não expression
      //   const exhaustiveCheck: never = expression.type;
      //   throw new Error(`Unsupported expression type: ${expression.type}`);
    }
    // Adicionado para satisfazer o compilador sobre retorno em todos os caminhos
    // Logicamente não deve ser alcançado se todos os ExpressionType forem tratados
    throw new Error(`Internal Error: Reached end of visit dispatcher unexpectedly for type: ${expression.type}`);
  }

  // buildSql - Usa o contexto (FROM/WHERE) e as selectClauses populadas por visitMethodCall
  private buildSql(finalSourceInfo: SourceInfo, context: QueryBuilderContext): string {
    const fromSql = context.fromClauseParts.join(" ");
    if (!fromSql && context.selectClauses.length === 0 && context.whereClauses.length === 0) {
      console.warn("Warning: Empty FROM, SELECT, and WHERE clauses. Returning empty SQL.");
      return "";
    }
    if (!fromSql && (context.selectClauses.length > 0 || context.whereClauses.length > 0)) {
      throw new Error("Internal Error: SELECT or WHERE clauses generated without a FROM clause.");
    }

    let selectSql: string;

    if (context.selectClauses.length > 0) {
      selectSql = context.selectClauses
        .map((c: SelectClause) => {
          // Não adiciona 'AS alias' se for uma seleção de todas as colunas sem alias específico
          if (c.sql === `${escapeIdentifier(finalSourceInfo.alias)}.*` && !c.alias) {
            return c.sql;
          }
          return c.alias ? `${c.sql} AS ${escapeIdentifier(c.alias)}` : c.sql;
        })
        .join(", ");
    } else {
      const defaultAlias = finalSourceInfo.alias;
      const escapedDefaultAlias = escapeIdentifier(defaultAlias);
      console.warn(`Warning: No explicit SELECT clause found. Defaulting to SELECT ${escapedDefaultAlias}.*`);
      selectSql = `${escapedDefaultAlias}.*`;
    }

    if (!selectSql) {
      throw new Error("Internal Error: Failed to generate SELECT clause SQL string.");
    }

    const whereSql = context.whereClauses.length > 0 ? `WHERE ${context.whereClauses.join(" AND ")}` : "";

    return `SELECT ${selectSql} FROM ${fromSql} ${whereSql}`.trim();
  }

  // visitSubquery - Mantido para lidar com subqueries em projeções
  private visitSubquery(subqueryExpr: MethodCallExpression, outerContext: QueryBuilderContext): SqlResult {
    console.log("--- Generating Subquery SQL ---");
    console.log("Subquery Expr:", subqueryExpr.toString());

    // Passa o contador de alias atual do contexto externo para o subContexto
    const subContext = new QueryBuilderContext(outerContext, outerContext.getCurrentAliasCount());
    const visitResult = this.visit(subqueryExpr, subContext);

    if (
      !(
        visitResult instanceof Object &&
        "alias" in visitResult &&
        "expression" in visitResult &&
        "isBaseTable" in visitResult
      )
    ) {
      throw new Error("Internal Error: Visiting the subquery expression did not yield a valid SourceInfo.");
    }
    const finalSubInfo = visitResult as SourceInfo;

    // --- Build subquery SELECT list ---
    const subSelectClauses: SelectClause[] = [];
    if (subContext.selectClauses.length > 0) {
      subContext.selectClauses.forEach((sc) => subSelectClauses.push(sc));
    } else {
      subSelectClauses.push({
        sql: `${escapeIdentifier(finalSubInfo.alias)}.*`,
      });
    }

    // --- Assemble subquery SQL ---
    const subFromSql = subContext.fromClauseParts.join(" ");
    const subWhereSql = subContext.whereClauses.length > 0 ? `WHERE ${subContext.whereClauses.join(" AND ")}` : "";
    if (!subFromSql) throw new Error("Subquery FROM clause was not generated.");

    // --- Build sub-select projection string ---
    let subSelectProjection: string;
    if (subSelectClauses.length === 1 && !subSelectClauses[0].alias && subSelectClauses[0].sql.endsWith(".*")) {
      // Caso especial: SELECT t0.* -> agrega o objeto t0
      subSelectProjection = escapeIdentifier(finalSubInfo.alias); // Usa só o alias para agregar o objeto todo
    } else if (subSelectClauses.length === 1 && !subSelectClauses[0].alias) {
      // Caso: SELECT t0.name -> agrega o valor da coluna
      subSelectProjection = subSelectClauses[0].sql;
    } else {
      // Caso: SELECT t0.id AS Id, t0.name AS Name -> agrega JSON
      const objectParts = subSelectClauses
        .map((sc) => {
          // Tenta extrair um nome de coluna se não houver alias explícito
          const key = sc.alias ?? this.extractColumnName(sc.sql);
          // Escapa a chave JSON
          return `'${key.replace(/'/g, "''")}', ${sc.sql}`;
        })
        .join(", ");
      subSelectProjection = `JSON_OBJECT(${objectParts})`;
    }

    // --- Final Assembly ---
    // Usar JSON_AGG (ou função similar dependendo do dialeto SQL)
    const aggregationFunction = "JSON_AGG";
    const finalSubquerySql = `(SELECT ${aggregationFunction}(${subSelectProjection}) FROM ${subFromSql} ${subWhereSql})`;

    console.log("--- Finished Subquery SQL ---");
    // Correção TS2341: Remover acesso a aliasCounter privado.
    // A passagem do contador inicial para o construtor do subContext é suficiente.
    // outerContext.aliasCounter = subContext.aliasCounter;

    return { sql: finalSubquerySql };
  }

  // extractColumnName - Helper
  private extractColumnName(sql: string): string {
    // Simplificação: Pega a última parte após '.' ou o próprio SQL se não houver '.'
    const parts = sql.split(".");
    const lastPart = parts[parts.length - 1];
    // Remove caracteres de escape comuns
    return lastPart?.replace(/[`"\[\]]/g, "") ?? "unknown_column";
  }
}
// --- END OF FILE src/query/QueryGenerator.ts ---
