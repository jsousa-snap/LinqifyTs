// --- START OF FILE src/query/translation/method-visitors/visitJoinCall.ts ---

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
} from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";
import { OperatorType } from "../../generation/utils/sqlUtils";

// Função wrapper
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
  ) => ProjectionExpression[]
): SelectExpression {
  // Validações de argumentos (inalteradas)
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

  const innerSqlDataSource = visit(innerSourceLinqExpr);
  if (!innerSqlDataSource) {
    throw new Error(`Visiting inner source for 'join' failed.`);
  }

  let innerTableForJoin: TableExpression;
  if (innerSqlDataSource instanceof TableExpression) {
    innerTableForJoin = innerSqlDataSource;
  } else if (
    innerSqlDataSource instanceof SelectExpression &&
    innerSqlDataSource.from instanceof TableExpression
  ) {
    // TODO: Lidar com joins em subqueries de forma mais robusta.
    // Por agora, pegamos a tabela base da subquery.
    innerTableForJoin = innerSqlDataSource.from;
    console.warn(
      `JOIN with subquery source [${innerTableForJoin.alias}] detected. Currently using base table.`
    );
  } else {
    throw new Error(
      `JOIN requires inner source to be Table or Select with Table FROM (found: ${innerSqlDataSource?.constructor.name})`
    );
  }

  // Tradução das chaves (inalterada)
  const outerParam = outerKeyLambdaExpr.parameters[0];
  const innerParam = innerKeyLambdaExpr.parameters[0];
  const outerKeyContext = context.createChildContext(
    [outerParam],
    [sourceForOuterLambda]
  );
  const outerKeySql = visitInContext(outerKeyLambdaExpr.body, outerKeyContext);
  const innerKeyContext = context.createChildContext(
    [innerParam],
    [innerTableForJoin]
  );
  const innerKeySql = visitInContext(innerKeyLambdaExpr.body, innerKeyContext);

  if (!outerKeySql || !innerKeySql) {
    throw new Error("Could not translate join keys.");
  }

  // Criação da condição e expressão de JOIN (inalterada)
  const joinPredicate = new SqlBinaryExpression(
    outerKeySql,
    OperatorType.Equal,
    innerKeySql
  );
  const joinExpr = new InnerJoinExpression(innerTableForJoin, joinPredicate);
  const newJoins = [...currentSelect.joins, joinExpr];

  // Criação das projeções do resultado (inalterada)
  const resultOuterParam = resultLambdaExpr.parameters[0];
  const resultInnerParam = resultLambdaExpr.parameters[1];
  const resultContext = context.createChildContext(
    [resultOuterParam, resultInnerParam],
    [sourceForOuterLambda, innerTableForJoin] // Passa as fontes corretas
  );
  const resultProjections = createProjections(
    resultLambdaExpr.body,
    resultContext
  );
  if (resultProjections.length === 0) {
    throw new Error("Join projection resulted in no columns.");
  }

  // **CORREÇÃO: Ordem dos argumentos do construtor**
  // JOIN geralmente redefine a paginação, mas preservamos para consistência,
  // a menos que haja lógica específica para resetar.
  return new SelectExpression(
    resultProjections, // projection (Atualiza)
    currentSelect.from, // from
    currentSelect.predicate, // predicate
    null, // having <<< Passando null
    newJoins, // joins (Atualiza)
    currentSelect.orderBy, // orderBy (Preserva - pode precisar reavaliar)
    currentSelect.offset, // offset (Preserva)
    currentSelect.limit // limit (Preserva)
    // groupBy (Default [])
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitJoinCall.ts ---
