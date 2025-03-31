// --- START OF FILE src/sql-expressions/TableExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { escapeIdentifier } from "../query/generation/utils/sqlUtils";
import {
  TableExpressionBase,
  TableExpressionBaseMetadata,
} from "./TableExpressionBase"; // Importar TableExpressionBase e seus metadados
import { SqlExpressionType } from "./SqlExpressionType";

// Nova interface de metadados para TableExpression (opicional, só para type safety extra)
export interface TableExpressionMetadata extends TableExpressionBaseMetadata {
  $type: SqlExpressionType.Table;
  name: string;
}

export class TableExpression extends TableExpressionBase {
  public override readonly type = SqlExpressionType.Table;

  constructor(public readonly name: string, public readonly alias: string) {
    super(alias); // Passa o alias para a classe base
    if (!name) throw new Error("Table name cannot be empty.");
    if (!alias) throw new Error("Table alias cannot be empty.");
  }

  toString(): string {
    return `${escapeIdentifier(this.name)} AS ${escapeIdentifier(this.alias)}`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  override toMetadata(): TableExpressionMetadata {
    return {
      ...super.toMetadata(), // Inclui metadados da base (alias e type)
      $type: SqlExpressionType.Table, // Redefine para Table (era Union ou Table na base)
      name: this.name, // Adiciona 'name' específico de TableExpression
    };
  }
}

// --- END OF FILE src/sql-expressions/TableExpression.ts ---
