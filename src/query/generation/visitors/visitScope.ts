// --- START OF FILE src/query/generation/visitors/visitScope.ts ---

import { ScopeExpression } from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
import { VisitFn } from "../types";

// Scope apenas passa a chamada para a expressão fonte
export function visitScope(
  expression: ScopeExpression,
  context: QueryBuilderContext,
  visitFn: VisitFn // Necessário para chamar a visita da expressão fonte
): any {
  // O tipo de retorno depende da expressão fonte
  // O ScopeExpression em si não gera SQL, ele é usado pelo LambdaParser.
  // Apenas visitamos a expressão interna.
  return visitFn(expression.sourceExpression, context);
}
// --- END OF FILE src/query/generation/visitors/visitScope.ts ---
