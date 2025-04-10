import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
  ParameterExpression as LinqParameterExpression,
} from "../../../../expressions";
import { SqlExpression, SelectExpression, ProjectionExpression } from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor";

/**
 * Traduz uma chamada de método LINQ `select` para atualizar as projeções
 * de uma SelectExpression SQL. Identifica e otimiza projeções de identidade (x => x).
 *
 * Herda de `MethodVisitor` porque modifica um `SelectExpression` existente.
 */
export class SelectVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  // createProjections é essencial para este visitor
  // É recebido no construtor e armazenado por MethodVisitor

  /**
   * Cria uma instância de SelectVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param visitInContext Função para visitar a lambda de projeção no contexto correto.
   * @param createProjections Função auxiliar (do orquestrador) para gerar projeções SQL a partir do corpo da lambda.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // visitSubexpression
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null,
    // Passa createProjections para o construtor de MethodVisitor
    createProjections: (body: LinqExpression, context: TranslationContext) => ProjectionExpression[]
  ) {
    // Passa createProjections para o construtor da base MethodVisitor
    super(context, aliasGenerator, visitDelegate, visitInContext, createProjections);
    // Valida se createProjections foi realmente fornecido
    if (!this.createProjections) {
      throw new Error("SelectVisitor requer a função createProjections.");
    }
  }

  /**
   * Aplica a lógica do `select` para definir as novas projeções.
   * @param expression A expressão de chamada do método `select`.
   * @param currentSelect A SelectExpression SQL atual a ser modificada.
   * @param sourceForLambda A fonte de dados SQL (Tabela, Select, Union) para resolver o parâmetro da lambda.
   * @returns A nova SelectExpression com as projeções atualizadas.
   * @throws {Error} Se argumentos inválidos ou falha na criação das projeções.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    sourceForLambda: SqlDataSource
  ): SelectExpression {
    // Validações
    if (expression.methodName !== "select") {
      throw new Error("SelectVisitor só pode traduzir chamadas 'select'.");
    }
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Argumento inválido para 'select'. Esperada Lambda.");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    if (lambda.parameters.length !== 1) {
      throw new Error("Lambda 'select' deve ter 1 parâmetro.");
    }
    const param = lambda.parameters[0]; // Parâmetro da lambda (ex: u)

    let finalProjections: ReadonlyArray<ProjectionExpression>;
    let selectAlias: string;

    // --- Detecção da Projeção de Identidade (x => x) ---
    if (
      lambda.body.type === LinqExpressionType.Parameter &&
      (lambda.body as LinqParameterExpression).name === param.name // Verifica se o corpo é o próprio parâmetro
    ) {
      // É uma projeção de identidade.
      // Reutiliza as projeções da SelectExpression anterior para evitar SELECT * FROM (SELECT * FROM ...) desnecessário.
      finalProjections = currentSelect.projection;
      // Mesmo reutilizando projeções, o SELECT externo que representa esta operação 'select' precisa de um alias.
      selectAlias = this.aliasGenerator.generateAlias("selectId"); // Alias específico ou padrão
    } else {
      // --- Projeção Normal ---
      // Cria contexto filho para a lambda de projeção
      const projectionContext = this.context.createChildContext([param], [sourceForLambda]);

      // Usa a função `createProjections` (armazenada em `this.createProjections`) para gerar as projeções SQL
      const createdProjections = this.createProjections!(lambda.body, projectionContext); // Usa '!' pois validamos no construtor

      if (createdProjections.length === 0) {
        throw new Error(`Projeção 'select' resultou em nenhuma coluna. Lambda: ${lambda.toString()}`);
      }
      finalProjections = createdProjections;
      // Gera um novo alias padrão para esta SelectExpression com novas projeções
      selectAlias = this.aliasGenerator.generateAlias("select");
    }

    return new SelectExpression(
      selectAlias, // Define novo alias para esta etapa do SELECT
      finalProjections,
      currentSelect.from, // Mantém FROM
      currentSelect.predicate, // Mantém WHERE
      currentSelect.having, // Mantém HAVING
      currentSelect.joins, // Mantém Joins
      currentSelect.orderBy, // **Importante: Preservar OrderBy**
      currentSelect.offset, // Preservar Offset
      currentSelect.limit, // Preservar Limit
      currentSelect.groupBy // Preservar GroupBy
    );
  }
}
