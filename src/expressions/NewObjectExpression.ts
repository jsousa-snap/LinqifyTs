import { Expression, ExpressionType } from "./Expression";

// Representa a criação de um objeto literal, ex: { id: u.id, name: u.name }
export class NewObjectExpression extends Expression {
  readonly type = ExpressionType.NewObject;
  // Mapeia o nome da propriedade no objeto resultante para a Expression que calcula seu valor
  constructor(public readonly properties: ReadonlyMap<string, Expression>) {
    super();
  }
  toString(): string {
    const props = Array.from(this.properties.entries())
      .map(([key, value]) => `${key}: ${value.toString()}`)
      .join(", ");
    return `{ ${props} }`;
  }
}
