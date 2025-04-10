/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  MethodCallExpression as LinqMethodCallExpression,
  Expression as LinqExpression,
} from "../../../../expressions";
import { SelectExpression, ProjectionExpression, SqlExpression } from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor";

/**
 * Traduz chamadas de método LINQ `ToList` ou `ToListAsync`.
 * Geralmente, isso não altera a estrutura da consulta SQL, mas marca a
 * SelectExpression final com um alias para sinalizar a execução e materialização
 * para o executor da query.
 *
 * Herda de `MethodVisitor` por conveniência, embora não utilize `sourceForLambda`.
 */
export class ToListVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /** Cria uma instância de ToListVisitor. */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // Necessário para super
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `toList`. Essencialmente marca a SelectExpression.
   * @param expression A expressão de chamada do método `ToList` ou `ToListAsync`.
   * @param currentSelect A SelectExpression SQL atual.
   * @param _sourceForLambda Não utilizado por ToListVisitor.
   * @returns A SelectExpression original, com alias atualizados para indicar a intenção.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    _sourceForLambda: SqlDataSource
  ): SelectExpression {
    const methodName = expression.methodName.replace(/Async$/, ""); // Remove Async
    // Validação
    if (methodName !== "toList") {
      throw new Error("ToListVisitor só pode traduzir chamadas 'toList' ou 'ToListAsync'.");
    }
    if (expression.args.length !== 0) {
      // ToList() não tem argumentos no LINQ to Objects/EF Core
      console.warn(`'${expression.methodName}' chamado com argumentos inesperados. Ignorando argumentos.`);
    }

    // ToList/ToListAsync geralmente não muda a consulta SQL.
    // Apenas sinaliza a execução e materialização.
    // Adicionamos um alias para indicar isso, caso o executor precise saber.
    const resultAlias = "toList_result";

    // Atualiza projeções para usar o alias de resultado se não tiverem um explícito
    const finalProjections = currentSelect.projection.map((p) => {
      const useExistingAlias = p.alias && p.alias !== "*";
      // Mantém alias existente ou usa 'toList_result'
      return new ProjectionExpression(p.expression, useExistingAlias ? p.alias : resultAlias);
    });

    // Gera um alias para o SELECT externo
    const finalSelectAlias = this.aliasGenerator.generateAlias("list");

    // Retorna a SelectExpression com os alias atualizados, mas estrutura idêntica.
    return new SelectExpression(
      finalSelectAlias, // Alias indicando ToList
      finalProjections, // Projeções marcadas
      currentSelect.from, // Mantém FROM
      currentSelect.predicate, // Mantém WHERE
      currentSelect.having, // Mantém HAVING
      currentSelect.joins, // Mantém Joins
      currentSelect.orderBy, // Mantém OrderBy
      currentSelect.offset, // Mantém Offset
      currentSelect.limit, // Mantém Limit
      currentSelect.groupBy // Mantém GroupBy
    );
  }
}
