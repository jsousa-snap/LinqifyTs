// --- START OF FILE src/sql-expressions/InnerJoinExpression.ts ---

import {
  JoinExpressionBase,
  JoinExpressionBaseMetadata,
} from "./JoinExpressionBase"; // Importar JoinExpressionBaseMetadata
import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { TableExpression, TableExpressionMetadata } from "./TableExpression"; // Importar TableExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";
import { escapeIdentifier } from "../query/generation/utils/sqlUtils";

// Nova interface de metadados para InnerJoinExpression (opcional, só para type safety extra)
export interface InnerJoinExpressionMetadata
  extends JoinExpressionBaseMetadata {
  $type: SqlExpressionType.InnerJoin;
}

export class InnerJoinExpression extends JoinExpressionBase {
  public override readonly type = SqlExpressionType.InnerJoin;

  constructor(table: TableExpression, joinPredicate: SqlExpression) {
    super(table, joinPredicate);
  }

  override toString(): string {
    return `INNER JOIN ${this.table.toString()} ON ${this.joinPredicate.toString()}`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  override toMetadata(): InnerJoinExpressionMetadata {
    return {
      ...super.toMetadata(), // Inclui metadados da base (table, joinPredicate, type)
      $type: SqlExpressionType.InnerJoin, // Redefine para InnerJoin (era InnerJoin na base)
    };
  }
}

// --- END OF FILE src/sql-expressions/InnerJoinExpression.ts ---
