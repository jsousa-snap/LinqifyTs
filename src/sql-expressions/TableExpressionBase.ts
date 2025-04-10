import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { SqlExpressionType } from "./SqlExpressionType";

export interface TableExpressionBaseMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Table | SqlExpressionType.Union | SqlExpressionType.Select;
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
      this.alias = "";
    } else {
      this.alias = alias;
    }
  }

  abstract override readonly type: SqlExpressionType.Table | SqlExpressionType.Union | SqlExpressionType.Select;

  abstract override toString(): string;

  toMetadata(): TableExpressionBaseMetadata {
    return {
      $type: this.type,
      alias: this.alias,
    };
  }
}
