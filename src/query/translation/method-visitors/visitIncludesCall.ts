// src/query/translation/method-visitors/visitIncludesCall.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  ConstantExpression as LinqConstantExpression,
  MemberExpression as LinqMemberExpression,
} from "../../../expressions";
import {
  SqlExpression,
  SqlConstantExpression,
  SqlLikeExpression,
} from "../../../sql-expressions";
import { TranslationContext } from "../TranslationContext";

/**
 * Traduz uma chamada de método LINQ 'string.includes(value)'.
 * @param expression A expressão da chamada de método 'includes'.
 * @param context O contexto de tradução atual.
 * @param visit Função principal de visita para avaliar os argumentos/fonte.
 * @returns A SqlLikeExpression correspondente.
 */
export function visitIncludesCall(
  expression: LinqMethodCallExpression,
  context: TranslationContext,
  visit: (expression: LinqExpression | null) => SqlExpression | null
): SqlLikeExpression {
  if (!expression.source || expression.args.length !== 1) {
    throw new Error(
      "Invalid 'includes' method call. Requires a source and one argument."
    );
  }

  const sourceSql = visit(expression.source);
  if (!sourceSql) {
    throw new Error(
      `Could not translate the source expression for 'includes': ${expression.source.toString()}`
    );
  }

  const argumentSql = visit(expression.args[0]);
  let literalValueToEscape: string;

  if (
    argumentSql instanceof SqlConstantExpression &&
    typeof argumentSql.value === "string"
  ) {
    literalValueToEscape = argumentSql.value;
  } else {
    throw new Error(
      `'includes' currently only supports a constant string argument. Found: ${expression.args[0].toString()}`
    );
  }

  // **** NOVA LÓGICA DE ESCAPE ****
  // Escapa os caracteres especiais do LIKE na string literal ANTES de adicionar os '%'
  const escapedSearchTerm = literalValueToEscape
    .replace(/\[/g, "[[]") // 1. Escapa o próprio [ -> [[]
    .replace(/%/g, "[%]") // 2. Escapa % -> [%]
    .replace(/_/g, "[_]"); // 3. Escapa _ -> [_]

  // Cria o padrão LIKE final
  const pattern = `%${escapedSearchTerm}%`;
  // **** FIM NOVA LÓGICA ****

  const patternConstant = new SqlConstantExpression(pattern);

  return new SqlLikeExpression(sourceSql, patternConstant);
}
