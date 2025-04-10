/* eslint-disable @typescript-eslint/no-explicit-any */
import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { mapOperatorToSql, OperatorType } from "../query/generation/utils/sqlUtils";
import { SqlExpressionType } from "./SqlExpressionType";

export interface SqlBinaryExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Binary;
  left: SqlExpressionMetadata;
  operator: OperatorType;
  right: SqlExpressionMetadata;
}

export class SqlBinaryExpression extends SqlExpression {
  public readonly type = SqlExpressionType.Binary;

  constructor(
    public readonly left: SqlExpression,
    public readonly operator: OperatorType,
    public readonly right: SqlExpression
  ) {
    super();
    if (!left) throw new Error("Left operand cannot be null.");
    if (!right) throw new Error("Right operand cannot be null.");
  }

  toString(): string {
    try {
      const operatorSql = mapOperatorToSql(this.operator);
      return `(${this.left.toString()} ${operatorSql} ${this.right.toString()})`;
    } catch (e: any) {
      return `(Error generating binary: ${e.message})`;
    }
  }

  toMetadata(): SqlBinaryExpressionMetadata {
    return {
      $type: SqlExpressionType.Binary,
      left: this.left.toMetadata(),
      operator: this.operator,
      right: this.right.toMetadata(),
    };
  }
}
