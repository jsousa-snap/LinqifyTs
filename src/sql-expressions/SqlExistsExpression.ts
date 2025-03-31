// --- START OF FILE src/sql-expressions/SqlExistsExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { SelectExpression, SelectExpressionMetadata } from "./SelectExpression"; // Importar SelectExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";

// Nova interface de metadados para SqlExistsExpression
export interface SqlExistsExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Exists;
  selectExpression: SelectExpressionMetadata; // Metadados da subquery SELECT
}

/**
 * Representa uma cláusula SQL EXISTS(subquery).
 */
export class SqlExistsExpression extends SqlExpression {
  public readonly type = SqlExpressionType.Exists;

  constructor(public readonly selectExpression: SelectExpression) {
    super();
    if (!selectExpression) {
      throw new Error("SelectExpression cannot be null for EXISTS.");
    }
  }

  toString(): string {
    // ... (inalterado) ...
    const subQueryStr = this.selectExpression
      .toString()
      .split("\n")
      .map((line) => "  " + line)
      .join("\n");
    return `EXISTS (\n${subQueryStr}\n)`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  toMetadata(): SqlExistsExpressionMetadata {
    return {
      $type: SqlExpressionType.Exists,
      selectExpression: this.selectExpression.toMetadata(), // Metadados da SelectExpression
    };
  }
}
