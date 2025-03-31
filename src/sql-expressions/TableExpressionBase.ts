// --- START OF FILE src/sql-expressions/TableExpressionBase.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";

export interface TableExpressionBaseMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Table | SqlExpressionType.Union; // Mantém a exigência específica
  alias: string;
}

/**
 * Classe base abstrata para fontes de dados que podem aparecer na cláusula FROM
 * e receber um alias (Tabelas, Subqueries, UNIONs, etc.).
 *
 * @abstract
 * @class TableExpressionBase
 * @extends {SqlExpression}
 */
export abstract class TableExpressionBase extends SqlExpression {
  public readonly alias: string;

  protected constructor(alias: string) {
    super();
    if (!alias) {
      throw new Error("TableExpressionBase requires an alias.");
    }
    this.alias = alias;
  }

  // *** CORREÇÃO: Estreitar o tipo abstrato aqui ***
  // Exige que as classes filhas definam o tipo como Table ou Union
  abstract override readonly type:
    | SqlExpressionType.Table
    | SqlExpressionType.Union;
  abstract override toString(): string;

  toMetadata(): TableExpressionBaseMetadata {
    return {
      // Agora esta atribuição é válida, pois 'this.type'
      // é garantido ser SqlExpressionType.Table ou SqlExpressionType.Union
      $type: this.type,
      alias: this.alias,
    };
  }
}

// --- END OF FILE src/sql-expressions/TableExpressionBase.ts ---
