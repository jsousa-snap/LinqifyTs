// --- START OF FILE src/query/translation/method-visitors/visitMinCall.ts ---

// src/query/translation/method-visitors/visitMinCall.ts

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
// *** NOVO: Importa AliasGenerator ***
import { AliasGenerator } from "../../generation/AliasGenerator";

/**
 * Traduz uma chamada de método LINQ 'min(selector)'.
 * @param expression A expressão da chamada de método 'min'.
 * @param currentSelect A SelectExpression atual.
 * @param sourceForLambda A fonte de dados para resolver a lambda selector.
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda no contexto correto.
 * @param aliasGenerator O gerador de alias.
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
  ) => SqlExpression | null,
  aliasGenerator: AliasGenerator // <<< NOVO PARÂMETRO
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

  // Agregação terminal não precisa de alias externo
  const aggregationAlias = ""; // Alias vazio

  return new SelectExpression(
    aggregationAlias, // alias
    [minProjection], // projection (SELECT MIN(...) AS [min_result])
    currentSelect.from, // from
    currentSelect.predicate, // predicate
    null, // having
    currentSelect.joins, // joins
    [] // orderBy (Remove)
    // Offset e Limit são removidos (default null)
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitMinCall.ts ---
