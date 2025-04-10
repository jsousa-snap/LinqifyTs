/* eslint-disable @typescript-eslint/no-explicit-any */
import { Expression, ExpressionType } from "./Expression";

export class LiteralExpression extends Expression {
  readonly type = ExpressionType.Literal;
  constructor(public readonly value: any) {
    super();
  }
  toString(): string {
    return JSON.stringify(this.value); // Representação simples
  }
}
