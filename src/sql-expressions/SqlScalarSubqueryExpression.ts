// src/sql-expressions/SqlScalarSubqueryExpression.ts

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { SelectExpression, SelectExpressionMetadata } from "./SelectExpression"; // Importar SelectExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";

// Nova interface de metadados para SqlScalarSubqueryExpression
export interface SqlScalarSubqueryExpressionMetadata
  extends SqlExpressionMetadata {
  $type: SqlExpressionType.ScalarSubquery;
  selectExpression: SelectExpressionMetadata; // Metadados da SelectExpression interna
}

export class SqlScalarSubqueryExpression extends SqlExpression {
  public readonly type = SqlExpressionType.ScalarSubquery;

  public readonly selectExpression: SelectExpression;

  constructor(selectExpression: SelectExpression) {
    super();
    if (!selectExpression) {
      throw new Error(
        "SelectExpression cannot be null for SqlScalarSubqueryExpression."
      );
    }
    this.selectExpression = selectExpression;
  }

  toString(): string {
    const subQueryStr = this.selectExpression.toString();

    return `(${subQueryStr})`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  toMetadata(): SqlScalarSubqueryExpressionMetadata {
    return {
      $type: SqlExpressionType.ScalarSubquery,
      selectExpression: this.selectExpression.toMetadata(), // Metadados da SelectExpression
    };
  }
}
