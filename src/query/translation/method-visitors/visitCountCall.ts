// --- START OF FILE src/query/translation/method-visitors/visitCountCall.ts ---

// src/query/translation/method-visitors/visitCountCall.ts

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
// *** NOVO: Importa AliasGenerator ***
import { AliasGenerator } from "../../generation/AliasGenerator";

/**
 * Traduz uma chamada de método LINQ 'count()' ou 'count(predicate)'.
 * @param expression A expressão da chamada de método 'count'.
 * @param currentSelect A SelectExpression atual.
 * @param sourceForLambda A fonte de dados para resolver a lambda, se houver.
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda do predicado no contexto correto.
 * @param aliasGenerator O gerador de alias.
 * @returns A nova SelectExpression que realiza a contagem.
 */
export function visitCountCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForLambda: SqlDataSource,
  context: TranslationContext,
  visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null,
  aliasGenerator: AliasGenerator // <<< NOVO PARÂMETRO
): SelectExpression {
  let finalPredicate = currentSelect.predicate;
  if (expression.args.length > 0) {
    // Se Count(predicate)
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Invalid arguments for 'count' method call with predicate.");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    const param = lambda.parameters[0];
    const predicateContext = context.createChildContext([param], [sourceForLambda]);
    const predicateSql = visitInContext(lambda.body, predicateContext);
    if (!predicateSql) {
      throw new Error("Could not translate 'count' predicate lambda body.");
    }
    finalPredicate = currentSelect.predicate
      ? new SqlBinaryExpression(currentSelect.predicate, OperatorType.And, predicateSql)
      : predicateSql;
  }
  const countFunction = new SqlFunctionCallExpression("COUNT_BIG", [new SqlConstantExpression(1)]);
  const countProjection = new ProjectionExpression(countFunction, "count_result");

  // COUNT terminal não precisa de alias externo
  const countAlias = ""; // Alias vazio

  return new SelectExpression(
    countAlias, // alias
    [countProjection], // projection (SELECT COUNT_BIG(1)...)
    currentSelect.from, // from (Original)
    finalPredicate, // predicate (WHERE original ou combinado)
    null, // having
    currentSelect.joins, // joins (Originais)
    [], // orderBy (Remove)
    currentSelect.offset, // Preserva offset (COUNT não deveria ter, mas mantemos por ora)
    currentSelect.limit // Preserva limit (COUNT não deveria ter, mas mantemos por ora)
    // groupBy (Default [])
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitCountCall.ts ---
