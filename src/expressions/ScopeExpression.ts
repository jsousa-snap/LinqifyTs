import { Expression, ExpressionType } from "./Expression";

// Representa a introdução de um escopo de variáveis externas
export class ScopeExpression extends Expression {
  readonly type = ExpressionType.Scope;

  constructor(
    public readonly sourceExpression: Expression, // A expressão anterior (ex: Users)
    public readonly scopeMap: ReadonlyMap<string, Expression> // Ex: { 'postsRef': Constant<Table>('Posts') }
  ) {
    super();
    if (!sourceExpression) throw new Error("Source expression cannot be null for ScopeExpression.");
    if (!scopeMap) throw new Error("Scope map cannot be null for ScopeExpression.");
  }

  toString(): string {
    const scopeEntries = Array.from(this.scopeMap.entries())
      .map(([key, value]) => `${key}: ${value.toString()}`)
      .join(", ");
    return `${this.sourceExpression.toString()}.provideScope({ ${scopeEntries} })`;
  }
}
