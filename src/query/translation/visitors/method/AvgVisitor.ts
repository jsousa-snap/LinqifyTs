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
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor

/**
 * Traduz uma chamada de método LINQ `avg(selector)`
 * para uma SelectExpression que calcula `AVG(expression)`.
 *
 * Herda de `MethodVisitor`.
 */
export class AvgVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de AvgVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param visitInContext Função para visitar a lambda do seletor.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // Necessário para super
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    // Passa delegates para MethodVisitor
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `avg`.
   * @param expression A expressão de chamada do método `avg` ou `avgAsync`.
   * @param currentSelect A SelectExpression base sobre a qual calcular a média.
   * @param sourceForLambda A fonte de dados para resolver o seletor.
   * @returns Uma nova SelectExpression que calcula a média.
   * @throws {Error} Se argumentos inválidos ou falha na tradução do seletor.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    sourceForLambda: SqlDataSource
  ): SelectExpression {
    const methodName = expression.methodName.replace(/Async$/, ""); // Remove Async
    // Validação
    if (methodName !== "avg") {
      throw new Error("AvgVisitor só pode traduzir chamadas 'avg' ou 'avgAsync'.");
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Argumento inválido para 'avg'. Esperada uma lambda (seletor).");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error("A lambda do seletor de 'avg' deve ter exatamente um parâmetro.");
    }
    const param = lambda.parameters[0]; // Parâmetro da lambda (ex: u)

    // Cria contexto filho e visita o seletor (a expressão a ser agregada)
    const selectorContext = this.context.createChildContext([param], [sourceForLambda]);
    const valueToAggregateSql = this.visitInContext(lambda.body, selectorContext); // Usa this.visitInContext

    if (!valueToAggregateSql) {
      throw new Error(`Não foi possível traduzir o seletor de 'avg': ${lambda.body.toString()}`);
    }

    // Cria a função SQL AVG
    const avgFunction = new SqlFunctionCallExpression("AVG", [valueToAggregateSql]);
    // Define a projeção para conter apenas o resultado do AVG
    const avgProjection = new ProjectionExpression(
      avgFunction,
      "avg_result" // Alias padrão
    );

    // AVG é uma agregação terminal.
    const aggregationAlias = this.aliasGenerator.generateAlias("avg"); // Alias interno para o SELECT

    // Cria a SelectExpression final que calcula a média
    return new SelectExpression(
      aggregationAlias, // Alias da Select
      [avgProjection], // Projeção: SELECT AVG(...) AS [avg_result]
      currentSelect.from, // Mantém FROM original
      currentSelect.predicate, // Mantém WHERE original
      null, // HAVING não se aplica a AVG simples
      currentSelect.joins, // Mantém Joins originais
      [], // ORDER BY removido
      null, // OFFSET removido
      null, // LIMIT removido
      [] // GROUP BY removido (AVG simples não agrupa)
    );
  }
}
