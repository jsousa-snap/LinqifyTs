import { Expression, ExpressionType } from "./Expression";
import { ParameterExpression } from "./ParameterExpression";

export class LambdaExpression extends Expression {
  readonly type = ExpressionType.Lambda;
  constructor(
    public readonly body: Expression, // O corpo da lambda
    public readonly parameters: ReadonlyArray<ParameterExpression> // Os parâmetros (ex: [user])
  ) {
    super();
  }
  toString(): string {
    const params = this.parameters.map((p) => p.toString()).join(", ");
    return `(${params}) => ${this.body.toString()}`;
  }
}
