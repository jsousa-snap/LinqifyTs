// src/query/translation/visitors/fundamental/ConstantVisitor.ts

import { ConstantExpression as LinqConstantExpression } from "../../../../expressions";
import { SqlExpression, TableExpression, SqlConstantExpression } from "../../../../sql-expressions";
import { getTableName } from "../../../generation/utils/sqlUtils";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";
// Não precisa de AliasGenerator, VisitFn, TranslationContext nos imports diretos
// pois são herdados/acessados via 'this' da classe base.

/**
 * Traduz uma ConstantExpression LINQ para SQL.
 * Pode representar uma Tabela (TableExpression) ou um valor literal (SqlConstantExpression).
 */
export class ConstantVisitor extends BaseExpressionVisitor<LinqConstantExpression, SqlExpression> {
  /**
   * Traduz a ConstantExpression.
   * @param expression A expressão constante LINQ.
   * @returns Uma TableExpression se for uma tabela, ou SqlConstantExpression para outros valores.
   * @throws {Error} Se não conseguir determinar o nome da tabela a partir da expressão.
   */
  translate(expression: LinqConstantExpression): SqlExpression {
    const value = expression.value;
    // Verifica se o valor é um objeto especial marcando uma tabela
    if (value && typeof value === "object" && (value as any).type === "Table") {
      const tableName = getTableName(expression);
      if (!tableName) {
        // Lança um erro claro se o nome da tabela não puder ser extraído
        throw new Error(
          "Não foi possível obter o nome da tabela a partir de ConstantExpression. Verifique se o valor possui a propriedade 'tableName' ou se a estrutura está correta."
        );
      }
      // Gera um alias para a tabela usando o gerador da classe base (this.aliasGenerator)
      const alias = this.aliasGenerator.generateAlias(tableName);
      return new TableExpression(tableName, alias);
    } else {
      // Se não for uma tabela, é um valor constante literal
      return new SqlConstantExpression(value);
    }
  }
}
