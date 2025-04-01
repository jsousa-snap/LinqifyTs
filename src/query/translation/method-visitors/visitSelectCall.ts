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
// *** NOVO: Importa AliasGenerator ***
import { AliasGenerator } from "../../generation/AliasGenerator";

/**
 * Traduz uma chamada de método LINQ 'select'.
 * @param expression A expressão da chamada de método 'select'.
 * @param currentSelect A SelectExpression atual.
 * @param sourceForOuterLambda A fonte de dados para resolver a lambda selector.
 * @param context O contexto de tradução.
 * @param createProjections Função para criar projeções SQL a partir do corpo da lambda.
 * @param aliasGenerator O gerador de alias para a nova SelectExpression.
 * @returns A nova SelectExpression com a projeção atualizada.
 */
export function visitSelectCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForOuterLambda: SqlDataSource,
  context: TranslationContext,
  createProjections: (
    body: LinqExpression,
    context: TranslationContext
  ) => ProjectionExpression[],
  aliasGenerator: AliasGenerator // <<< NOVO PARÂMETRO
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

  // SELECT cria uma nova forma, precisa de um alias
  // *** NOVO: Usa aliasGenerator ***
  const selectAlias = aliasGenerator.generateAlias("select"); // Gera alias como s0, s1, etc.

  return new SelectExpression(
    selectAlias, // <<< alias
    newProjections, // projection (Atualiza)
    currentSelect.from, // from
    currentSelect.predicate, // predicate
    currentSelect.having, // having (Preserva)
    currentSelect.joins, // joins
    currentSelect.orderBy, // orderBy (Preserva)
    currentSelect.offset, // offset (Preserva)
    currentSelect.limit, // limit (Preserva)
    currentSelect.groupBy // groupBy (Preserva)
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitSelectCall.ts ---
