import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../../expressions";
import { SqlExpression, SelectExpression, SqlOrdering, SortDirection } from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor

/**
 * Traduz chamadas `thenBy` e `thenByDescending` para adicionar um critério
 * à cláusula ORDER BY existente de uma SelectExpression SQL.
 *
 * Herda de `MethodVisitor`.
 */
export class ThenByVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de ThenByVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param visitInContext Função para visitar a lambda do seletor de chave.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // visitSubexpression (necessário para super)
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    // Passa os delegates relevantes para MethodVisitor
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `thenBy` ou `thenByDescending`.
   * @param expression A expressão de chamada do método.
   * @param currentSelect A SelectExpression SQL atual (que DEVE ter `orderBy` definido).
   * @param sourceForLambda A fonte de dados SQL para resolver a lambda do seletor de chave.
   * @returns A nova SelectExpression com a cláusula ORDER BY estendida.
   * @throws {Error} Se a query não estiver ordenada, argumentos inválidos ou falha na tradução da chave.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    sourceForLambda: SqlDataSource
  ): SelectExpression {
    const methodName = expression.methodName;
    // Validações
    if (methodName !== "thenBy" && methodName !== "thenByDescending") {
      throw new Error("ThenByVisitor só pode traduzir 'thenBy' ou 'thenByDescending'.");
    }
    // ThenBy só faz sentido se já houver um OrderBy
    if (!currentSelect.orderBy || currentSelect.orderBy.length === 0) {
      throw new Error(
        `Não é possível chamar '${methodName}' em uma consulta que ainda não foi ordenada com 'orderBy' ou 'orderByDescending'.`
      );
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error(`Argumento inválido para '${methodName}'. Esperada Lambda.`);
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error(`Lambda de '${methodName}' deve ter 1 parâmetro.`);
    }
    const param = lambda.parameters[0];
    // Determina a direção da ordenação secundária
    const direction: SortDirection = methodName === "thenBy" ? "ASC" : "DESC";

    // Cria contexto filho para a lambda do seletor de chave
    const keySelectorContext = this.context.createChildContext([param], [sourceForLambda]);

    // Visita o corpo da lambda (a chave de ordenação secundária) no contexto filho
    const keySql = this.visitInContext(lambda.body, keySelectorContext);

    if (!keySql) {
      throw new Error(
        `Não foi possível traduzir o seletor de chave para '${methodName}'. Lambda: ${lambda.toString()}`
      );
    }

    // Cria o novo objeto de ordenação SQL para este critério
    const newOrdering: SqlOrdering = { expression: keySql, direction };

    // Adiciona a nova ordenação à lista existente de ordenações
    const updatedOrderBy = [...currentSelect.orderBy, newOrdering];

    // Retorna uma *nova* instância de SelectExpression com a cláusula ORDER BY atualizada.
    // ThenBy não muda a forma (projeções, joins, etc.). Reutiliza o alias.
    return new SelectExpression(
      currentSelect.alias, // Mantém alias
      currentSelect.projection, // Mantém projeções
      currentSelect.from, // Mantém FROM
      currentSelect.predicate, // Mantém WHERE
      currentSelect.having, // Mantém HAVING
      currentSelect.joins, // Mantém Joins
      updatedOrderBy,
      currentSelect.offset, // Mantém Offset
      currentSelect.limit, // Mantém Limit
      currentSelect.groupBy // Mantém GroupBy
    );
  }
}
