// --- START OF FILE src/query/translation/method-visitors/visitMaxCall.ts ---

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import {
  ProjectionExpression,
  SelectExpression,
  SqlExpression,
  SqlFunctionCallExpression,
} from "../../../sql-expressions";
import { SqlDataSource, TranslationContext } from "../TranslationContext";

/**
 * Traduz uma chamada de método LINQ 'max(selector)'.
 * @param expression A expressão da chamada de método 'max'.
 * @param currentSelect A SelectExpression atual.
 * @param sourceForLambda A fonte de dados para resolver a lambda selector.
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda no contexto correto.
 * @returns A nova SelectExpression que calcula o máximo.
 */
export function visitMaxCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForLambda: SqlDataSource,
  context: TranslationContext,
  visitInContext: (
    expression: LinqExpression,
    context: TranslationContext
  ) => SqlExpression | null
): SelectExpression {
  if (
    expression.args.length !== 1 ||
    expression.args[0].type !== LinqExpressionType.Lambda
  ) {
    throw new Error("Invalid arguments for 'max' method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0];

  const selectorContext = context.createChildContext(
    [param],
    [sourceForLambda]
  );
  const valueToAggregateSql = visitInContext(lambda.body, selectorContext);

  if (!valueToAggregateSql) {
    throw new Error("Could not translate 'max' selector lambda body.");
  }

  // Cria a função SQL MAX
  const maxFunction = new SqlFunctionCallExpression("MAX", [
    valueToAggregateSql,
  ]);
  const maxProjection = new ProjectionExpression(maxFunction, "max_result");

  // Retorna uma nova SelectExpression *apenas* com a projeção MAX
  return new SelectExpression(
    [maxProjection], // SELECT MAX(...) AS [max_result]
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.joins,
    [] // Remove OrderBy
    // Offset e Limit são removidos
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitMaxCall.ts ---
