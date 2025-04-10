// --- START OF FILE src/sql-expressions/SqlInExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { SqlConstantExpression, SqlConstantExpressionMetadata } from "./SqlConstantExpression";
import { SqlExpressionType } from "./SqlExpressionType";
// Importar SelectExpressionMetadata se/quando suportarmos subqueries IN
// import { SelectExpressionMetadata } from './SelectExpression';

/**
 * Interface de metadados para SqlInExpression.
 */
export interface SqlInExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.In;
  /** A expressão cujo valor será verificado (geralmente uma coluna). */
  expression: SqlExpressionMetadata;
  /**
   * Os valores a serem verificados.
   * Atualmente suporta apenas um array de constantes.
   * Poderia ser estendido para suportar SqlSelectExpressionMetadata para subqueries.
   */
  values: ReadonlyArray<SqlConstantExpressionMetadata>; // | SqlSelectExpressionMetadata;
}

/**
 * Representa uma operação SQL IN (expression IN (value1, value2, ...)).
 */
export class SqlInExpression extends SqlExpression {
  public override readonly type = SqlExpressionType.In;

  /**
   * Cria uma instância de SqlInExpression.
   * @param expression A expressão cujo valor será verificado (ex: coluna).
   * @param values Um array de SqlConstantExpression representando os valores no IN.
   *               Pode ser estendido para aceitar SqlSelectExpression.
   */
  constructor(
    public readonly expression: SqlExpression,
    // Por enquanto, força array de constantes. Pode ser Union Type no futuro.
    public readonly values: ReadonlyArray<SqlConstantExpression>
  ) {
    super();
    if (!expression) {
      throw new Error("Expression cannot be null for SqlInExpression.");
    }
    if (!values || values.length === 0) {
      // SQL padrão não suporta IN com lista vazia.
      throw new Error(
        "Value list for SqlInExpression cannot be null or empty. Use a condition like 1=0 instead for empty lists."
      );
    }
    // Validação adicional (opcional): Verificar se todos os elementos são SqlConstantExpression
    if (!values.every((v) => v instanceof SqlConstantExpression)) {
      throw new Error("Currently, SqlInExpression only supports an array of SqlConstantExpression values.");
    }
  }

  /**
   * Retorna a representação em string para depuração.
   */
  override toString(): string {
    const valuesStr = this.values.map((v) => v.toString()).join(", ");
    return `(${this.expression.toString()} IN (${valuesStr}))`;
  }

  /**
   * Converte a expressão para metadados serializáveis.
   */
  override toMetadata(): SqlInExpressionMetadata {
    return {
      $type: SqlExpressionType.In,
      expression: this.expression.toMetadata(),
      values: this.values.map((v) => v.toMetadata()), // Mapeia valores para seus metadados
    };
  }
}
// --- END OF FILE src/sql-expressions/SqlInExpression.ts ---
