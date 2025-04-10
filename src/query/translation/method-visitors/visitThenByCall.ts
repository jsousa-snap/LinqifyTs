// --- START OF FILE src/query/translation/method-visitors/visitThenByCall.ts ---

// src/query/translation/method-visitors/visitThenByCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import { SqlExpression, SelectExpression, SqlOrdering, SortDirection } from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";

/**
 * Traduz chamadas 'thenBy' e 'thenByDescending'.
 * @param expression A expressão MethodCall (thenBy ou thenByDescending).
 * @param currentSelect A SelectExpression atual (que DEVE ter ordenação).
 * @param sourceForLambda A fonte de dados para resolver a lambda keySelector.
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda no contexto correto.
 * @param direction A direção da ordenação ('ASC' ou 'DESC').
 * @returns A nova SelectExpression com a ordenação adicional aplicada.
 */
export function visitThenByCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForLambda: SqlDataSource,
  context: TranslationContext,
  visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null,
  direction: SortDirection
): SelectExpression {
  if (currentSelect.orderBy.length === 0) {
    throw new Error(`Cannot call '${expression.methodName}' on a query that has not been ordered.`);
  }

  if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
    throw new Error(`Invalid arguments for '${expression.methodName}' method call.`);
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0];

  const keySelectorContext = context.createChildContext([param], [sourceForLambda]);
  const keySql = visitInContext(lambda.body, keySelectorContext);

  if (!keySql) {
    throw new Error(`Could not translate key selector for '${expression.methodName}'.`);
  }

  const newOrdering: SqlOrdering = { expression: keySql, direction };
  const updatedOrderBy = [...currentSelect.orderBy, newOrdering];

  // ThenBy não muda a forma, reutiliza o alias
  const alias = currentSelect.alias;

  // **CORREÇÃO: Ordem dos argumentos do construtor**
  return new SelectExpression(
    alias, // <<< alias (Mantém)
    currentSelect.projection, // projection
    currentSelect.from, // from
    currentSelect.predicate, // predicate
    null, // having
    currentSelect.joins, // joins
    updatedOrderBy, // orderBy (Adiciona)
    currentSelect.offset, // offset (Preserva)
    currentSelect.limit // limit (Preserva)
    // groupBy (Default [])
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitThenByCall.ts ---
