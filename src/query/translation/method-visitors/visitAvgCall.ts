// --- START OF FILE src/query/translation/method-visitors/visitAvgCall.ts ---

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import {
  ProjectionExpression,
  SelectExpression,
  SqlBinaryExpression,
  SqlConstantExpression,
  SqlExpression,
  SqlFunctionCallExpression,
} from "../../../sql-expressions";
import { SqlDataSource, TranslationContext } from "../TranslationContext";
import { OperatorType } from "../../generation/utils/sqlUtils"; // Import OperatorType if needed for predicate combination

/**
 * Traduz uma chamada de método LINQ 'avg(selector)'.
 * @param expression A expressão da chamada de método 'avg'.
 * @param currentSelect A SelectExpression atual.
 * @param sourceForLambda A fonte de dados para resolver a lambda selector.
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda no contexto correto.
 * @returns A nova SelectExpression que calcula a média.
 */
export function visitAvgCall(
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
    throw new Error("Invalid arguments for 'avg' method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0];

  const selectorContext = context.createChildContext(
    [param],
    [sourceForLambda]
  );
  const valueToAggregateSql = visitInContext(lambda.body, selectorContext);

  if (!valueToAggregateSql) {
    throw new Error("Could not translate 'avg' selector lambda body.");
  }

  // Cria a função SQL AVG
  const avgFunction = new SqlFunctionCallExpression("AVG", [
    valueToAggregateSql,
  ]);
  const avgProjection = new ProjectionExpression(avgFunction, "avg_result");

  // Retorna uma nova SelectExpression *apenas* com a projeção AVG,
  // mantendo o FROM, JOINs e WHERE originais.
  // ORDER BY e Paging são ignorados para agregações.
  return new SelectExpression(
    [avgProjection], // SELECT AVG(...) AS [avg_result]
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.joins,
    [] // Remove OrderBy
    // Offset e Limit são removidos
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitAvgCall.ts ---
