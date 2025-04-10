// src/query/translation/visitors/method/AnyVisitor.ts

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
  SqlExistsExpression,
  ProjectionExpression,
  SqlConstantExpression,
  TableExpressionBase,
  CompositeUnionExpression,
  SqlBinaryExpression,
} from "../../../../sql-expressions";
// Precisa de SqlDataSource de TranslationContext
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";
import { OperatorType } from "../../../generation/utils/sqlUtils"; // Para combinar predicados

/**
 * Traduz uma chamada de método LINQ `any()` ou `any(predicate)` para `SqlExistsExpression`.
 * Retorna `SqlExistsExpression`, então herda de `BaseExpressionVisitor`.
 */
export class AnyVisitor extends BaseExpressionVisitor<LinqMethodCallExpression, SqlExistsExpression> {
  // Funções auxiliares passadas pelo orquestrador
  private readonly createDefaultSelect: (source: TableExpressionBase) => SelectExpression;
  private readonly visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null;

  /**
   * Cria uma instância de AnyVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param createDefaultSelect Função auxiliar para criar SELECT * default.
   * @param visitInContext Função para visitar a lambda do predicado no contexto correto.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // visitSubexpression
    createDefaultSelect: (source: TableExpressionBase) => SelectExpression,
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate); // Chama construtor da base

    // Valida e armazena as funções auxiliares
    if (!createDefaultSelect) throw new Error("AnyVisitor: createDefaultSelect é obrigatório.");
    if (!visitInContext) throw new Error("AnyVisitor: visitInContext é obrigatório.");
    this.createDefaultSelect = createDefaultSelect;
    this.visitInContext = visitInContext;
  }

  /**
   * Traduz a chamada `any` para `SqlExistsExpression`.
   * @param expression A expressão de chamada do método `any`.
   * @returns A `SqlExistsExpression` correspondente.
   * @throws {Error} Se a fonte não puder ser traduzida, ou se o predicado for inválido.
   */
  translate(expression: LinqMethodCallExpression): SqlExistsExpression {
    if (expression.methodName !== "any") {
      // Validação básica, embora o orquestrador deva chamar o visitor correto.
      throw new Error("AnyVisitor só pode traduzir chamadas 'any'.");
    }
    if (!expression.source) {
      throw new Error("'any' requer uma expressão fonte.");
    }

    // 1. Visita a fonte da chamada 'any'
    // <<< CORREÇÃO: Passa this.context >>>
    const sourceSql = this.visitSubexpression(expression.source, this.context);
    if (!sourceSql) {
      throw new Error(`Não foi possível traduzir a fonte de 'any'. Fonte: ${expression.source.toString()}`);
    }

    // 2. Garante que a fonte para o EXISTS seja uma SelectExpression
    let selectForExists: SelectExpression;
    let sourceForPredicateLambda: SqlDataSource; // Fonte para resolver o parâmetro do predicado

    if (sourceSql instanceof TableExpression) {
      selectForExists = this.createDefaultSelect(sourceSql); // Usa helper
      sourceForPredicateLambda = sourceSql; // Predicado opera na tabela base
    } else if (sourceSql instanceof CompositeUnionExpression) {
      selectForExists = this.createDefaultSelect(sourceSql); // Usa helper
      sourceForPredicateLambda = selectForExists; // Predicado opera no resultado da união (Select *)
    } else if (sourceSql instanceof SelectExpression) {
      selectForExists = sourceSql;
      sourceForPredicateLambda = selectForExists; // Predicado opera no resultado do select anterior
    } else {
      // Se a fonte não for Tabela, União ou Select, não podemos aplicar Any diretamente.
      throw new Error(`'any' requer uma fonte Table, Select ou Union. Tipo encontrado: ${sourceSql.constructor.name}`);
    }

    // 3. Aplica o predicado, se houver (ex: .Any(u => u.IsActive))
    if (expression.args.length > 0) {
      // Valida o argumento do predicado
      if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
        throw new Error("Argumento inválido para o predicado de 'any'. Esperada uma lambda.");
      }
      const lambda = expression.args[0] as LinqLambdaExpression;
      if (lambda.parameters.length !== 1) {
        throw new Error("A lambda do predicado de 'any' deve ter exatamente um parâmetro.");
      }
      const param = lambda.parameters[0];

      // Cria contexto filho para o predicado, mapeando o parâmetro para a fonte correta
      const predicateContext = this.context.createChildContext([param], [sourceForPredicateLambda]);

      // Visita o corpo do predicado NO CONTEXTO FILHO usando o delegate correto
      const predicateSql = this.visitInContext(lambda.body, predicateContext);
      if (!predicateSql) {
        throw new Error(`Não foi possível traduzir o predicado de 'any': ${lambda.body.toString()}`);
      }

      // Combina o predicado do 'any' com o predicado WHERE existente do SELECT
      const newPredicate = selectForExists.predicate
        ? new SqlBinaryExpression(selectForExists.predicate, OperatorType.And, predicateSql)
        : predicateSql;

      // Atualiza a SelectExpression interna do EXISTS com o novo predicado
      // (Cria uma nova instância para imutabilidade)
      selectForExists = new SelectExpression(
        selectForExists.alias,
        selectForExists.projection,
        selectForExists.from,
        newPredicate, // <<< Predicado atualizado
        selectForExists.having,
        selectForExists.joins,
        selectForExists.orderBy,
        selectForExists.offset,
        selectForExists.limit,
        selectForExists.groupBy
      );
    }

    // 4. Cria a SelectExpression final para dentro do EXISTS
    // Geralmente `SELECT 1 FROM ... WHERE ...`
    const existsProjection = new ProjectionExpression(
      new SqlConstantExpression(1), // Seleciona uma constante (1 ou 'x')
      "exists_val" // Alias interno, não muito relevante
    );
    const existsSelectAlias = this.aliasGenerator.generateAlias("exists"); // Alias para o SELECT interno

    // Cria o SELECT final, removendo projeções, ordenação e paginação desnecessárias
    const finalSelectForExists = new SelectExpression(
      existsSelectAlias,
      [existsProjection], // Projeção: SELECT 1 AS exists_val
      selectForExists.from, // FROM original
      selectForExists.predicate, // WHERE (já inclui o predicado do Any, se houver)
      selectForExists.having, // HAVING (pode ser relevante)
      selectForExists.joins, // Joins (podem ser relevantes)
      [], // ORDER BY removido
      null, // OFFSET removido
      null, // LIMIT removido
      selectForExists.groupBy // GroupBy (pode ser relevante)
    );

    // 5. Retorna a expressão EXISTS contendo o SELECT preparado
    return new SqlExistsExpression(finalSelectForExists);
  }
}
