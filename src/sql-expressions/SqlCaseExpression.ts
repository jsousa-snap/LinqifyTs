// --- START OF FILE src/sql-expressions/SqlCaseExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { SqlExpressionType } from "./SqlExpressionType";

/**
 * Representa uma única cláusula WHEN ... THEN ... em uma expressão CASE.
 */
export interface SqlCaseWhen {
  when: SqlExpression;
  then: SqlExpression;
}

export interface SqlCaseExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Case;
  // operand?: SqlExpressionMetadata | null; // Para CASE simples (CASE x WHEN 1 THEN 'a') - Não implementado ainda
  whenClauses: { when: SqlExpressionMetadata; then: SqlExpressionMetadata }[];
  elseExpression: SqlExpressionMetadata | null;
}

/**
 * Representa uma expressão SQL CASE WHEN ... THEN ... ELSE ... END.
 * Atualmente suporta apenas a forma pesquisada (CASE WHEN condition THEN result ...).
 */
export class SqlCaseExpression extends SqlExpression {
  public override readonly type = SqlExpressionType.Case;

  /**
   * Cria uma instância de SqlCaseExpression.
   * @param operand A expressão a ser comparada em um CASE simples (opcional, não usado na forma pesquisada).
   * @param whenClauses Uma array de cláusulas WHEN/THEN.
   * @param elseExpression A expressão para a cláusula ELSE (pode ser null).
   */
  constructor(
    // public readonly operand: SqlExpression | null, // Para CASE simples
    public readonly whenClauses: ReadonlyArray<SqlCaseWhen>,
    public readonly elseExpression: SqlExpression | null
  ) {
    super();
    if (!whenClauses || whenClauses.length === 0) {
      throw new Error("CASE expression must have at least one WHEN clause.");
    }
  }

  toString(): string {
    let result = "CASE";
    // if (this.operand) {
    //     result += ` ${this.operand.toString()}`; // Para CASE simples
    // }
    this.whenClauses.forEach((wc) => {
      result += ` WHEN ${wc.when.toString()} THEN ${wc.then.toString()}`;
    });
    if (this.elseExpression) {
      result += ` ELSE ${this.elseExpression.toString()}`;
    }
    result += " END";
    return result;
  }

  toMetadata(): SqlCaseExpressionMetadata {
    return {
      $type: SqlExpressionType.Case,
      // operand: this.operand?.toMetadata() ?? null,
      whenClauses: this.whenClauses.map((wc) => ({
        when: wc.when.toMetadata(),
        then: wc.then.toMetadata(),
      })),
      elseExpression: this.elseExpression?.toMetadata() ?? null,
    };
  }
}
// --- END OF FILE src/sql-expressions/SqlCaseExpression.ts ---
