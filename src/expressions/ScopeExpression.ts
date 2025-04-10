// --- START OF FILE expressions/ScopeExpression.ts ---

import { Expression, ExpressionType } from "./Expression";
import { ParameterExpression } from "./ParameterExpression"; // Import não usado diretamente, mas pode ser relevante contextualmente

// Representa a introdução de um escopo de variáveis externas
export class ScopeExpression extends Expression {
  readonly type = ExpressionType.Scope;

  // scopeMap: Mapeia o nome usado na lambda -> Expressão raiz da variável externa
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
    // A representação pode variar, esta é apenas uma sugestão para depuração
    return `${this.sourceExpression.toString()}.provideScope({ ${scopeEntries} })`;
  }
}
// --- END OF FILE expressions/ScopeExpression.ts ---
