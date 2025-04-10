// src/query/translation/visitors/method/SumVisitor.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../../expressions";
// <<< CORREÇÃO: SqlDataSource NÃO vem de sql-expressions >>>
import {
  SqlExpression,
  SelectExpression,
  ProjectionExpression,
  SqlFunctionCallExpression,
  // SqlDataSource -- REMOVIDO DAQUI
} from "../../../../sql-expressions";
// <<< CORREÇÃO: SqlDataSource VEM de TranslationContext >>>
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor

/**
 * Traduz uma chamada de método LINQ `sum(selector)`
 * para uma SelectExpression que calcula `SUM(expression)`.
 *
 * Herda de `MethodVisitor`.
 */
export class SumVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de SumVisitor.
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
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `sum`.
   * @param expression A expressão de chamada do método `sum` ou `sumAsync`.
   * @param currentSelect A SelectExpression base sobre a qual calcular a soma.
   * @param sourceForLambda A fonte de dados para resolver o seletor.
   * @returns Uma nova SelectExpression que calcula a soma.
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
    if (methodName !== "sum") {
      throw new Error("SumVisitor só pode traduzir chamadas 'sum' ou 'sumAsync'.");
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Argumento inválido para 'sum'. Esperada uma lambda (seletor).");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error("A lambda do seletor de 'sum' deve ter exatamente um parâmetro.");
    }
    const param = lambda.parameters[0];

    // Cria contexto filho e visita o seletor
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    const selectorContext = this.context.createChildContext([param], [sourceForLambda]);
    const valueToAggregateSql = this.visitInContext(lambda.body, selectorContext); // Usa this.visitInContext

    if (!valueToAggregateSql) {
      throw new Error(`Não foi possível traduzir o seletor de 'sum': ${lambda.body.toString()}`);
    }

    // Cria a função SQL SUM
    const sumFunction = new SqlFunctionCallExpression("SUM", [valueToAggregateSql]);
    // Define a projeção
    const sumProjection = new ProjectionExpression(
      sumFunction,
      "sum_result" // Alias padrão
    );

    // SUM é uma agregação terminal.
    const aggregationAlias = this.aliasGenerator.generateAlias("sum");

    // Cria a SelectExpression final
    return new SelectExpression(
      aggregationAlias, // Alias da Select
      [sumProjection], // Projeção: SELECT SUM(...) AS [sum_result]
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
