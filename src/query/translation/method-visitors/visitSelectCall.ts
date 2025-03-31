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

  // **CORREÇÃO: Propaga offset e limit**
  return new SelectExpression(
    newProjections, // Atualiza projeção
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.joins,
    currentSelect.orderBy, // Preserva orderBy
    currentSelect.offset, // Preserva offset
    currentSelect.limit // Preserva limit
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitSelectCall.ts ---
