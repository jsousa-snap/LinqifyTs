/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  ConstantExpression as LinqConstantExpression,
  LiteralExpression as LinqLiteralExpression,
  Expression as LinqExpression,
} from "../../../../expressions";
import { SelectExpression, SqlConstantExpression, SqlExpression } from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor";

/**
 * Traduz uma chamada de método LINQ `take(count)` para definir a cláusula LIMIT (ou FETCH/TOP)
 * de uma SelectExpression SQL.
 *
 * Herda de `MethodVisitor` por conveniência, embora não utilize `sourceForLambda`.
 */
export class TakeVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de TakeVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param visitInContext Função para visitar em contexto - necessária para super, não usada aqui.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn,
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `take` para definir o LIMIT.
   * @param expression A expressão de chamada do método `take`.
   * @param currentSelect A SelectExpression SQL atual.
   * @param _sourceForLambda Não utilizado por TakeVisitor.
   * @returns A nova SelectExpression com a cláusula LIMIT definida.
   * @throws {Error} Se o argumento for inválido ou não for um número inteiro não negativo.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    _sourceForLambda: SqlDataSource
  ): SelectExpression {
    // Validações
    if (expression.methodName !== "take") {
      throw new Error("TakeVisitor só pode traduzir chamadas 'take'.");
    }
    if (expression.args.length !== 1) {
      throw new Error("Método 'take' requer exatamente um argumento (count).");
    }

    const arg = expression.args[0];
    let count: number | undefined = undefined;

    // Tenta extrair o valor do argumento (Constant ou Literal)
    if (arg instanceof LinqConstantExpression && arg.type === LinqExpressionType.Constant) {
      if (typeof arg.value === "number") count = arg.value;
    } else if (arg instanceof LinqLiteralExpression && arg.type === LinqExpressionType.Literal) {
      if (typeof arg.value === "number") count = arg.value;
    }

    // Valida o count
    if (count === undefined) {
      throw new Error(
        "Argumento inválido para 'take'. Esperado um ConstantExpression ou LiteralExpression contendo um número. " +
          `Argumento: ${arg?.toString()}, Tipo: ${arg?.constructor?.name}`
      );
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new Error("Erro de Tradução: O valor de 'take' (LIMIT) deve ser um inteiro não negativo.");
    }

    // Cria a expressão SQL para o LIMIT
    const limitSql = new SqlConstantExpression(count);

    // Retorna uma *nova* instância de SelectExpression com o LIMIT definido.
    // Take não muda a forma da query (projeções, joins, etc.). Reutiliza alias.
    return new SelectExpression(
      currentSelect.alias,
      currentSelect.projection,
      currentSelect.from,
      currentSelect.predicate,
      currentSelect.having,
      currentSelect.joins,
      currentSelect.orderBy,
      currentSelect.offset,
      limitSql,
      currentSelect.groupBy
    );
  }
}
