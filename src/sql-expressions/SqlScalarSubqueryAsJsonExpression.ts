// src/sql-expressions/SqlScalarSubqueryExpression.ts

import { SqlExpression } from "./SqlExpression";
import { SqlExpressionType } from "./SqlExpressionType";
import { SelectExpression, SelectExpressionMetadata } from "./SelectExpression"; // Importar SelectExpressionMetadata
import { SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata

// Nova interface de metadados para SqlScalarSubqueryAsJsonExpression
export interface SqlScalarSubqueryAsJsonExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.ScalarSubqueryAsJson;
  selectExpression: SelectExpressionMetadata; // Metadados da SelectExpression interna
  mode: JsonMode;
  includeNullValues: boolean;
  withoutArrayWrapper: boolean;
}

/**
 * Enum para modos de formatação JSON (específico para SQL Server 'FOR JSON')
 */
export enum JsonMode {
  Path = "PATH", // FOR JSON PATH
  Auto = "AUTO", // FOR JSON AUTO
}

export class SqlScalarSubqueryAsJsonExpression extends SqlExpression {
  public readonly type = SqlExpressionType.ScalarSubqueryAsJson;
  public readonly selectExpression: SelectExpression;
  public readonly mode: JsonMode;
  public readonly includeNullValues: boolean;
  public readonly withoutArrayWrapper: boolean;

  constructor(
    selectExpression: SelectExpression,
    mode: JsonMode = JsonMode.Path,
    includeNullValues: boolean = true,
    withoutArrayWrapper: boolean = false
  ) {
    super();
    if (!selectExpression) {
      throw new Error("SelectExpression cannot be null for SqlScalarSubqueryAsJsonExpression.");
    }
    this.selectExpression = selectExpression;
    this.mode = mode;
    this.includeNullValues = includeNullValues;
    this.withoutArrayWrapper = withoutArrayWrapper;
  }

  toString(): string {
    // ... (inalterado) ...
    const options: string[] = [];
    if (this.mode) options.push(`MODE=${this.mode}`);
    if (this.includeNullValues) options.push(`INCLUDE_NULL`);
    if (this.withoutArrayWrapper) options.push(`NO_WRAPPER`);

    const subQueryStr = this.selectExpression.toString();
    const optionsStr = options.length > 0 ? ` [${options.join(", ")}]` : "";

    return `(SUBQUERY ${optionsStr}: ${subQueryStr})`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  toMetadata(): SqlScalarSubqueryAsJsonExpressionMetadata {
    return {
      $type: SqlExpressionType.ScalarSubqueryAsJson,
      selectExpression: this.selectExpression.toMetadata(), // Metadados da SelectExpression
      mode: this.mode,
      includeNullValues: this.includeNullValues,
      withoutArrayWrapper: this.withoutArrayWrapper,
    };
  }
}
