import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { SelectExpression, SelectExpressionMetadata } from "./SelectExpression"; // Importar SelectExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";

export interface SqlExistsExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Exists;
  selectExpression: SelectExpressionMetadata;
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
    const subQueryStr = this.selectExpression
      .toString()
      .split("\n")
      .map((line) => "  " + line)
      .join("\n");
    return `EXISTS (\n${subQueryStr}\n)`;
  }

  toMetadata(): SqlExistsExpressionMetadata {
    return {
      $type: SqlExpressionType.Exists,
      selectExpression: this.selectExpression.toMetadata(),
    };
  }
}
