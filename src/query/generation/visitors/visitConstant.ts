// --- START OF FILE src/query/generation/visitors/visitConstant.ts ---

import { ConstantExpression } from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
import { SourceInfo } from "../types";
import { escapeIdentifier } from "../utils/sqlUtils";

export function visitConstant(
  expression: ConstantExpression,
  context: QueryBuilderContext
  // visitFn: VisitFn // Não precisa de visitFn aqui
): SourceInfo | ConstantExpression {
  // Retorna SourceInfo para tabelas, ou a expressão para outros
  const value = expression.value;

  if (value && typeof value === "object" && value.type === "Table") {
    const actualTableName = value.name;
    for (const [, existingInfo] of context.sources.entries()) {
      if (existingInfo.isBaseTable && existingInfo.expression === expression) {
        return existingInfo;
      }
    }

    const alias = context.generateNewAlias();
    const sqlTableName = escapeIdentifier(actualTableName);

    // Adiciona ao FROM apenas se for a primeira tabela
    // A lógica de JOIN cuidará das tabelas subsequentes.
    if (context.fromClauseParts.length === 0) {
      context.fromClauseParts.push(`${sqlTableName} AS ${alias}`);
    }

    const sourceInfo: SourceInfo = {
      alias,
      expression: expression,
      isBaseTable: true,
      providesAllColumns: true,
      parameters: [],
    };
    return sourceInfo;
  } else {
    // Retorna a própria expressão Constant se não for uma Tabela
    // (ex: Constant<External> ou Constant<LiteralValue> capturada)
    return expression;
  }
}
// --- END OF FILE src/query/generation/visitors/visitConstant.ts ---
