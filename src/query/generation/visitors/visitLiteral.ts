// --- START OF FILE src/query/generation/visitors/visitLiteral.ts ---

import { LiteralExpression } from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
import { SqlResult } from "../types";
import { generateSqlLiteral } from "../utils/sqlUtils";

export function visitLiteral(
  expression: LiteralExpression,
  context: QueryBuilderContext
  // visitFn: VisitFn // Não precisa
): SqlResult {
  const sql = generateSqlLiteral(expression.value);
  return { sql: sql };
}
// --- END OF FILE src/query/generation/visitors/visitLiteral.ts ---
