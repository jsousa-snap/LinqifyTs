import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { escapeIdentifier } from "../query/generation/utils/sqlUtils";
import { SqlExpressionType } from "./SqlExpressionType";

export interface ProjectionExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Projection;
  expression: SqlExpressionMetadata; // Metadados da expressão projetada
  alias: string;
}

export class ProjectionExpression extends SqlExpression {
  public readonly type = SqlExpressionType.Projection;

  constructor(
    public readonly expression: SqlExpression,
    public readonly alias: string
  ) {
    super();
    if (!expression) throw new Error("Projection expression cannot be null.");
    if (!alias) throw new Error("Projection alias cannot be empty.");
  }

  toString(): string {
    return `${this.expression.toString()} AS ${escapeIdentifier(this.alias)}`;
  }

  toMetadata(): ProjectionExpressionMetadata {
    return {
      $type: SqlExpressionType.Projection,
      expression: this.expression.toMetadata(),
      alias: this.alias,
    };
  }
}
