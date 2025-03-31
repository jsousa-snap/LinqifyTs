// --- START OF FILE src/query/translation/method-visitors/visitSkipCall.ts ---

// src/query/translation/method-visitors/visitSkipCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  ConstantExpression as LinqConstantExpression,
  LiteralExpression as LinqLiteralExpression, // Importar LiteralExpression
} from "../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  SqlConstantExpression,
} from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";

/**
 * Traduz uma chamada de método LINQ 'skip(count)'.
 * Aceita ConstantExpression ou LiteralExpression como argumento.
 * @param expression A expressão da chamada de método 'skip'.
 * @param currentSelect A SelectExpression atual.
 * @param context O contexto de tradução.
 * @returns A nova SelectExpression com a cláusula OFFSET definida.
 */
export function visitSkipCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  context: TranslationContext
): SelectExpression {
  const arg = expression.args?.[0];
  let count: number | undefined = undefined;

  // **VERIFICAÇÃO CORRIGIDA: Aceita Constant ou Literal**
  if (
    arg instanceof LinqConstantExpression &&
    arg.type === LinqExpressionType.Constant
  ) {
    if (typeof arg.value === "number") {
      count = arg.value;
    }
  } else if (
    arg instanceof LinqLiteralExpression &&
    arg.type === LinqExpressionType.Literal
  ) {
    if (typeof arg.value === "number") {
      count = arg.value;
    }
  }

  // Se não conseguiu extrair um número válido
  if (count === undefined) {
    console.error("!!! Argument check failed (Skip) !!!");
    console.error("Argument:", arg);
    console.error("Argument Constructor:", arg?.constructor?.name);
    console.error("Argument Type Prop:", arg?.type);
    console.error("Argument Value:", (arg as any)?.value);
    throw new Error(
      "Invalid arguments for 'skip' method call. Expected a single ConstantExpression or LiteralExpression containing a number."
    );
  }
  // **FIM DA VERIFICAÇÃO CORRIGIDA**

  if (!Number.isInteger(count) || count < 0) {
    throw new Error(
      "Translation Error: 'skip' count must be a non-negative integer."
    );
  }

  const offsetSql = new SqlConstantExpression(count);

  return new SelectExpression(
    currentSelect.projection,
    currentSelect.from,
    currentSelect.predicate,
    currentSelect.joins,
    currentSelect.orderBy,
    offsetSql, // Define o offset
    currentSelect.limit
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitSkipCall.ts ---
