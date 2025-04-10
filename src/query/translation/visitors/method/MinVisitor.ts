import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  ProjectionExpression,
  SqlFunctionCallExpression,
} from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor";

/**
 * Traduz uma chamada de método LINQ `min(selector)`
 * para uma SelectExpression que calcula `MIN(expression)`.
 *
 * Herda de `MethodVisitor`.
 */
export class MinVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /** Cria uma instância de MinVisitor. */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // Necessário para super
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /** Aplica a lógica do `min`. */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    sourceForLambda: SqlDataSource
  ): SelectExpression {
    const methodName = expression.methodName.replace(/Async$/, ""); // Remove Async
    // Validação
    if (methodName !== "min") {
      throw new Error("MinVisitor só pode traduzir chamadas 'min' ou 'minAsync'.");
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Argumento inválido para 'min'. Esperada uma lambda (seletor).");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error("A lambda do seletor de 'min' deve ter exatamente um parâmetro.");
    }
    const param = lambda.parameters[0];

    // Cria contexto filho e visita o seletor
    const selectorContext = this.context.createChildContext([param], [sourceForLambda]);
    const valueToAggregateSql = this.visitInContext(lambda.body, selectorContext); // Usa this.visitInContext

    if (!valueToAggregateSql) {
      throw new Error(`Não foi possível traduzir o seletor de 'min': ${lambda.body.toString()}`);
    }

    // Cria a função SQL MIN
    const minFunction = new SqlFunctionCallExpression("MIN", [valueToAggregateSql]);
    // Define a projeção
    const minProjection = new ProjectionExpression(
      minFunction,
      "min_result" // Alias padrão
    );

    // MIN é uma agregação terminal.
    const aggregationAlias = this.aliasGenerator.generateAlias("min");

    // Cria a SelectExpression final
    return new SelectExpression(
      aggregationAlias, // Alias da Select
      [minProjection], // Projeção: SELECT MIN(...) AS [min_result]
      currentSelect.from, // Mantém FROM
      currentSelect.predicate, // Mantém WHERE
      null, // HAVING
      currentSelect.joins, // Mantém Joins
      [], // ORDER BY removido
      null, // OFFSET removido
      null, // LIMIT removido
      [] // GROUP BY removido
    );
  }
}
