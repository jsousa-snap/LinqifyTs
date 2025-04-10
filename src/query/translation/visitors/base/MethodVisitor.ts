/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Expression as LinqExpression,
  MethodCallExpression as LinqMethodCallExpression,
} from "../../../../expressions";
// Tipos SQL necessários para SqlDataSource e TResult
import {
  SqlExpression,
  SelectExpression,
  ProjectionExpression,
  TableExpressionBase,
} from "../../../../sql-expressions";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
// <<< CORREÇÃO DEFINITIVA: Importar SqlDataSource e TranslationContext do local correto >>>
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { BaseExpressionVisitor } from "./BaseExpressionVisitor";
import type { QueryExpressionVisitor } from "../../QueryExpressionVisitor";

/**
 * Classe base abstrata para visitors que manipulam chamadas de método de extensão LINQ
 * que operam sobre uma SelectExpression existente (ex: where, select, join, orderBy).
 *
 * Define o método `apply` que recebe a `currentSelect` e `sourceForLambda` como
 * argumentos essenciais para realizar a modificação.
 *
 * @template TMethod Tipo da MethodCallExpression LINQ manipulada.
 * @template TResult Tipo da expressão SQL resultante (geralmente SelectExpression).
 */
export abstract class MethodVisitor<
  TMethod extends LinqMethodCallExpression,
  TResult extends SqlExpression = SelectExpression, // O padrão é SelectExpression
> extends BaseExpressionVisitor<TMethod, TResult> {
  // Referências a funções auxiliares frequentemente necessárias por Method Visitors.
  protected readonly visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null;
  protected readonly createProjections?: (body: LinqExpression, context: TranslationContext) => ProjectionExpression[];
  protected readonly createDefaultSelect?: (source: TableExpressionBase) => SelectExpression;
  protected readonly rootVisitor?: QueryExpressionVisitor;

  /**
   * Cria uma instância de MethodVisitor.
   * Recebe delegados adicionais que podem ser necessários para os métodos.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param visitInContext Função para visitar em contexto específico (obrigatório para a maioria dos MethodVisitors).
   * @param createProjections Função auxiliar para criar projeções (para Select, Join, GroupBy).
   * @param createDefaultSelect Função auxiliar para criar SELECT * (pode ser necessário internamente).
   * @param rootVisitor Referência opcional ao orquestrador (`QueryExpressionVisitor`) para casos complexos.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // visitSubexpression
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null,
    createProjections?: (body: LinqExpression, context: TranslationContext) => ProjectionExpression[],
    createDefaultSelect?: (source: TableExpressionBase) => SelectExpression,
    rootVisitor?: QueryExpressionVisitor // Aceita o orquestrador
  ) {
    super(context, aliasGenerator, visitDelegate); // Chama construtor da BaseExpressionVisitor

    if (!visitInContext) throw new Error("MethodVisitor: visitInContext delegate é obrigatório.");

    this.visitInContext = visitInContext;
    this.createProjections = createProjections;
    this.createDefaultSelect = createDefaultSelect;
    this.rootVisitor = rootVisitor;
  }

  /**
   * Método principal para aplicar a transformação do método LINQ.
   * Aceita a SelectExpression atual e a fonte para lambdas como argumentos.
   * @param expression A expressão de chamada do método LINQ.
   * @param currentSelect A SelectExpression SQL atual a ser modificada.
   * @param sourceForLambda A fonte de dados SQL para resolver parâmetros de lambda.
   * @param otherArgs Argumentos adicionais específicos que um visitor possa precisar (ex: orquestrador para GroupBy).
   * @returns A expressão SQL resultante após aplicar o método.
   */
  abstract apply(
    expression: TMethod,
    currentSelect: SelectExpression,
    sourceForLambda: SqlDataSource, // <<< Tipo SqlDataSource vindo de TranslationContext
    ...otherArgs: any[]
  ): TResult;

  /**
   * Implementação padrão (e inválida) de 'translate' para satisfazer a classe base.
   * Os MethodVisitors devem ser chamados usando 'apply'.
   * @param expression A expressão de chamada do método LINQ.
   * @throws {Error} Sempre lança um erro, pois 'apply' deve ser usado.
   */
  translate(expression: TMethod): TResult {
    console.warn(expression);
    const visitorName = this.constructor.name || "MethodVisitor";
    throw new Error(`'translate' não deve ser chamado diretamente em ${visitorName}. Use 'apply' em vez disso.`);
  }
}
