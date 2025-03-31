// src/sql-expressions/SqlLikeExpression.ts

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import {
  SqlConstantExpression,
  SqlConstantExpressionMetadata,
} from "./SqlConstantExpression"; // Importar SqlConstantExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";

// Nova interface de metadados para SqlLikeExpression
export interface SqlLikeExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Like;
  sourceExpression: SqlExpressionMetadata; // Metadados da expressão fonte
  patternExpression: SqlConstantExpressionMetadata; // Metadados da expressão de padrão (constante)
}

/**
 * Representa uma operação SQL LIKE.
 * ex: coluna LIKE padrao
 */
export class SqlLikeExpression extends SqlExpression {
  public readonly type = SqlExpressionType.Like; // Novo tipo

  constructor(
    public readonly sourceExpression: SqlExpression,
    public readonly patternExpression: SqlConstantExpression
  ) {
    super();
    if (!sourceExpression) {
      throw new Error("Source expression cannot be null for LIKE.");
    }
    if (
      !patternExpression ||
      !(patternExpression instanceof SqlConstantExpression)
    ) {
      throw new Error(
        "Pattern expression must be a SqlConstantExpression for LIKE."
      );
    }
  }

  toString(): string {
    // Debug string
    return `(${this.sourceExpression.toString()} LIKE ${this.patternExpression.toString()})`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  toMetadata(): SqlLikeExpressionMetadata {
    return {
      $type: SqlExpressionType.Like,
      sourceExpression: this.sourceExpression.toMetadata(), // Metadados da fonte
      patternExpression: this.patternExpression.toMetadata(), // Metadados do padrão
    };
  }
}
