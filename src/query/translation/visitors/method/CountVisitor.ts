// src/query/translation/visitors/method/CountVisitor.ts

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
  SqlBinaryExpression,
  SqlConstantExpression,
  ProjectionExpression,
  SqlFunctionCallExpression,
  // SqlDataSource -- REMOVIDO DAQUI
} from "../../../../sql-expressions";
// <<< CORREÇÃO: SqlDataSource VEM de TranslationContext >>>
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor
import { OperatorType } from "../../../generation/utils/sqlUtils"; // Para combinar predicados

/**
 * Traduz uma chamada de método LINQ `count()` ou `count(predicate)`
 * para uma SelectExpression que calcula `COUNT_BIG(*)`.
 *
 * Herda de `MethodVisitor`.
 */
export class CountVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de CountVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param visitInContext Função para visitar a lambda do predicado (se houver).
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
   * Aplica a lógica do `count` ou `count(predicate)`.
   * @param expression A expressão de chamada do método `count` ou `countAsync`.
   * @param currentSelect A SelectExpression base sobre a qual contar.
   * @param sourceForLambda A fonte de dados para resolver o predicado (se houver).
   * @returns Uma nova SelectExpression que calcula a contagem.
   * @throws {Error} Se argumentos inválidos ou falha na tradução do predicado.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    sourceForLambda: SqlDataSource // Necessário apenas se houver predicado
  ): SelectExpression {
    const methodName = expression.methodName.replace(/Async$/, ""); // Remove Async suffix
    // Validação
    if (methodName !== "count") {
      throw new Error("CountVisitor só pode traduzir chamadas 'count' ou 'countAsync'.");
    }

    let finalPredicate = currentSelect.predicate;

    // Verifica se há um predicado (ex: .Count(u => u.IsActive))
    if (expression.args.length > 0) {
      if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
        throw new Error("Argumento inválido para 'count' com predicado. Esperada uma lambda.");
      }
      const lambda = expression.args[0] as LinqLambdaExpression;
      if (lambda.parameters.length !== 1) {
        throw new Error("A lambda do predicado de 'count' deve ter exatamente um parâmetro.");
      }
      const param = lambda.parameters[0];

      // Cria contexto filho e visita o predicado
      // <<< Usa SqlDataSource importado de TranslationContext >>>
      const predicateContext = this.context.createChildContext([param], [sourceForLambda]);
      const predicateSql = this.visitInContext(lambda.body, predicateContext); // Usa this.visitInContext

      if (!predicateSql) {
        throw new Error(`Não foi possível traduzir o predicado de 'count': ${lambda.body.toString()}`);
      }

      // Combina com o predicado WHERE existente usando AND
      finalPredicate = currentSelect.predicate
        ? new SqlBinaryExpression(currentSelect.predicate, OperatorType.And, predicateSql)
        : predicateSql;
    }

    // Cria a função SQL COUNT_BIG(1)
    // Usar 1 é geralmente mais seguro e performático que *.
    const countFunction = new SqlFunctionCallExpression("COUNT_BIG", [new SqlConstantExpression(1)]);
    // Define a projeção para conter apenas o resultado do COUNT
    const countProjection = new ProjectionExpression(
      countFunction,
      "count_result" // Alias padrão para o resultado da contagem
    );

    // COUNT é uma agregação terminal, retorna uma nova SelectExpression focada nisso.
    // O alias externo geralmente não é necessário/usado.
    const aggregationAlias = this.aliasGenerator.generateAlias("count"); // Alias interno para o SELECT

    // Cria a SelectExpression final que realiza a contagem
    return new SelectExpression(
      aggregationAlias, // Alias da Select
      [countProjection], // Projeção: SELECT COUNT_BIG(1) AS [count_result]
      currentSelect.from, // Mantém FROM original
      finalPredicate, // WHERE original + predicado do Count (se houver)
      null, // HAVING não se aplica a Count simples
      currentSelect.joins, // Mantém Joins originais
      [], // ORDER BY removido (não faz sentido)
      null, // OFFSET removido
      null, // LIMIT removido
      [] // GROUP BY removido (não faz sentido para Count simples)
    );
    // Nota: Count após GroupBy é tratado de forma diferente (geralmente no resultSelector do GroupBy).
  }
}
