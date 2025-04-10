// --- START OF FILE src/sql-expressions/SqlConstantExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { generateSqlLiteral } from "../query/generation/utils/sqlUtils";
import { SqlExpressionType } from "./SqlExpressionType";

// Nova interface de metadados para SqlConstantExpression
export interface SqlConstantExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Constant;
  value: any; // O valor constante
  // sqlType?: string; // Se quiser adicionar tipo SQL
}

export class SqlConstantExpression extends SqlExpression {
  public readonly type = SqlExpressionType.Constant;

  constructor(public readonly value: any) {
    super();
    const typeofValue = typeof value;
    if (
      value !== null &&
      typeofValue !== "string" &&
      typeofValue !== "number" &&
      typeofValue !== "boolean" &&
      !(value instanceof Date)
    ) {
      console.warn(`SqlConstantExpression created with potentially unsupported type: ${typeofValue}`);
    }
  }

  toString(): string {
    try {
      return generateSqlLiteral(this.value);
    } catch (e: any) {
      return `(Error generating literal: ${e.message})`;
    }
  }

  // *** IMPLEMENTAR toMetadata() ***
  toMetadata(): SqlConstantExpressionMetadata {
    return {
      $type: SqlExpressionType.Constant,
      value: this.value, // Inclui o valor constante
      // sqlType: this.sqlType // Se adicionarmos sqlType
    };
  }
}

// --- END OF FILE src/sql-expressions/SqlConstantExpression.ts ---
