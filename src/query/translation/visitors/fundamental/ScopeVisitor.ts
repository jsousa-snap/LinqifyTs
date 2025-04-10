// src/query/translation/visitors/fundamental/ScopeVisitor.ts

import { ScopeExpression as LinqScopeExpression } from "../../../../expressions";
import { SqlExpression } from "../../../../sql-expressions";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";

/**
 * Traduz uma ScopeExpression LINQ, que geralmente é usada internamente
 * pelo construtor de queries para gerenciar escopos de parâmetros.
 * Na tradução SQL, normalmente apenas visitamos a expressão interna.
 */
export class ScopeVisitor extends BaseExpressionVisitor<LinqScopeExpression, SqlExpression> {
  /**
   * Traduz a ScopeExpression visitando sua expressão interna (`sourceExpression`).
   * @param expression A expressão de escopo LINQ.
   * @returns A tradução SQL da expressão interna, ou null se a interna for null.
   * @throws {Error} Se a tradução da expressão interna falhar (retornar null inesperadamente).
   */
  translate(expression: LinqScopeExpression): SqlExpression | null {
    // Visita a expressão contida dentro do escopo,
    // <<< CORREÇÃO: Passando o contexto atual (this.context) >>>
    const innerSql = this.visitSubexpression(expression.sourceExpression, this.context);

    // Embora visitSubexpression possa retornar null se a entrada for null,
    // uma ScopeExpression geralmente não deve conter uma sourceExpression nula.
    // Lançamos um erro se a tradução da interna falhar inesperadamente.
    if (!innerSql && expression.sourceExpression) {
      throw new Error(
        `Falha ao traduzir a expressão interna de ScopeExpression: ${expression.sourceExpression?.toString()}`
      );
    }

    // Retorna o resultado da visita da expressão interna.
    return innerSql;
  }
}
