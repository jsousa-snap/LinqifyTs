// src/query/translation/visitors/method/LeftJoinVisitor.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../../expressions";
// <<< CORREÇÃO: SqlDataSource NÃO vem de sql-expressions >>>
import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  LeftJoinExpression, // <<< Usa LeftJoinExpression
  SqlBinaryExpression,
  ProjectionExpression,
  TableExpressionBase,
  // SqlDataSource -- REMOVIDO DAQUI
} from "../../../../sql-expressions";
// <<< CORREÇÃO: SqlDataSource VEM de TranslationContext >>>
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor
import { OperatorType } from "../../../generation/utils/sqlUtils";

/**
 * Traduz uma chamada de método LINQ `leftJoin` para adicionar uma LeftJoinExpression
 * e atualizar as projeções de uma SelectExpression SQL.
 *
 * Herda de `MethodVisitor` porque modifica um `SelectExpression` existente.
 */
export class LeftJoinVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  // createProjections é essencial, herdado/armazenado por MethodVisitor

  /**
   * Cria uma instância de LeftJoinVisitor.
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
      throw new Error("LeftJoinVisitor requer a função createProjections.");
    }
  }

  /**
   * Aplica a lógica do `leftJoin` para adicionar o LEFT JOIN e definir novas projeções.
   * @param expression A expressão de chamada do método `leftJoin`.
   * @param currentSelect A SelectExpression SQL atual (representando a fonte externa).
   * @param sourceForOuterLambda A fonte de dados SQL para resolver a lambda da chave externa.
   * @returns A nova SelectExpression representando o resultado do LEFT JOIN.
   * @throws {Error} Se argumentos inválidos ou falha na tradução.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    sourceForOuterLambda: SqlDataSource
  ): SelectExpression {
    // Validações (idênticas a join, mas verifica nome 'leftJoin')
    if (expression.methodName !== "leftJoin") {
      throw new Error("LeftJoinVisitor só pode traduzir chamadas 'leftJoin'.");
    }
    if (
      expression.args.length !== 4 ||
      expression.args[0].type === LinqExpressionType.Lambda ||
      expression.args[1].type !== LinqExpressionType.Lambda ||
      expression.args[2].type !== LinqExpressionType.Lambda ||
      expression.args[3].type !== LinqExpressionType.Lambda
    ) {
      throw new Error("Tipos de argumento inválidos para 'leftJoin'. Esperado: Expression, Lambda, Lambda, Lambda.");
    }

    const [innerSourceLinqExpr, outerKeyLambdaExpr, innerKeyLambdaExpr, resultLambdaExpr] = expression.args as [
      LinqExpression,
      LinqLambdaExpression,
      LinqLambdaExpression,
      LinqLambdaExpression,
    ];

    // --- 1. Visita a fonte interna (idêntico a join) ---
    // <<< CORREÇÃO: Passa this.context >>>
    const innerSqlSourceBase = this.visitSubexpression(innerSourceLinqExpr, this.context);
    if (!innerSqlSourceBase || !(innerSqlSourceBase instanceof TableExpressionBase)) {
      throw new Error(
        `Visitar a fonte interna para 'leftJoin' não resultou em Tabela/Select/União. Tipo: ${innerSqlSourceBase?.constructor.name}. Fonte: ${innerSourceLinqExpr.toString()}`
      );
    }
    if (!innerSqlSourceBase.alias) {
      (innerSqlSourceBase as { alias: string }).alias = this.aliasGenerator.generateAlias(
        innerSqlSourceBase instanceof TableExpression ? innerSqlSourceBase.name : innerSqlSourceBase.type
      );
    }
    const innerAliasedSource = innerSqlSourceBase;

    // --- 2. Tradução das chaves (idêntico a join) ---
    const outerParam = outerKeyLambdaExpr.parameters[0];
    const innerParam = innerKeyLambdaExpr.parameters[0];
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    const outerKeyContext = this.context.createChildContext([outerParam], [sourceForOuterLambda]);
    const outerKeySql = this.visitInContext(outerKeyLambdaExpr.body, outerKeyContext);
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    const innerKeyContext = this.context.createChildContext([innerParam], [innerAliasedSource]);
    const innerKeySql = this.visitInContext(innerKeyLambdaExpr.body, innerKeyContext);
    if (!outerKeySql || !innerKeySql) {
      throw new Error(
        `Não foi possível traduzir chaves do leftJoin. Externa: ${outerKeyLambdaExpr.body.toString()}, Interna: ${innerKeyLambdaExpr.body.toString()}`
      );
    }

    // --- 3. Criação da expressão de JOIN ---
    const joinPredicate = new SqlBinaryExpression(outerKeySql, OperatorType.Equal, innerKeySql);
    // **** DIFERENÇA: Cria LeftJoinExpression ****
    const joinExpr = new LeftJoinExpression(innerAliasedSource, joinPredicate);
    const newJoins = [...currentSelect.joins, joinExpr];

    // --- 4. Criação das projeções do resultado (idêntico a join) ---
    const resultOuterParam = resultLambdaExpr.parameters[0];
    const resultInnerParam = resultLambdaExpr.parameters[1];
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    const resultContext = this.context.createChildContext(
      [resultOuterParam, resultInnerParam],
      [sourceForOuterLambda, innerAliasedSource]
    );
    const resultProjections = this.createProjections!(resultLambdaExpr.body, resultContext); // Usa '!'
    if (resultProjections.length === 0) {
      throw new Error(`Projeção do LeftJoin resultou em nenhuma coluna. Lambda: ${resultLambdaExpr.toString()}`);
    }

    // --- 5. Cria a nova SelectExpression (idêntico a join, exceto pelo alias) ---
    const joinAlias = this.aliasGenerator.generateAlias("leftJoin"); // ex: lj0, lj1

    return new SelectExpression(
      joinAlias,
      resultProjections,
      currentSelect.from,
      currentSelect.predicate,
      currentSelect.having,
      newJoins, // <<< Contém o LeftJoinExpression
      currentSelect.orderBy,
      currentSelect.offset,
      currentSelect.limit,
      currentSelect.groupBy
    );
  }
}
