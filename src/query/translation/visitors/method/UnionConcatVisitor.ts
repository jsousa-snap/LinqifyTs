// src/query/translation/visitors/method/UnionConcatVisitor.ts

import {
  // Expression as LinqExpression, // Não usado diretamente
  MethodCallExpression as LinqMethodCallExpression,
} from "../../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  CompositeUnionExpression,
  TableExpressionBase,
} from "../../../../sql-expressions";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";
import { TranslationContext } from "../../TranslationContext"; // Para passar a visitSubexpression
import { AliasGenerator } from "../../../generation/AliasGenerator"; // Para alias da união
import { VisitFn } from "../../../generation/types"; // Para o construtor da base

/**
 * Traduz chamadas de método LINQ `union()` ou `concat()` para `CompositeUnionExpression`.
 * `union` implica `UNION` (DISTINCT), `concat` implica `UNION ALL`.
 *
 * Herda de `BaseExpressionVisitor` porque retorna `CompositeUnionExpression`,
 * não modificando um `SelectExpression` existente.
 */
export class UnionConcatVisitor extends BaseExpressionVisitor<LinqMethodCallExpression, CompositeUnionExpression> {
  // Função auxiliar passada pelo orquestrador
  private readonly createDefaultSelect: (source: TableExpressionBase) => SelectExpression;

  /**
   * Cria uma instância de UnionConcatVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param createDefaultSelect Função auxiliar para criar SELECT * default.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // visitSubexpression
    createDefaultSelect: (source: TableExpressionBase) => SelectExpression
  ) {
    super(context, aliasGenerator, visitDelegate); // Chama construtor da base
    if (!createDefaultSelect) throw new Error("UnionConcatVisitor: createDefaultSelect é obrigatório.");
    this.createDefaultSelect = createDefaultSelect;
  }

  /**
   * Traduz a chamada `union` ou `concat`.
   * @param expression A expressão de chamada do método.
   * @returns A `CompositeUnionExpression` correspondente.
   * @throws {Error} Se os argumentos forem inválidos ou as fontes não puderem ser traduzidas para SelectExpressions.
   */
  translate(expression: LinqMethodCallExpression): CompositeUnionExpression {
    const methodName = expression.methodName;
    // Valida a chamada
    if ((methodName !== "union" && methodName !== "concat") || expression.args.length !== 1 || !expression.source) {
      throw new Error(`Argumentos inválidos para '${methodName}'. Requer uma fonte e um argumento.`);
    }
    // Determina se é UNION (distinct) ou UNION ALL (concat)
    const isDistinct = methodName === "union";
    const firstLinqExpr = expression.source; // A primeira fonte
    const secondLinqExpr = expression.args[0]; // A segunda fonte (argumento)

    // Visita as duas fontes da união
    // <<< CORREÇÃO: Passa this.context >>>
    const firstVisited = this.visitSubexpression(firstLinqExpr, this.context);
    const secondVisited = this.visitSubexpression(secondLinqExpr, this.context);

    if (!firstVisited || !secondVisited) {
      throw new Error(
        `Não foi possível traduzir as fontes para '${methodName}'. Primeira: ${firstLinqExpr.toString()}, Segunda: ${secondLinqExpr.toString()}`
      );
    }

    // Garante que ambas as fontes sejam SelectExpressions (ou cria defaults usando o helper)
    // Isso é necessário porque UNION/UNION ALL opera sobre resultados de SELECTs.
    const firstSelect = this.ensureSelectExpression(firstVisited, methodName, "primeira");
    const secondSelect = this.ensureSelectExpression(secondVisited, methodName, "segunda");

    // Cria ou estende a CompositeUnionExpression
    // Se a primeira fonte já era uma união compatível (mesmo distinct/all), adiciona a nova fonte.
    if (firstVisited instanceof CompositeUnionExpression && firstVisited.distinct === isDistinct) {
      const existingSources = firstVisited.sources;
      const newSources = [...existingSources, secondSelect];
      // Reutiliza o alias da união existente ou gera um novo se necessário
      const unionAlias = firstVisited.alias || this.aliasGenerator.generateAlias(methodName);
      if (!firstVisited.alias) (firstVisited as any).alias = unionAlias; // Atualiza o alias na instância original
      return new CompositeUnionExpression(newSources, unionAlias, isDistinct);
    } else {
      // Cria uma nova união com as duas SelectExpressions
      const unionAlias = this.aliasGenerator.generateAlias(methodName);
      return new CompositeUnionExpression([firstSelect, secondSelect], unionAlias, isDistinct);
    }
  }

  /**
   * Garante que uma expressão SQL seja uma SelectExpression,
   * criando uma `SELECT *` default se for TableExpression ou CompositeUnionExpression.
   * Lança erro se for outro tipo de expressão SQL.
   * @param sqlExpr A expressão SQL a ser verificada/convertida.
   * @param methodName O nome do método original (para mensagem de erro).
   * @param whichArg Descrição do argumento (para mensagem de erro).
   * @returns A SelectExpression garantida.
   */
  private ensureSelectExpression(sqlExpr: SqlExpression, methodName: string, whichArg: string): SelectExpression {
    if (sqlExpr instanceof SelectExpression) {
      return sqlExpr; // Já é um Select, retorna diretamente.
    } else if (sqlExpr instanceof TableExpression || sqlExpr instanceof CompositeUnionExpression) {
      // Se for Tabela ou União, cria um SELECT * default usando o helper.
      return this.createDefaultSelect(sqlExpr);
    } else {
      // Se for qualquer outro tipo (Constant, Column, Binary, etc.), não é válido para UNION/CONCAT.
      throw new Error(
        `O argumento (${whichArg}) para '${methodName}' não foi traduzido para Table, Select ou Union, que são necessários para criar um SELECT. Tipo encontrado: ${sqlExpr?.constructor.name}`
      );
    }
  }
}
