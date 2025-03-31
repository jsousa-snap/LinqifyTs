// --- START OF FILE src/sql-expressions/JoinExpressionBase.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { TableExpression, TableExpressionMetadata } from "./TableExpression";
import { SqlExpressionType } from "./SqlExpressionType"; // Importar SqlExpressionType

// A interface de metadados base continua esperando um tipo de JOIN
export interface JoinExpressionBaseMetadata extends SqlExpressionMetadata {
  // *** ATENÇÃO: Se adicionar outros Joins (Left, Right), adicione-os aqui ***
  $type: SqlExpressionType.InnerJoin; // Por enquanto, apenas InnerJoin existe
  table: TableExpressionMetadata; // Metadados da tabela JOINED
  joinPredicate: SqlExpressionMetadata; // Metadados do predicado ON
}

export abstract class JoinExpressionBase extends SqlExpression {
  protected constructor(
    public readonly table: TableExpression,
    public readonly joinPredicate: SqlExpression
  ) {
    super();
    if (!table) throw new Error("Join table cannot be null.");
    if (!joinPredicate) throw new Error("Join predicate cannot be null.");
  }

  // *** CORREÇÃO: Estreitar o tipo abstrato aqui ***
  // Exige que as classes filhas definam o tipo como um dos tipos de JOIN válidos.
  // *** ATENÇÃO: Se adicionar outros Joins (Left, Right), adicione-os aqui ***
  abstract override readonly type: SqlExpressionType.InnerJoin;

  abstract override toString(): string;

  toMetadata(): JoinExpressionBaseMetadata {
    return {
      // Esta atribuição agora é válida porque 'this.type'
      // é garantido ser um dos tipos de JOIN permitidos.
      $type: this.type,
      table: this.table.toMetadata(),
      joinPredicate: this.joinPredicate.toMetadata(),
    };
  }
}

// --- END OF FILE src/sql-expressions/JoinExpressionBase.ts ---
