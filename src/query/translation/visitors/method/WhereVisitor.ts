import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../../expressions";
import { SqlExpression, SelectExpression, SqlBinaryExpression } from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor";
import { OperatorType } from "../../../generation/utils/sqlUtils";

/**
 * Traduz uma chamada de método LINQ `where` para adicionar ou estender
 * a cláusula WHERE de uma SelectExpression SQL.
 */
export class WhereVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /** Cria uma instância de WhereVisitor. */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn,
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /** Aplica a lógica do `where`. */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    sourceForLambda: SqlDataSource
  ): SelectExpression {
    if (expression.methodName !== "where") {
      throw new Error("WhereVisitor só pode traduzir chamadas 'where'.");
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Argumento inválido para 'where'. Esperada Lambda.");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error("Lambda 'where' deve ter 1 parâmetro.");
    }
    const param = lambda.parameters[0];

    const predicateContext = this.context.createChildContext([param], [sourceForLambda]);
    const predicateSql = this.visitInContext(lambda.body, predicateContext);

    if (!predicateSql) {
      throw new Error(`Não foi possível traduzir predicado 'where': ${lambda.body.toString()}`);
    }

    const newPredicate = currentSelect.predicate
      ? new SqlBinaryExpression(currentSelect.predicate, OperatorType.And, predicateSql)
      : predicateSql;

    return new SelectExpression(
      currentSelect.alias,
      currentSelect.projection,
      currentSelect.from,
      newPredicate,
      currentSelect.having,
      currentSelect.joins,
      currentSelect.orderBy,
      currentSelect.offset,
      currentSelect.limit,
      currentSelect.groupBy
    );
  }
}
