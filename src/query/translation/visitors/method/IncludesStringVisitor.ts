import {
  MethodCallExpression as LinqMethodCallExpression,
  ConstantExpression as LinqConstantExpression,
} from "../../../../expressions";
import { SqlExpression, SqlLikeExpression, SqlConstantExpression } from "../../../../sql-expressions";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { TranslationContext } from "../../TranslationContext";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";

/**
 * Traduz uma chamada de método `string.includes(value)` para SQL `LIKE '%value%'`.
 */
export class IncludesStringVisitor extends BaseExpressionVisitor<LinqMethodCallExpression, SqlLikeExpression> {
  /**
   * Traduz a chamada `string.includes` para `SqlLikeExpression`.
   * @param expression A expressão de chamada do método 'includes'.
   * @returns A SqlLikeExpression correspondente.
   * @throws {Error} Se a fonte ou argumento não puderem ser traduzidos, ou se o argumento não for uma string constante.
   */
  translate(expression: LinqMethodCallExpression): SqlLikeExpression {
    if (!expression.source || expression.args.length !== 1) {
      throw new Error("Chamada de método 'includes' inválida. Requer uma fonte (string) e um argumento (valor).");
    }

    const sourceSql = this.visitSubexpression(expression.source);
    if (!sourceSql) {
      throw new Error(`Não foi possível traduzir a expressão fonte para 'includes': ${expression.source.toString()}`);
    }

    const argumentSql = this.visitSubexpression(expression.args[0]);
    let literalValueToEscape: string;

    // Garante que o argumento seja uma string constante
    if (argumentSql instanceof SqlConstantExpression && typeof argumentSql.value === "string") {
      literalValueToEscape = argumentSql.value;
    } else {
      // Pode ser estendido no futuro para suportar colunas ou outras expressões como argumento
      throw new Error(
        `'includes' (string) atualmente suporta apenas um argumento string constante. Encontrado: ${expression.args[0].toString()}`
      );
    }

    // Escapa os caracteres especiais do LIKE na string literal ANTES de adicionar os '%'
    const escapedSearchTerm = literalValueToEscape
      .replace(/\[/g, "[[]") // Escapa [ -> [[]
      .replace(/%/g, "[%]") // Escapa % -> [%]
      .replace(/_/g, "[_]"); // Escapa _ -> [_]

    // Cria o padrão LIKE final: %escaped%
    const pattern = `%${escapedSearchTerm}%`;
    const patternConstant = new SqlConstantExpression(pattern);

    // Retorna a expressão SQL LIKE
    return new SqlLikeExpression(sourceSql, patternConstant);
  }
}
