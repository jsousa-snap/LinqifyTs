// --- START OF FILE src/sql-expressions/TableExpressionBase.ts ---

// --- START OF FILE src/sql-expressions/TableExpressionBase.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";

export interface TableExpressionBaseMetadata extends SqlExpressionMetadata {
  // *** CORREÇÃO: Adicionar Select ao tipo base ***
  $type:
    | SqlExpressionType.Table
    | SqlExpressionType.Union
    | SqlExpressionType.Select;
  alias: string;
}

/**
 * Classe base abstrata para fontes de dados que podem aparecer na cláusula FROM
 * e receber um alias (Tabelas, Subqueries SELECT, UNIONs, etc.).
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
      // Permite alias vazio temporariamente durante a construção, mas idealmente deveria ter um
      // console.warn("TableExpressionBase created without an alias.");
      this.alias = ""; // ou lançar erro dependendo da estratégia
    } else {
      this.alias = alias;
    }
  }

  // *** CORREÇÃO: Adicionar Select ao tipo abstrato ***
  abstract override readonly type:
    | SqlExpressionType.Table
    | SqlExpressionType.Union
    | SqlExpressionType.Select; // <<< ADICIONADO Select

  abstract override toString(): string;

  toMetadata(): TableExpressionBaseMetadata {
    return {
      // Agora esta atribuição é válida
      $type: this.type,
      alias: this.alias,
    };
  }
}

// --- END OF FILE src/sql-expressions/TableExpressionBase.ts ---
