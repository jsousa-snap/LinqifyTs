// --- START OF FILE src/query/translation/method-visitors/visitLeftJoinCall.ts ---

// src/query/translation/method-visitors/visitLeftJoinCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  LeftJoinExpression, // <<< IMPORTAR LeftJoinExpression
  SqlBinaryExpression,
  ProjectionExpression,
  TableExpressionBase,
  CompositeUnionExpression,
} from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";
import { OperatorType } from "../../generation/utils/sqlUtils";
import { AliasGenerator } from "../../generation/AliasGenerator";

/**
 * Traduz uma chamada de método LINQ 'leftJoin'.
 * A estrutura é idêntica a visitJoinCall, mas cria LeftJoinExpression.
 */
export function visitLeftJoinCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForOuterLambda: SqlDataSource,
  context: TranslationContext,
  visit: (expression: LinqExpression | null) => SqlExpression | null,
  visitInContext: (
    expression: LinqExpression,
    context: TranslationContext
  ) => SqlExpression | null,
  createProjections: (
    body: LinqExpression,
    context: TranslationContext
  ) => ProjectionExpression[],
  aliasGenerator: AliasGenerator
): SelectExpression {
  // Validações de argumentos (idênticas a join)
  const [
    innerSourceLinqExpr,
    outerKeyLambdaExpr,
    innerKeyLambdaExpr,
    resultLambdaExpr,
  ] = expression.args as [
    LinqExpression,
    LinqLambdaExpression,
    LinqLambdaExpression,
    LinqLambdaExpression
  ];

  // --- 1. Visita a fonte interna (idêntico a join) ---
  const innerSqlSourceBase = visit(innerSourceLinqExpr);
  if (
    !innerSqlSourceBase ||
    !(innerSqlSourceBase instanceof TableExpressionBase)
  ) {
    throw new Error(
      `Visiting inner source for 'leftJoin' did not yield a Table, Select, or Union. Found: ${innerSqlSourceBase?.constructor.name}`
    );
  }
  if (
    !innerSqlSourceBase.alias &&
    innerSqlSourceBase instanceof TableExpressionBase
  ) {
    (innerSqlSourceBase as { alias: string }).alias =
      aliasGenerator.generateAlias(
        innerSqlSourceBase instanceof TableExpression
          ? innerSqlSourceBase.name
          : innerSqlSourceBase.type
      );
  }

  // --- 2. Tradução das chaves (idêntico a join) ---
  const outerParam = outerKeyLambdaExpr.parameters[0];
  const innerParam = innerKeyLambdaExpr.parameters[0];
  const outerKeyContext = context.createChildContext(
    [outerParam],
    [sourceForOuterLambda]
  );
  const outerKeySql = visitInContext(outerKeyLambdaExpr.body, outerKeyContext);
  const innerKeyContext = context.createChildContext(
    [innerParam],
    [innerSqlSourceBase]
  );
  const innerKeySql = visitInContext(innerKeyLambdaExpr.body, innerKeyContext);
  if (!outerKeySql || !innerKeySql) {
    throw new Error("Could not translate leftJoin keys.");
  }

  // --- 3. Criação da expressão de JOIN ---
  const joinPredicate = new SqlBinaryExpression(
    outerKeySql,
    OperatorType.Equal,
    innerKeySql
  );
  // **** DIFERENÇA PRINCIPAL: Cria LeftJoinExpression ****
  const joinExpr = new LeftJoinExpression(innerSqlSourceBase, joinPredicate); // <<< LeftJoinExpression
  const newJoins = [...currentSelect.joins, joinExpr];

  // --- 4. Criação das projeções do resultado (idêntico a join) ---
  const resultOuterParam = resultLambdaExpr.parameters[0];
  const resultInnerParam = resultLambdaExpr.parameters[1];
  const resultContext = context.createChildContext(
    [resultOuterParam, resultInnerParam],
    [sourceForOuterLambda, innerSqlSourceBase]
  );
  const resultProjections = createProjections(
    resultLambdaExpr.body,
    resultContext
  );
  if (resultProjections.length === 0) {
    throw new Error("LeftJoin projection resulted in no columns.");
  }

  // --- 5. Cria a nova SelectExpression (idêntico a join) ---
  const joinAlias = aliasGenerator.generateAlias("leftJoin"); // Gera alias como lj0, lj1, etc.

  return new SelectExpression(
    joinAlias,
    resultProjections,
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.having,
    newJoins, // <<< Adiciona o LeftJoin
    currentSelect.orderBy,
    currentSelect.offset,
    currentSelect.limit,
    currentSelect.groupBy
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitLeftJoinCall.ts ---
