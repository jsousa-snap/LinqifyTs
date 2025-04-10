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
 * Traduz chamadas `orderBy` e `orderByDescending` para definir a cláusula ORDER BY
 * de uma SelectExpression SQL, substituindo qualquer ordenação anterior.
 *
 * Herda de `MethodVisitor`.
 */
export class OrderByVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de OrderByVisitor.
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
    // OrderByVisitor não usa createProjections ou createDefaultSelect diretamente
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `orderBy` ou `orderByDescending`.
   * @param expression A expressão de chamada do método.
   * @param currentSelect A SelectExpression SQL atual.
   * @param sourceForLambda A fonte de dados SQL para resolver a lambda do seletor de chave.
   * @returns A nova SelectExpression com a cláusula ORDER BY definida.
   * @throws {Error} Se argumentos inválidos ou falha na tradução da chave.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    sourceForLambda: SqlDataSource
  ): SelectExpression {
    const methodName = expression.methodName;
    // Validações
    if (methodName !== "orderBy" && methodName !== "orderByDescending") {
      throw new Error("OrderByVisitor só pode traduzir 'orderBy' ou 'orderByDescending'.");
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error(`Argumento inválido para '${methodName}'. Esperada Lambda.`);
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error(`Lambda de '${methodName}' deve ter 1 parâmetro.`);
    }
    const param = lambda.parameters[0]; // Parâmetro da lambda (ex: u)
    // Determina a direção da ordenação
    const direction: SortDirection = methodName === "orderBy" ? "ASC" : "DESC";

    // Cria contexto filho para a lambda do seletor de chave
    const keySelectorContext = this.context.createChildContext([param], [sourceForLambda]);

    // Visita o corpo da lambda (a chave de ordenação) no contexto filho
    const keySql = this.visitInContext(lambda.body, keySelectorContext);

    if (!keySql) {
      throw new Error(
        `Não foi possível traduzir o seletor de chave para '${methodName}'. Lambda: ${lambda.toString()}`
      );
    }

    // Cria o objeto de ordenação SQL
    const newOrdering: SqlOrdering = { expression: keySql, direction };

    // Retorna uma *nova* instância de SelectExpression com a cláusula ORDER BY substituída.
    // OrderBy não muda a forma (projeções, joins, etc.). Reutiliza o alias.
    return new SelectExpression(
      currentSelect.alias, // Mantém alias
      currentSelect.projection, // Mantém projeções
      currentSelect.from, // Mantém FROM
      currentSelect.predicate, // Mantém WHERE
      currentSelect.having, // Mantém HAVING
      currentSelect.joins, // Mantém Joins
      [newOrdering], // <<< Define/Substitui ORDER BY
      currentSelect.offset, // Mantém Offset (pode ser invalidado semanticamente, mas sintaticamente ok)
      currentSelect.limit, // Mantém Limit
      currentSelect.groupBy // Mantém GroupBy
    );
  }
}
