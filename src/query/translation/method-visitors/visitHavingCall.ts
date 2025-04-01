// --- START OF FILE src/query/translation/method-visitors/visitHavingCall.ts ---

// src/query/translation/method-visitors/visitHavingCall.ts

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

/**
 * Traduz uma chamada de método LINQ 'where' que deve ser mapeada para uma cláusula SQL HAVING.
 * Isso ocorre quando 'where' é aplicado após um 'groupBy'.
 * @param expression A expressão da chamada de método 'where'.
 * @param currentSelect A SelectExpression atual (resultado do groupBy).
 * @param sourceForLambda A fonte de dados para resolver a lambda (o resultado do groupBy).
 * @param context O contexto de tradução.
 * @param visitInContext Função para visitar a lambda no contexto correto.
 * @returns A nova SelectExpression com a cláusula HAVING definida.
 */
export function visitHavingCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  sourceForLambda: SqlDataSource,
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
    throw new Error("Invalid arguments for 'where' (as HAVING) method call.");
  }
  const lambda = expression.args[0] as LinqLambdaExpression;
  const param = lambda.parameters[0]; // Parâmetro representando o resultado do group (ex: g)

  // O contexto para a lambda do HAVING usa a SelectExpression atual (resultado do group)
  const predicateContext = context.createChildContext(
    [param],
    [sourceForLambda]
  );
  const predicateSql = visitInContext(lambda.body, predicateContext);

  if (!predicateSql) {
    throw new Error("Could not translate 'where' (as HAVING) predicate.");
  }

  // Combina com um HAVING existente, se houver
  const newHaving = currentSelect.having
    ? new SqlBinaryExpression(
        currentSelect.having,
        OperatorType.And,
        predicateSql
      )
    : predicateSql;

  // HAVING não muda a forma, reutiliza o alias
  const alias = currentSelect.alias;

  // *** CORREÇÃO: Ordem dos argumentos do construtor ***
  return new SelectExpression(
    alias, // <<< alias (Mantém)
    currentSelect.projection, // projection
    currentSelect.from, // from
    currentSelect.predicate, // predicate (Preserva o WHERE original)
    newHaving, // having (Define)
    currentSelect.joins, // joins
    currentSelect.orderBy, // orderBy
    currentSelect.offset, // offset
    currentSelect.limit, // limit
    currentSelect.groupBy // groupBy (Mantém)
  );
}

// --- END OF FILE src/query/translation/method-visitors/visitHavingCall.ts ---
