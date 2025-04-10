import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  InnerJoinExpression,
  SqlBinaryExpression,
  ProjectionExpression,
  TableExpressionBase,
  // SqlDataSource -- REMOVIDO DAQUI
} from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator"; // Para gerar alias do join e da fonte interna
import { VisitFn } from "../../../generation/types"; // Para construtor da base
import { MethodVisitor } from "../base/MethodVisitor";
import { OperatorType } from "../../../generation/utils/sqlUtils"; // Para condição de join (=)

/**
 * Traduz uma chamada de método LINQ `join` para adicionar uma InnerJoinExpression
 * e atualizar as projeções de uma SelectExpression SQL.
 *
 * Herda de `MethodVisitor` porque modifica um `SelectExpression` existente.
 */
export class JoinVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  // createProjections é essencial para este visitor
  // É recebido no construtor e armazenado por MethodVisitor

  /**
   * Cria uma instância de JoinVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`) - usada para a fonte interna.
   * @param visitInContext Função para visitar lambdas (seletores de chave, seletor de resultado).
   * @param createProjections Função auxiliar (do orquestrador) para gerar projeções SQL a partir da lambda de resultado.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // visitSubexpression
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null,
    createProjections: (body: LinqExpression, context: TranslationContext) => ProjectionExpression[]
  ) {
    // Passa createProjections para o construtor da base MethodVisitor
    super(context, aliasGenerator, visitDelegate, visitInContext, createProjections);
    if (!this.createProjections) {
      throw new Error("JoinVisitor requer a função createProjections.");
    }
  }

  /**
   * Aplica a lógica do `join` para adicionar o INNER JOIN e definir novas projeções.
   * @param expression A expressão de chamada do método `join`.
   * @param currentSelect A SelectExpression SQL atual (representando a fonte externa).
   * @param sourceForOuterLambda A fonte de dados SQL para resolver a lambda da chave externa (geralmente `currentSelect` ou sua tabela base).
   * @returns A nova SelectExpression representando o resultado do JOIN.
   * @throws {Error} Se argumentos inválidos ou falha na tradução.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    sourceForOuterLambda: SqlDataSource
  ): SelectExpression {
    // Validações
    if (expression.methodName !== "join") {
      throw new Error("JoinVisitor só pode traduzir chamadas 'join'.");
    }
    // join(innerSource, outerKeySelector, innerKeySelector, resultSelector)
    if (expression.args.length !== 4) {
      throw new Error("Método 'join' requer 4 argumentos.");
    }
    // Valida tipos dos argumentos (Fonte, Lambda, Lambda, Lambda)
    if (
      expression.args[0].type === LinqExpressionType.Lambda || // Fonte interna não pode ser lambda
      expression.args[1].type !== LinqExpressionType.Lambda ||
      expression.args[2].type !== LinqExpressionType.Lambda ||
      expression.args[3].type !== LinqExpressionType.Lambda
    ) {
      throw new Error("Tipos de argumento inválidos para 'join'. Esperado: Expression, Lambda, Lambda, Lambda.");
    }

    const [
      innerSourceLinqExpr, // A fonte interna a ser juntada
      outerKeyLambdaExpr, // Lambda para obter a chave da fonte externa (ex: u => u.Id)
      innerKeyLambdaExpr, // Lambda para obter a chave da fonte interna (ex: p => p.UserId)
      resultLambdaExpr, // Lambda para projetar o resultado (ex: (u, p) => ({ Name: u.Name, Product: p.Name }))
    ] = expression.args as [LinqExpression, LinqLambdaExpression, LinqLambdaExpression, LinqLambdaExpression];

    // --- 1. Visita a fonte interna ---
    // Usa `visitSubexpression` (visit normal) para traduzir a fonte interna.
    const innerSqlSourceBase = this.visitSubexpression(innerSourceLinqExpr, this.context);
    if (!innerSqlSourceBase || !(innerSqlSourceBase instanceof TableExpressionBase)) {
      // A fonte interna deve ser traduzida para algo que possa estar em um JOIN (Tabela, Subconsulta, União)
      throw new Error(
        `Visitar a fonte interna para 'join' não resultou em Tabela, Select ou União. Tipo encontrado: ${innerSqlSourceBase?.constructor.name}. Fonte: ${innerSourceLinqExpr.toString()}`
      );
    }
    // Garante que a fonte interna tenha um alias para ser referenciada no JOIN ON e nas projeções
    if (!innerSqlSourceBase.alias) {
      (innerSqlSourceBase as { alias: string }).alias = this.aliasGenerator.generateAlias(
        innerSqlSourceBase instanceof TableExpression ? innerSqlSourceBase.name : innerSqlSourceBase.type // ex: 'users' ou 'select' ou 'union'
      );
    }
    // Guarda a fonte interna já com alias garantido
    const innerAliasedSource = innerSqlSourceBase;

    // --- 2. Tradução das chaves (usando visitInContext) ---
    const outerParam = outerKeyLambdaExpr.parameters[0]; // Parâmetro da lambda da chave externa (ex: u)
    const innerParam = innerKeyLambdaExpr.parameters[0]; // Parâmetro da lambda da chave interna (ex: p)

    // Contexto para a chave externa: mapeia 'outerParam' para 'sourceForOuterLambda'
    const outerKeyContext = this.context.createChildContext([outerParam], [sourceForOuterLambda]);
    const outerKeySql = this.visitInContext(outerKeyLambdaExpr.body, outerKeyContext);

    // Contexto para a chave interna: mapeia 'innerParam' para a fonte interna 'innerAliasedSource'
    const innerKeyContext = this.context.createChildContext([innerParam], [innerAliasedSource]);
    const innerKeySql = this.visitInContext(innerKeyLambdaExpr.body, innerKeyContext);

    if (!outerKeySql || !innerKeySql) {
      throw new Error(
        `Não foi possível traduzir as chaves do join. Externa: ${outerKeyLambdaExpr.body.toString()}, Interna: ${innerKeyLambdaExpr.body.toString()}`
      );
    }

    // --- 3. Criação da expressão de JOIN ---
    // Condição do JOIN: ON outerKey = innerKey
    const joinPredicate = new SqlBinaryExpression(outerKeySql, OperatorType.Equal, innerKeySql);
    // Cria a expressão INNER JOIN
    const joinExpr = new InnerJoinExpression(innerAliasedSource, joinPredicate);
    // Adiciona o novo join à lista de joins existentes
    const newJoins = [...currentSelect.joins, joinExpr];

    // --- 4. Criação das projeções do resultado (usando createProjections) ---
    const resultOuterParam = resultLambdaExpr.parameters[0]; // Parâmetro para o elemento externo na projeção (ex: u)
    const resultInnerParam = resultLambdaExpr.parameters[1]; // Parâmetro para o elemento interno na projeção (ex: p)

    // Contexto para a lambda de resultado: mapeia os parâmetros para as fontes externa e interna
    const resultContext = this.context.createChildContext(
      [resultOuterParam, resultInnerParam],
      [sourceForOuterLambda, innerAliasedSource] // Mapeia u -> fonte externa, p -> fonte interna
    );

    // Usa a função `createProjections` (armazenada) para gerar as projeções SQL
    const resultProjections = this.createProjections!(resultLambdaExpr.body, resultContext); // Usa '!' pois validamos no construtor
    if (resultProjections.length === 0) {
      throw new Error(`Projeção do Join resultou em nenhuma coluna. Lambda: ${resultLambdaExpr.toString()}`);
    }

    // --- 5. Cria a nova SelectExpression ---
    // Join MUDA a forma (projeções e joins). Precisa de um novo alias para esta etapa.
    const joinAlias = this.aliasGenerator.generateAlias("join"); // ex: j0, j1

    // Retorna uma *nova* SelectExpression com o join e as novas projeções.
    return new SelectExpression(
      joinAlias,
      resultProjections,
      currentSelect.from,
      currentSelect.predicate,
      currentSelect.having,
      newJoins,
      currentSelect.orderBy,
      currentSelect.offset,
      currentSelect.limit,
      currentSelect.groupBy
    );
  }
}
