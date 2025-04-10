/* eslint-disable @typescript-eslint/no-unused-vars */
// src/query/translation/visitors/method/SkipVisitor.ts

import {
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  ConstantExpression as LinqConstantExpression,
  LiteralExpression as LinqLiteralExpression,
  Expression as LinqExpression, // Para tipo de arg
} from "../../../../expressions";
// <<< CORREÇÃO: SqlDataSource NÃO vem de sql-expressions >>>
import {
  SelectExpression,
  SqlConstantExpression,
  SqlBinaryExpression,
  SqlExpression,
  // SqlDataSource -- REMOVIDO DAQUI
} from "../../../../sql-expressions";
// <<< CORREÇÃO: SqlDataSource VEM de TranslationContext >>>
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor

/**
 * Traduz uma chamada de método LINQ `skip(count)` para definir a cláusula OFFSET
 * de uma SelectExpression SQL.
 *
 * Herda de `MethodVisitor` por conveniência (para ser chamado via `apply` pelo orquestrador),
 * embora não utilize `sourceForLambda` ou `visitInContext` diretamente aqui.
 */
export class SkipVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de SkipVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`) - necessária para super, pode ser usada para arg não constante no futuro.
   * @param visitInContext Função para visitar em contexto - necessária para super, não usada aqui.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn,
    // Recebe visitInContext para satisfazer MethodVisitor, mas não o usa
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `skip` para definir o OFFSET.
   * @param expression A expressão de chamada do método `skip`.
   * @param currentSelect A SelectExpression SQL atual.
   * @param _sourceForLambda Não utilizado por SkipVisitor.
   * @returns A nova SelectExpression com a cláusula OFFSET definida.
   * @throws {Error} Se o argumento for inválido ou não for um número inteiro não negativo.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // Recebe sourceForLambda para compatibilidade com MethodVisitor.apply, mas não usa
    _sourceForLambda: SqlDataSource
  ): SelectExpression {
    // Validações
    if (expression.methodName !== "skip") {
      throw new Error("SkipVisitor só pode traduzir chamadas 'skip'.");
    }
    if (expression.args.length !== 1) {
      throw new Error("Método 'skip' requer exatamente um argumento (count).");
    }

    const arg = expression.args[0];
    let count: number | undefined = undefined;

    // Tenta extrair o valor do argumento (Constant ou Literal)
    // TODO: No futuro, poderia usar this.visitSubexpression(arg, this.context) se o argumento
    // pudesse ser uma expressão mais complexa que resulta em SqlConstantExpression ou parâmetro.
    if (arg instanceof LinqConstantExpression && arg.type === LinqExpressionType.Constant) {
      if (typeof arg.value === "number") count = arg.value;
    } else if (arg instanceof LinqLiteralExpression && arg.type === LinqExpressionType.Literal) {
      if (typeof arg.value === "number") count = arg.value;
    }

    // Valida se o count foi extraído e é um número válido
    if (count === undefined) {
      throw new Error(
        "Argumento inválido para 'skip'. Esperado um ConstantExpression ou LiteralExpression contendo um número. " +
          `Argumento: ${arg?.toString()}, Tipo: ${arg?.constructor?.name}`
      );
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new Error("Erro de Tradução: O valor de 'skip' (OFFSET) deve ser um inteiro não negativo.");
    }

    // Cria a expressão SQL para o OFFSET
    const offsetSql = new SqlConstantExpression(count);

    // Retorna uma *nova* instância de SelectExpression com o OFFSET definido.
    // Skip não muda a forma da query (projeções, joins, etc.). Reutiliza alias.
    // É crucial que haja um ORDER BY definido para que OFFSET tenha sentido determinístico.
    if (!currentSelect.orderBy || currentSelect.orderBy.length === 0) {
      console.warn(
        "Aviso: Chamada 'skip' (OFFSET) detectada sem um 'orderBy' anterior. O resultado pode ser não determinístico."
      );
    }

    return new SelectExpression(
      currentSelect.alias, // Mantém alias
      currentSelect.projection, // Mantém projeções
      currentSelect.from, // Mantém FROM
      currentSelect.predicate, // Mantém WHERE
      currentSelect.having, // Mantém HAVING
      currentSelect.joins, // Mantém Joins
      currentSelect.orderBy, // Mantém OrderBy ( essencial para Skip )
      offsetSql, // <<< Define OFFSET
      currentSelect.limit, // Mantém Limit
      currentSelect.groupBy // Mantém GroupBy
    );
  }
}
