// --- START OF FILE src/sql-expressions/ColumnExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { TableExpression, TableExpressionMetadata } from "./TableExpression"; // Importar TableExpression e seus metadados
import { escapeIdentifier } from "../query/generation/utils/sqlUtils";
import { SqlExpressionType } from "./SqlExpressionType";

// Nova interface de metadados para ColumnExpression
export interface ColumnExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Column;
  name: string;
  table: TableExpressionMetadata; // Metadados de TableExpression
}

export class ColumnExpression extends SqlExpression {
  public readonly type = SqlExpressionType.Column;

  constructor(
    public readonly name: string,
    public readonly table: TableExpression // Referência à tabela dona da coluna
  ) {
    super();
    if (!name) throw new Error("Column name cannot be empty.");
    if (!table) throw new Error("Column must belong to a table.");
  }

  toString(): string {
    return `${escapeIdentifier(this.table.alias)}.${escapeIdentifier(this.name)}`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  toMetadata(): ColumnExpressionMetadata {
    return {
      $type: SqlExpressionType.Column,
      name: this.name,
      table: this.table.toMetadata(), // Metadados da TableExpression
    };
  }
}

// --- END OF FILE src/sql-expressions/ColumnExpression.ts ---
