import { Expression, ExpressionType } from "./Expression";

export class ParameterExpression extends Expression {
  readonly type = ExpressionType.Parameter;
  constructor(public readonly name: string) {
    super();
    if (!name) throw new Error("Parameter name cannot be empty.");
  }
  toString(): string {
    return this.name;
  }
}
