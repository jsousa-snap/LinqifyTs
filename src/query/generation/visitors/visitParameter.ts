// --- START OF FILE src/query/generation/visitors/visitParameter.ts ---

import { ParameterExpression } from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
// import { VisitFn } from "../types"; // Não precisa de visitFn

// Retorna o próprio parâmetro, a resolução é feita pelo chamador (visitMember, visitMethodCall)
export function visitParameter(
  expression: ParameterExpression,
  context: QueryBuilderContext
  // visitFn: VisitFn
): ParameterExpression {
  // Apenas verifica se o parâmetro existe no contexto (ou externo) como sanity check
  const sourceInfo = context.getSourceInfo(expression);
  if (!sourceInfo) {
    // Se não existe nem no outer context, é um erro de lógica anterior
    if (!context.outerContext?.getSourceInfo(expression)) {
      throw new Error(
        `visitParameter: Parameter '${expression.name}' has no associated SourceInfo in current or outer contexts.`
      );
    }
  }
  // Retorna a própria expressão de parâmetro. O CONTEXTO da chamada decidirá o que fazer.
  return expression;
}
// --- END OF FILE src/query/generation/visitors/visitParameter.ts ---
