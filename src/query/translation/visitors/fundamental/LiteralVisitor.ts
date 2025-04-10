import { LiteralExpression as LinqLiteralExpression } from "../../../../expressions";
import { SqlConstantExpression } from "../../../../sql-expressions";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";

/**
 * Traduz uma LiteralExpression LINQ (que representa um valor literal
 * diretamente na árvore de expressão) para uma SqlConstantExpression.
 */
export class LiteralVisitor extends BaseExpressionVisitor<LinqLiteralExpression, SqlConstantExpression> {
  /**
   * Traduz a LiteralExpression.
   * @param expression A expressão literal LINQ.
   * @returns Uma SqlConstantExpression contendo o valor literal.
   */
  translate(expression: LinqLiteralExpression): SqlConstantExpression {
    // Simplesmente envolve o valor da expressão literal em uma SqlConstantExpression
    return new SqlConstantExpression(expression.value);
  }
}
