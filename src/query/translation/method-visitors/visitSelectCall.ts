// --- START OF FILE src/query/translation/method-visitors/visitSelectCall.ts ---

// src/query/translation/method-visitors/visitSelectCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
  ParameterExpression as LinqParameterExpression, // Importar ParameterExpression
} from "../../../expressions";
import { SqlExpression, SelectExpression, ProjectionExpression, SqlOrdering } from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";
// *** NOVO: Importa AliasGenerator ***
import { AliasGenerator } from "../../generation/AliasGenerator";

/**
 * Traduz uma chamada de método LINQ 'select'.
 * Identifica projeções de identidade (x => x) para reutilizar projeções anteriores.
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
  createProjections: (body: LinqExpression, context: TranslationContext) => ProjectionExpression[],
  aliasGenerator: AliasGenerator // <<< NOVO PARÂMETRO
): SelectExpression {
  if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
    throw new Error("Invalid arguments for 'select' method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  if (lambda.parameters.length !== 1) {
    throw new Error("'select' lambda needs 1 parameter.");
  }
  const param = lambda.parameters[0];

  // **** CORREÇÃO: Tipar finalProjections como ReadonlyArray ****
  let finalProjections: ReadonlyArray<ProjectionExpression>;
  let selectAlias: string;

  // **** DETECÇÃO DA PROJEÇÃO DE IDENTIDADE ****
  if (
    lambda.body.type === LinqExpressionType.Parameter &&
    (lambda.body as LinqParameterExpression).name === param.name
  ) {
    // É uma projeção de identidade (x => x)
    // **** CORREÇÃO: Reutiliza a projeção readonly diretamente ****
    finalProjections = currentSelect.projection;
    console.warn("Detected identity select (x => x). Reusing previous projections.");
    // Ainda precisa de um novo alias para o SELECT externo
    selectAlias = aliasGenerator.generateAlias("selectId"); // Alias específico ou padrão
  } else {
    // Projeção normal
    const projectionContext = context.createChildContext([param], [sourceForOuterLambda]);
    // createProjections retorna ProjectionExpression[], que é atribuível a ReadonlyArray
    const createdProjections = createProjections(lambda.body, projectionContext);
    if (createdProjections.length === 0) {
      throw new Error("Select projection resulted in no columns.");
    }
    finalProjections = createdProjections; // Atribuição válida
    // Gera um novo alias padrão para projeções não-identidade
    selectAlias = aliasGenerator.generateAlias("select");
  }
  // **** FIM DA DETECÇÃO ****

  // Cria a nova SelectExpression com as projeções corretas e o alias gerado
  return new SelectExpression(
    selectAlias,
    finalProjections, // <<< Passa finalProjections (ReadonlyArray)
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.having,
    currentSelect.joins,
    currentSelect.orderBy, // Preserva ordenação (importante!)
    currentSelect.offset, // Preserva paginação
    currentSelect.limit, // Preserva paginação
    currentSelect.groupBy // Preserva agrupamento
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitSelectCall.ts ---
