import { Expression, ExpressionType } from "./Expression";

export class ConstantExpression extends Expression {
  readonly type = ExpressionType.Constant;
  constructor(public readonly value: any) {
    // No nosso caso inicial, será o nome da tabela
    super();
  }
  toString(): string {
    // Para uma tabela, apenas o nome
    return typeof this.value === "string"
      ? this.value
      : JSON.stringify(this.value);
  }
}
