// src/query/translation/visitors/method/IncludesVisitor.ts

import { MethodCallExpression as LinqMethodCallExpression } from "../../../../expressions";
import { SqlExpression, SqlInExpression, SqlLikeExpression, SqlConstantExpression } from "../../../../sql-expressions";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";

/**
 * Traduz uma chamada de método `includes`.
 * Tenta primeiro traduzir como `array.includes(value)` para SQL `IN`.
 * Se falhar, tenta traduzir como `string.includes(value)` para SQL `LIKE`.
 *
 * Herda de `BaseExpressionVisitor` porque o resultado pode ser `SqlInExpression` ou `SqlLikeExpression`,
 * e ele não modifica um `SelectExpression` existente.
 */
export class IncludesVisitor extends BaseExpressionVisitor<LinqMethodCallExpression, SqlExpression> {
  // Retorna SqlExpression genérico

  /**
   * Traduz a chamada de método 'includes'.
   * @param expression A expressão de chamada do método.
   * @returns SqlInExpression (para arrays) ou SqlLikeExpression (para strings).
   * @throws {Error} Se não for uma chamada 'includes' válida ou se a tradução falhar.
   */
  translate(expression: LinqMethodCallExpression): SqlExpression {
    if (expression.methodName !== "includes") {
      throw new Error("IncludesVisitor só pode traduzir chamadas 'includes'.");
    }
    if (!expression.source || expression.args.length !== 1) {
      throw new Error("Chamada 'includes' inválida. Requer uma fonte e um argumento.");
    }

    // --- Tentativa 1: Array Includes (IN) ---
    const arrayInSql = this.tryTranslateArrayIn(expression);
    if (arrayInSql) {
      return arrayInSql; // Sucesso! Retorna SqlInExpression
    }

    // --- Tentativa 2: String Includes (LIKE) ---
    const stringLikeSql = this.tryTranslateStringLike(expression);
    if (stringLikeSql) {
      return stringLikeSql; // Sucesso! Retorna SqlLikeExpression
    }

    // --- Falha ---
    // Se chegou aqui, não conseguiu traduzir nem como array nem como string.
    throw new Error(
      `Não foi possível traduzir a chamada 'includes'. Verifique se a fonte é um array constante ou uma string, e se o argumento é apropriado. Fonte: ${expression.source.toString()}, Arg: ${expression.args[0].toString()}`
    );
  }

  /**
   * Tenta traduzir como array.includes(value) -> IN (...)
   * Retorna null se não for aplicável.
   */
  private tryTranslateArrayIn(expression: LinqMethodCallExpression): SqlInExpression | null {
    // Reusa a lógica do antigo IncludesArrayVisitor.tryTranslate
    const arraySourceSql = this.visitSubexpression(expression.source!, this.context); // source não é null aqui
    const valueToFindSql = this.visitSubexpression(expression.args[0], this.context);

    if (arraySourceSql instanceof SqlConstantExpression && Array.isArray(arraySourceSql.value) && valueToFindSql) {
      const valuesArray = arraySourceSql.value as unknown[]; // Usar unknown em vez de any
      if (valuesArray.length === 0) {
        // Nota: SQL IN com lista vazia geralmente resulta em FALSE.
        // Poderíamos retornar uma expressão FALSE aqui, mas lançar erro pode ser mais explícito.
        throw new Error("Erro de Tradução: O array fornecido para 'includes' (SQL IN) não pode estar vazio.");
      }
      const constantValuesSql = valuesArray.map((val) => new SqlConstantExpression(val));
      return new SqlInExpression(valueToFindSql, constantValuesSql);
    }
    return null; // Não aplicável como array.includes
  }

  /**
   * Tenta traduzir como string.includes(value) -> LIKE '%...%'
   * Retorna null se não for aplicável (ex: argumento não constante).
   */
  private tryTranslateStringLike(expression: LinqMethodCallExpression): SqlLikeExpression | null {
    // Reusa a lógica do antigo IncludesStringVisitor.translate
    const sourceSql = this.visitSubexpression(expression.source!, this.context); // source não é null
    const argumentSql = this.visitSubexpression(expression.args[0], this.context);

    if (!sourceSql) return null; // Não conseguiu traduzir a fonte

    let literalValueToEscape: string;
    if (argumentSql instanceof SqlConstantExpression && typeof argumentSql.value === "string") {
      literalValueToEscape = argumentSql.value;
    } else {
      // Se o argumento não for uma string constante, não podemos traduzir para LIKE literal.
      // Poderia ser estendido para suportar colunas no argumento com CONCAT, mas por enquanto retorna null.
      console.warn(
        `'string.includes' com argumento não-constante não suportado para LIKE. Arg: ${expression.args[0].toString()}`
      );
      return null;
    }

    const escapedSearchTerm = literalValueToEscape.replace(/\[/g, "[[]").replace(/%/g, "[%]").replace(/_/g, "[_]");
    const pattern = `%${escapedSearchTerm}%`;
    const patternConstant = new SqlConstantExpression(pattern);

    return new SqlLikeExpression(sourceSql, patternConstant);
  }
}
