import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  ConstantExpression as LinqConstantExpression,
  MemberExpression as LinqMemberExpression,
  LambdaExpression as LinqLambdaExpression,
  OperatorType,
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

export function visitCountCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForLambda: SqlDataSource,
  context: TranslationContext,
  visitInContext: (
    expression: LinqExpression,
    context: TranslationContext
  ) => SqlExpression | null
) {
  let finalPredicate = currentSelect.predicate;
  if (expression.args.length > 0) {
    // Se Count(predicate)
    if (
      expression.args.length !== 1 ||
      expression.args[0].type !== LinqExpressionType.Lambda
    ) {
      throw new Error(
        "Invalid arguments for 'count' method call with predicate."
      );
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    const param = lambda.parameters[0];
    const predicateContext = context.createChildContext(
      [param],
      [sourceForLambda]
    );
    const predicateSql = visitInContext(lambda.body, predicateContext);
    if (!predicateSql) {
      throw new Error("Could not translate 'count' predicate lambda body.");
    }
    finalPredicate = currentSelect.predicate
      ? new SqlBinaryExpression(
          currentSelect.predicate,
          OperatorType.And,
          predicateSql
        )
      : predicateSql;
  }
  const countFunction = new SqlFunctionCallExpression("COUNT_BIG", [
    new SqlConstantExpression(1),
  ]);
  const countProjection = new ProjectionExpression(
    countFunction,
    "count_result"
  );
  // Retorna a SelectExpression modificada para fazer a contagem
  return new SelectExpression(
    [countProjection], // SELECT COUNT_BIG(1)...
    currentSelect.from, // FROM original (TableExpression)
    finalPredicate, // WHERE original (ou combinado)
    currentSelect.joins, // JOINs originais
    [],
    currentSelect.offset, // Preserva offset
    currentSelect.limit // Preserva limit
  );
}
