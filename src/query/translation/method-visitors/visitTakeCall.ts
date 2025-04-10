// --- START OF FILE src/query/translation/method-visitors/visitTakeCall.ts ---

// src/query/translation/method-visitors/visitTakeCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  ConstantExpression as LinqConstantExpression,
  LiteralExpression as LinqLiteralExpression, // Importar LiteralExpression
} from "../../../expressions";
import { SqlExpression, SelectExpression, SqlConstantExpression } from "../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../TranslationContext";

/**
 * Traduz uma chamada de método LINQ 'take(count)'.
 * Aceita ConstantExpression ou LiteralExpression como argumento.
 * @param expression A expressão da chamada de método 'take'.
 * @param currentSelect A SelectExpression atual.
 * @param context O contexto de tradução.
 * @returns A nova SelectExpression com a cláusula LIMIT definida.
 */
export function visitTakeCall(
  expression: LinqMethodCallExpression,
  currentSelect: SelectExpression,
  context: TranslationContext
): SelectExpression {
  const arg = expression.args?.[0];
  let count: number | undefined = undefined;

  // **VERIFICAÇÃO CORRIGIDA: Aceita Constant ou Literal**
  if (arg instanceof LinqConstantExpression && arg.type === LinqExpressionType.Constant) {
    if (typeof arg.value === "number") {
      count = arg.value;
    }
  } else if (arg instanceof LinqLiteralExpression && arg.type === LinqExpressionType.Literal) {
    if (typeof arg.value === "number") {
      count = arg.value;
    }
  }

  // Se não conseguiu extrair um número válido
  if (count === undefined) {
    console.error("!!! Argument check failed (Take) !!!");
    console.error("Argument:", arg);
    console.error("Argument Constructor:", arg?.constructor?.name);
    console.error("Argument Type Prop:", arg?.type);
    console.error("Argument Value:", (arg as any)?.value);
    throw new Error(
      "Invalid arguments for 'take' method call. Expected a single ConstantExpression or LiteralExpression containing a number."
    );
  }
  // **FIM DA VERIFICAÇÃO CORRIGIDA**

  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Translation Error: 'take' count must be a non-negative integer.");
  }

  const limitSql = new SqlConstantExpression(count);

  // Take não muda a forma, reutiliza o alias
  const alias = currentSelect.alias;

  // *** CORREÇÃO: Ordem dos argumentos do construtor ***
  return new SelectExpression(
    alias, // <<< alias (Mantém)
    currentSelect.projection, // projection
    currentSelect.from, // from
    currentSelect.predicate, // predicate
    null, // having
    currentSelect.joins, // joins
    currentSelect.orderBy, // orderBy
    currentSelect.offset, // offset
    limitSql // limit (Define)
    // groupBy (Default [])
  );
}
// --- END OF FILE src/query/translation/method-visitors/visitTakeCall.ts ---
