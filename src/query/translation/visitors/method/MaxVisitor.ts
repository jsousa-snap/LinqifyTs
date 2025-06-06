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
 * Traduz uma chamada de método LINQ `max(selector)`
 * para uma SelectExpression que calcula `MAX(expression)`.
 *
 * Herda de `MethodVisitor`.
 */
export class MaxVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /** Cria uma instância de MaxVisitor. */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // Necessário para super
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /** Aplica a lógica do `max`. */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    sourceForLambda: SqlDataSource
  ): SelectExpression {
    const methodName = expression.methodName.replace(/Async$/, ""); // Remove Async
    // Validação
    if (methodName !== "max") {
      throw new Error("MaxVisitor só pode traduzir chamadas 'max' ou 'maxAsync'.");
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Argumento inválido para 'max'. Esperada uma lambda (seletor).");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error("A lambda do seletor de 'max' deve ter exatamente um parâmetro.");
    }
    const param = lambda.parameters[0];

    // Cria contexto filho e visita o seletor
    const selectorContext = this.context.createChildContext([param], [sourceForLambda]);
    const valueToAggregateSql = this.visitInContext(lambda.body, selectorContext); // Usa this.visitInContext

    if (!valueToAggregateSql) {
      throw new Error(`Não foi possível traduzir o seletor de 'max': ${lambda.body.toString()}`);
    }

    // Cria a função SQL MAX
    const maxFunction = new SqlFunctionCallExpression("MAX", [valueToAggregateSql]);
    // Define a projeção
    const maxProjection = new ProjectionExpression(maxFunction, "max_result");

    // MAX é uma agregação terminal.
    const aggregationAlias = this.aliasGenerator.generateAlias("max");

    return new SelectExpression(
      aggregationAlias,
      [maxProjection],
      currentSelect.from,
      currentSelect.predicate,
      null,
      currentSelect.joins,
      [],
      null,
      null,
      []
    );
  }
}
