// --- START OF FILE src/query/translation/method-visitors/visitWhereCall.ts ---

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  SqlBinaryExpression,
} from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";
import { OperatorType } from "../../generation/utils/sqlUtils";

// Função wrapper
export function visitWhereCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForOuterLambda: SqlDataSource,
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
    throw new Error("Invalid arguments for 'where' method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0];
  const predicateContext = context.createChildContext(
    [param],
    [sourceForOuterLambda]
  );
  const predicateSql = visitInContext(lambda.body, predicateContext);
  if (!predicateSql) {
    throw new Error("Could not translate 'where' predicate.");
  }
  const newPredicate = currentSelect.predicate
    ? new SqlBinaryExpression(
        currentSelect.predicate,
        OperatorType.And,
        predicateSql
      )
    : predicateSql;

  // **CORREÇÃO: Ordem dos argumentos do construtor**
  return new SelectExpression(
    currentSelect.projection, // projection
    currentSelect.from, // from
    newPredicate, // predicate (Atualiza)
    null, // having <<< Passando null
    currentSelect.joins, // joins
    currentSelect.orderBy, // orderBy (Preserva)
    currentSelect.offset, // offset (Preserva)
    currentSelect.limit // limit (Preserva)
    // groupBy (Default [])
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitWhereCall.ts ---
