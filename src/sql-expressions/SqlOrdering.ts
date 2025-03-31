// --- START OF FILE src/sql-expressions/SqlOrdering.ts ---

// src/sql-expressions/SqlOrdering.ts

import { SqlExpression } from "./SqlExpression";

export type SortDirection = "ASC" | "DESC";

/**
 * Representa um único termo de ordenação na cláusula ORDER BY.
 * (Usado dentro de SelectExpression)
 */
export interface SqlOrdering {
  /** A expressão SQL que calcula o valor a ser ordenado (ex: ColumnExpression). */
  expression: SqlExpression;
  /** A direção da ordenação (ASC ou DESC). */
  direction: SortDirection;
}

// --- END OF FILE src/sql-expressions/SqlOrdering.ts ---
