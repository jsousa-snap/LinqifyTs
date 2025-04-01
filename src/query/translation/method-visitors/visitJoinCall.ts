// --- START OF FILE src/query/translation/method-visitors/visitJoinCall.ts ---

// src/query/translation/method-visitors/visitJoinCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  InnerJoinExpression,
  SqlBinaryExpression,
  ProjectionExpression,
  TableExpressionBase,
  CompositeUnionExpression,
} from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";
import { OperatorType } from "../../generation/utils/sqlUtils";
// *** NOVO: Importa AliasGenerator ***
import { AliasGenerator } from "../../generation/AliasGenerator";

/**
 * Traduz uma chamada de método LINQ 'join'.
 * @param expression A expressão da chamada de método 'join'.
 * @param currentSelect A SelectExpression atual (representando a fonte externa).
 * @param sourceForOuterLambda A fonte de dados para a lambda da chave externa.
 * @param context O contexto de tradução.
 * @param visit Função principal de visita para a fonte interna.
 * @param visitInContext Função para visitar lambdas no contexto correto.
 * @param createProjections Função para criar projeções SQL a partir da lambda de resultado.
 * @param aliasGenerator O gerador de alias para a nova SelectExpression resultante.
 * @returns A nova SelectExpression representando o resultado do JOIN.
 */
export function visitJoinCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForOuterLambda: SqlDataSource,
  context: TranslationContext,
  visit: (expression: LinqExpression | null) => SqlExpression | null,
  visitInContext: (
    expression: LinqExpression,
    context: TranslationContext
  ) => SqlExpression | null,
  createProjections: (
    body: LinqExpression,
    context: TranslationContext
  ) => ProjectionExpression[],
  aliasGenerator: AliasGenerator // <<< NOVO PARÂMETRO
): SelectExpression {
  // Validações de argumentos
  const [
    innerSourceLinqExpr,
    outerKeyLambdaExpr,
    innerKeyLambdaExpr,
    resultLambdaExpr,
  ] = expression.args as [
    LinqExpression,
    LinqLambdaExpression,
    LinqLambdaExpression,
    LinqLambdaExpression
  ];

  // --- 1. Visita a fonte interna ---
  const innerSqlSourceBase = visit(innerSourceLinqExpr);
  if (
    !innerSqlSourceBase ||
    !(innerSqlSourceBase instanceof TableExpressionBase)
  ) {
    throw new Error(
      `Visiting inner source for 'join' did not yield a Table, Select, or Union. Found: ${innerSqlSourceBase?.constructor.name}`
    );
  }
  // Garante que a fonte interna tenha um alias (necessário para o JOIN ON e projeções)
  if (
    !innerSqlSourceBase.alias &&
    innerSqlSourceBase instanceof TableExpressionBase
  ) {
    (innerSqlSourceBase as { alias: string }).alias =
      aliasGenerator.generateAlias(
        innerSqlSourceBase instanceof TableExpression
          ? innerSqlSourceBase.name
          : innerSqlSourceBase.type
      );
  }

  // --- 2. Tradução das chaves ---
  const outerParam = outerKeyLambdaExpr.parameters[0];
  const innerParam = innerKeyLambdaExpr.parameters[0];
  const outerKeyContext = context.createChildContext(
    [outerParam],
    [sourceForOuterLambda]
  );
  const outerKeySql = visitInContext(outerKeyLambdaExpr.body, outerKeyContext);
  const innerKeyContext = context.createChildContext(
    [innerParam],
    [innerSqlSourceBase]
  );
  const innerKeySql = visitInContext(innerKeyLambdaExpr.body, innerKeyContext);
  if (!outerKeySql || !innerKeySql) {
    throw new Error("Could not translate join keys.");
  }

  // --- 3. Criação da expressão de JOIN ---
  const joinPredicate = new SqlBinaryExpression(
    outerKeySql,
    OperatorType.Equal,
    innerKeySql
  );
  const joinExpr = new InnerJoinExpression(innerSqlSourceBase, joinPredicate);
  const newJoins = [...currentSelect.joins, joinExpr];

  // --- 4. Criação das projeções do resultado ---
  const resultOuterParam = resultLambdaExpr.parameters[0];
  const resultInnerParam = resultLambdaExpr.parameters[1];
  const resultContext = context.createChildContext(
    [resultOuterParam, resultInnerParam],
    [sourceForOuterLambda, innerSqlSourceBase]
  );
  const resultProjections = createProjections(
    resultLambdaExpr.body,
    resultContext
  );
  if (resultProjections.length === 0) {
    throw new Error("Join projection resulted in no columns.");
  }

  // --- 5. Cria a nova SelectExpression ---
  // JOIN cria uma nova forma, precisa de um alias
  // *** NOVO: Usa aliasGenerator ***
  const joinAlias = aliasGenerator.generateAlias("join"); // Gera alias como j0, j1, etc.

  return new SelectExpression(
    joinAlias, // <<< alias
    resultProjections, // projection (Nova projeção do resultado)
    currentSelect.from, // from (Mantém o FROM original)
    currentSelect.predicate, // predicate (Mantém o WHERE original)
    currentSelect.having, // having (Mantém o HAVING original)
    newJoins, // joins (Adiciona o novo JOIN)
    currentSelect.orderBy, // orderBy (Preserva)
    currentSelect.offset, // offset (Preserva)
    currentSelect.limit, // limit (Preserva)
    currentSelect.groupBy // groupBy (Preserva)
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitJoinCall.ts ---
