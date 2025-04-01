// --- START OF FILE src/query/translation/method-visitors/visitSelectCall.ts ---

// src/query/translation/method-visitors/visitSelectCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  ProjectionExpression,
  SqlOrdering,
} from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";

// Função wrapper
export function visitSelectCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForOuterLambda: SqlDataSource,
  context: TranslationContext,
  createProjections: (
    body: LinqExpression,
    context: TranslationContext
  ) => ProjectionExpression[]
): SelectExpression {
  if (
    expression.args.length !== 1 ||
    expression.args[0].type !== LinqExpressionType.Lambda
  ) {
    throw new Error("Invalid arguments for 'select' method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0];
  const projectionContext = context.createChildContext(
    [param],
    [sourceForOuterLambda]
  );
  const newProjections = createProjections(lambda.body, projectionContext);
  if (newProjections.length === 0) {
    throw new Error("Select projection resulted in no columns.");
  }

  // **CORREÇÃO: Ordem dos argumentos do construtor**
  return new SelectExpression(
    newProjections, // projection (Atualiza)
    currentSelect.from, // from
    currentSelect.predicate, // predicate
    null, // having <<< Passando null
    currentSelect.joins, // joins
    currentSelect.orderBy, // orderBy (Preserva)
    currentSelect.offset, // offset (Preserva)
    currentSelect.limit // limit (Preserva)
    // groupBy (Default [])
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitSelectCall.ts ---
