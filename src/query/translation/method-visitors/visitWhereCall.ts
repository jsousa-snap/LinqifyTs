// --- START OF FILE src/query/translation/method-visitors/visitWhereCall.ts ---

// src/query/translation/method-visitors/visitWhereCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../expressions";
import { SqlExpression, SelectExpression, SqlBinaryExpression } from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";
import { OperatorType } from "../../generation/utils/sqlUtils"; // <<< Precisa importar OperatorType

/**
 * Traduz uma chamada de método LINQ 'where'.
 * @param expression A expressão da chamada de método 'where'.
 * @param currentSelect A SelectExpression atual.
 * @param sourceForOuterLambda A fonte de dados para resolver a lambda.
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda no contexto correto.
 * @returns A nova SelectExpression com o predicado WHERE atualizado.
 */
export function visitWhereCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForOuterLambda: SqlDataSource,
  context: TranslationContext,
  visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
): SelectExpression {
  if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
    throw new Error("Invalid arguments for 'where' method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0];
  const predicateContext = context.createChildContext([param], [sourceForOuterLambda]);
  const predicateSql = visitInContext(lambda.body, predicateContext);

  // *** CORREÇÃO: Throw error se predicateSql for null ***
  if (!predicateSql) {
    throw new Error(`Could not translate 'where' predicate: ${lambda.body.toString()}`);
  }

  const newPredicate = currentSelect.predicate
    ? new SqlBinaryExpression(
        currentSelect.predicate, // Não pode ser null aqui por definição
        OperatorType.And,
        predicateSql // Agora garantido que não é null
      )
    : predicateSql; // Se não havia predicado anterior, usa o novo

  // WHERE não muda a forma, reutiliza o alias
  const alias = currentSelect.alias;

  // *** CORREÇÃO: Ordem dos argumentos do construtor ***
  return new SelectExpression(
    alias, // <<< alias (Mantém)
    currentSelect.projection, // projection
    currentSelect.from, // from
    newPredicate, // predicate (Atualiza)
    null, // having
    currentSelect.joins, // joins
    currentSelect.orderBy, // orderBy (Preserva)
    currentSelect.offset, // offset (Preserva)
    currentSelect.limit // limit (Preserva)
    // groupBy (Default [])
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitWhereCall.ts ---
