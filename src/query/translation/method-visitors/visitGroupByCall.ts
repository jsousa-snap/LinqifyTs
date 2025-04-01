// --- START OF FILE src/query/translation/method-visitors/visitGroupByCall.ts ---

// src/query/translation/method-visitors/visitGroupByCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
  ParameterExpression as LinqParameterExpression,
  NewObjectExpression as LinqNewObjectExpression,
  MemberExpression as LinqMemberExpression,
  ConstantExpression as LinqConstantExpression,
} from "../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  ColumnExpression,
  ProjectionExpression,
  SqlFunctionCallExpression,
  SqlConstantExpression,
  SqlBinaryExpression,
  SqlLikeExpression,
  SqlExpressionType,
} from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";
import { QueryExpressionVisitor } from "../QueryExpressionVisitor";
import { AliasGenerator } from "../../generation/AliasGenerator";
// *** NOVO: Importar VisitFn de types.ts ***
import { VisitFn } from "../../generation/types";

/**
 * Traduz uma chamada de método LINQ 'groupBy(keySelector, resultSelector)'.
 */
export function visitGroupByCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForOuterLambda: SqlDataSource,
  context: TranslationContext, // Contexto principal
  visitInContext: VisitFn, // <<< Usa o tipo VisitFn importado
  rootVisitor: QueryExpressionVisitor,
  aliasGenerator: AliasGenerator
): SelectExpression {
  // (Validações e lógica inicial inalterada...)
  if (
    expression.args.length !== 2 ||
    expression.args[0].type !== LinqExpressionType.Lambda ||
    expression.args[1].type !== LinqExpressionType.Lambda
  ) {
    throw new Error("Invalid arguments for 'groupBy' method call.");
  }
  const keyLambda = expression.args[0] as LinqLambdaExpression;
  const resultLambda = expression.args[1] as LinqLambdaExpression;
  if (
    keyLambda.parameters.length !== 1 ||
    resultLambda.parameters.length !== 2
  ) {
    throw new Error("Invalid parameter count for 'groupBy' lambda selectors.");
  }
  const keyEntityParam = keyLambda.parameters[0];
  const resultKeyParam = resultLambda.parameters[0];
  const resultGroupParam = resultLambda.parameters[1];
  const keyContext = context.createChildContext(
    [keyEntityParam],
    [sourceForOuterLambda]
  );
  const keySqlExpressions: SqlExpression[] = [];
  const keyMapping = new Map<string | symbol, SqlExpression>();
  const keyBody = keyLambda.body;
  if (keyBody.type === LinqExpressionType.NewObject) {
    const newObjectKey = keyBody as LinqNewObjectExpression;
    for (const [propName, propExpr] of newObjectKey.properties.entries()) {
      const keyPartSql = visitInContext(propExpr, keyContext);
      if (
        !keyPartSql ||
        !(
          keyPartSql instanceof ColumnExpression ||
          keyPartSql instanceof SqlConstantExpression ||
          keyPartSql instanceof SqlFunctionCallExpression
        )
      ) {
        throw new Error(
          `Could not translate or unsupported key part '${propName}' in groupBy.`
        );
      }
      keySqlExpressions.push(keyPartSql);
      keyMapping.set(propName, keyPartSql);
    }
  } else {
    const keyPartSql = visitInContext(keyBody, keyContext);
    if (
      !keyPartSql ||
      !(
        keyPartSql instanceof ColumnExpression ||
        keyPartSql instanceof SqlConstantExpression ||
        keyPartSql instanceof SqlFunctionCallExpression
      )
    ) {
      throw new Error(
        `Could not translate or unsupported simple key in groupBy.`
      );
    }
    keySqlExpressions.push(keyPartSql);
    keyMapping.set(resultKeyParam.name, keyPartSql);
  }
  if (keySqlExpressions.length === 0) {
    throw new Error("groupBy resulted in zero key expressions.");
  }
  const resultContext = context.createChildContext([], []);
  const keyPlaceholderSource = {
    isGroupKeyPlaceholder: true,
    keySqlMapping: keyMapping,
    getSqlForKeyAccess(memberName?: string): SqlExpression | undefined {
      if (this.keySqlMapping.size === 1 && !memberName) {
        return this.keySqlMapping.values().next().value;
      }
      if (memberName && this.keySqlMapping.has(memberName)) {
        return this.keySqlMapping.get(memberName);
      }
      return undefined;
    },
  };
  resultContext.registerParameter(resultKeyParam, keyPlaceholderSource as any);
  const groupPlaceholderSource = {
    isGroupPlaceholder: true,
    originalSource: sourceForOuterLambda,
  };
  resultContext.registerParameter(
    resultGroupParam,
    groupPlaceholderSource as any
  );
  const finalProjections: ProjectionExpression[] = [];
  const resultBody = resultLambda.body;
  if (resultBody.type === LinqExpressionType.NewObject) {
    const newObjectResult = resultBody as LinqNewObjectExpression;
    for (const [alias, expr] of newObjectResult.properties.entries()) {
      const sqlExpr = translateResultSelectorExpression(
        expr,
        resultContext,
        visitInContext,
        sourceForOuterLambda,
        context,
        resultKeyParam,
        resultGroupParam
      );
      if (!sqlExpr) {
        throw new Error(
          `groupBy: Projection failed for result alias '${alias}'. Expr: ${expr.toString()}`
        );
      }
      finalProjections.push(new ProjectionExpression(sqlExpr, alias));
    }
  } else {
    const sqlExpr = translateResultSelectorExpression(
      resultBody,
      resultContext,
      visitInContext,
      sourceForOuterLambda,
      context,
      resultKeyParam,
      resultGroupParam
    );
    if (!sqlExpr) {
      throw new Error(
        `groupBy: Simple projection translation failed for: ${resultBody.toString()}`
      );
    }
    const alias = `groupResult${finalProjections.length}`;
    finalProjections.push(new ProjectionExpression(sqlExpr, alias));
  }
  if (finalProjections.length === 0) {
    throw new Error("groupBy resultSelector resulted in zero projections.");
  }

  const groupByAlias = aliasGenerator.generateAlias("group");

  return new SelectExpression(
    groupByAlias,
    finalProjections,
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.having, // Preserva having
    currentSelect.joins,
    [], // orderBy
    null, // offset
    null, // limit
    keySqlExpressions // groupBy
  );
}

// --- Helper para Traduzir Expressões dentro do ResultSelector ---
function translateResultSelectorExpression(
  expression: LinqExpression,
  resultContext: TranslationContext,
  // *** CORREÇÃO: Usa o tipo VisitFn importado ***
  visitInContext: VisitFn,
  originalSource: SqlDataSource,
  rootContext: TranslationContext,
  keyParam: LinqParameterExpression,
  groupParam: LinqParameterExpression
): SqlExpression | null {
  // (Lógica interna do helper inalterada...)
  // --- 1. Check for Key Access ---
  const keyPlaceholderSource =
    resultContext.getDataSourceForParameter(keyParam);
  if (
    expression.type === LinqExpressionType.Parameter &&
    expression === keyParam
  ) {
    if (
      keyPlaceholderSource &&
      (keyPlaceholderSource as any).isGroupKeyPlaceholder
    ) {
      const keySql = (keyPlaceholderSource as any).getSqlForKeyAccess();
      if (keySql) return keySql;
      else
        throw new Error("Could not resolve simple key SQL in result selector.");
    }
  } else if (expression.type === LinqExpressionType.MemberAccess) {
    const memberExpr = expression as LinqMemberExpression;
    if (
      memberExpr.objectExpression.type === LinqExpressionType.Parameter &&
      memberExpr.objectExpression === keyParam
    ) {
      if (
        keyPlaceholderSource &&
        (keyPlaceholderSource as any).isGroupKeyPlaceholder
      ) {
        const keySql = (keyPlaceholderSource as any).getSqlForKeyAccess(
          memberExpr.memberName
        );
        if (keySql) return keySql;
        else
          throw new Error(
            `Could not resolve key member '${memberExpr.memberName}' in result selector.`
          );
      }
    }
  }
  // --- 2. Check for Aggregate Call on Group ---
  if (expression.type === LinqExpressionType.Call) {
    const callExpr = expression as LinqMethodCallExpression;
    if (
      callExpr.source?.type === LinqExpressionType.Parameter &&
      callExpr.source === groupParam
    ) {
      const groupPlaceholderSource =
        resultContext.getDataSourceForParameter(groupParam);
      if (
        groupPlaceholderSource &&
        (groupPlaceholderSource as any).isGroupPlaceholder
      ) {
        const sqlFunctionName = mapLinqAggregateToSql(callExpr.methodName);
        let aggregateArgSql: SqlExpression;
        if (callExpr.args.length === 0 && callExpr.methodName === "count") {
          aggregateArgSql = new SqlConstantExpression(1);
        } else if (
          callExpr.args.length === 1 &&
          callExpr.args[0].type === LinqExpressionType.Lambda
        ) {
          const innerLambda = callExpr.args[0] as LinqLambdaExpression;
          const innerParam = innerLambda.parameters[0];
          const originalSourceContext = rootContext.createChildContext(
            [innerParam],
            [(groupPlaceholderSource as any).originalSource]
          );
          const innerValueSql = visitInContext(
            innerLambda.body,
            originalSourceContext
          );
          if (!innerValueSql) {
            throw new Error(
              `Could not translate aggregate selector '${innerLambda.toString()}' in groupBy.`
            );
          }
          aggregateArgSql = innerValueSql;
        } else {
          throw new Error(
            `Unsupported aggregate call arguments in groupBy: ${callExpr.methodName}`
          );
        }
        return new SqlFunctionCallExpression(sqlFunctionName, [
          aggregateArgSql,
        ]);
      }
    }
  }
  // --- 3. Other Cases ---
  return visitInContext(expression, resultContext);
}

// (Helper mapLinqAggregateToSql inalterado)
function mapLinqAggregateToSql(methodName: string): string {
  switch (methodName.toLowerCase()) {
    case "count":
      return "COUNT";
    case "sum":
      return "SUM";
    case "avg":
      return "AVG";
    case "min":
      return "MIN";
    case "max":
      return "MAX";
    default:
      throw new Error(
        `Unsupported aggregate function in groupBy: ${methodName}`
      );
  }
}

// --- END OF FILE src/query/translation/method-visitors/visitGroupByCall.ts ---
