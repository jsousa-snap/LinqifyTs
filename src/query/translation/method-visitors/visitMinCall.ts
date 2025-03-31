// --- START OF FILE src/query/translation/method-visitors/visitMinCall.ts ---

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
 * Traduz uma chamada de método LINQ 'min(selector)'.
 * @param expression A expressão da chamada de método 'min'.
 * @param currentSelect A SelectExpression atual.
 * @param sourceForLambda A fonte de dados para resolver a lambda selector.
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda no contexto correto.
 * @returns A nova SelectExpression que calcula o mínimo.
 */
export function visitMinCall(
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
    throw new Error("Invalid arguments for 'min' method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0];

  const selectorContext = context.createChildContext(
    [param],
    [sourceForLambda]
  );
  const valueToAggregateSql = visitInContext(lambda.body, selectorContext);

  if (!valueToAggregateSql) {
    throw new Error("Could not translate 'min' selector lambda body.");
  }

  // Cria a função SQL MIN
  const minFunction = new SqlFunctionCallExpression("MIN", [
    valueToAggregateSql,
  ]);
  const minProjection = new ProjectionExpression(minFunction, "min_result");

  // Retorna uma nova SelectExpression *apenas* com a projeção MIN
  return new SelectExpression(
    [minProjection], // SELECT MIN(...) AS [min_result]
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.joins,
    [] // Remove OrderBy
    // Offset e Limit são removidos
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitMinCall.ts ---
