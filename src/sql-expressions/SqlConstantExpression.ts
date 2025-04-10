/* eslint-disable @typescript-eslint/no-explicit-any */

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { generateSqlLiteral } from "../query/generation/utils/sqlUtils";
import { SqlExpressionType } from "./SqlExpressionType";

export interface SqlConstantExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Constant;
  value: any;
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

  toMetadata(): SqlConstantExpressionMetadata {
    return {
      $type: SqlExpressionType.Constant,
      value: this.value,
    };
  }
}
