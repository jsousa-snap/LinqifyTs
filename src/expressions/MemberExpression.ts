import { Expression, ExpressionType } from "./Expression";

export class MemberExpression extends Expression {
  readonly type = ExpressionType.MemberAccess;
  constructor(
    public readonly objectExpression: Expression, // A expressão do objeto (ex: o ParameterExpression 'user')
    public readonly memberName: string // O nome do membro (ex: 'name')
  ) {
    super();
    if (!memberName) throw new Error("Member name cannot be empty.");
  }
  toString(): string {
    return `${this.objectExpression.toString()}.${this.memberName}`;
  }
}
