/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  ConstantExpression as LinqConstantExpression,
  ParameterExpression as LinqParameterExpression,
  MemberExpression as LinqMemberExpression,
  BinaryExpression as LinqBinaryExpression,
  MethodCallExpression as LinqMethodCallExpression,
  NewObjectExpression as LinqNewObjectExpression,
  LiteralExpression as LinqLiteralExpression,
  ScopeExpression,
  // OperatorType as LinqOperatorType -- Não usado diretamente aqui
} from "../../expressions";
import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  ColumnExpression,
  SqlConstantExpression,
  SqlBinaryExpression,
  ProjectionExpression,
  SqlExpressionType,
  SqlExistsExpression,
  SqlScalarSubqueryAsJsonExpression,
  SqlLikeExpression,
  SqlFunctionCallExpression,
  SqlScalarSubqueryExpression,
  CompositeUnionExpression,
  TableExpressionBase,
  SqlCaseExpression,
  SqlInExpression,
} from "../../sql-expressions";
import { TranslationContext, SqlDataSource } from "./TranslationContext"; // Import correto
import { AliasGenerator } from "../generation/AliasGenerator";
import { VisitFn } from "../generation/types";

// --- Import Base Visitors ---
import { BaseExpressionVisitor } from "./visitors/base/BaseExpressionVisitor";

// --- Import Fundamental Visitors ---
import { ConstantVisitor } from "./visitors/fundamental/ConstantVisitor";
import { LiteralVisitor } from "./visitors/fundamental/LiteralVisitor";
import { ParameterVisitor } from "./visitors/fundamental/ParameterVisitor";
import { MemberVisitor } from "./visitors/fundamental/MemberVisitor";
import { BinaryVisitor } from "./visitors/fundamental/BinaryVisitor";
import { ScopeVisitor } from "./visitors/fundamental/ScopeVisitor";

// --- Import Method Visitors ---
import { WhereVisitor } from "./visitors/method/WhereVisitor";
import { SelectVisitor } from "./visitors/method/SelectVisitor";
import { IncludesVisitor } from "./visitors/method/IncludesVisitor";
import { InstanceMethodVisitor } from "./visitors/method/InstanceMethodVisitor";
import { TernaryVisitor } from "./visitors/method/TernaryVisitor";
import { AnyVisitor } from "./visitors/method/AnyVisitor";
import { UnionConcatVisitor } from "./visitors/method/UnionConcatVisitor";
import { JoinVisitor } from "./visitors/method/JoinVisitor";
import { LeftJoinVisitor } from "./visitors/method/LeftJoinVisitor";
import { OrderByVisitor } from "./visitors/method/OrderByVisitor";
import { ThenByVisitor } from "./visitors/method/ThenByVisitor";
import { SkipVisitor } from "./visitors/method/SkipVisitor";
import { TakeVisitor } from "./visitors/method/TakeVisitor";
import { CountVisitor } from "./visitors/method/CountVisitor";
import { AvgVisitor } from "./visitors/method/AvgVisitor";
import { SumVisitor } from "./visitors/method/SumVisitor";
import { MinVisitor } from "./visitors/method/MinVisitor";
import { MaxVisitor } from "./visitors/method/MaxVisitor";
import { GroupByVisitor } from "./visitors/method/GroupByVisitor";
import { HavingVisitor } from "./visitors/method/HavingVisitor";
import { FirstSingleVisitor } from "./visitors/method/FirstSingleVisitor";
import { ToListVisitor } from "./visitors/method/ToListVisitor";

/** Conjunto de nomes de funções de agregação SQL conhecidas. */
const AGGREGATE_FUNCTION_NAMES = new Set(["COUNT", "COUNT_BIG", "SUM", "AVG", "MIN", "MAX"]);

/** Orquestra a tradução de uma árvore de expressão LINQ para SQL. */
export class QueryExpressionVisitor {
  private context: TranslationContext;
  private aliasGenerator: AliasGenerator;
  // Funções vinculadas (bound) para passar aos visitors
  private readonly boundVisit: VisitFn;
  private readonly boundVisitInContext: (
    expression: LinqExpression,
    context: TranslationContext
  ) => SqlExpression | null;
  private readonly boundCreateProjections: (
    body: LinqExpression,
    context: TranslationContext
  ) => ProjectionExpression[];
  private readonly boundCreateDefaultSelect: (source: TableExpressionBase) => SelectExpression;

  constructor() {
    this.context = new TranslationContext();
    this.aliasGenerator = new AliasGenerator();
    this.boundVisit = this.visit.bind(this);
    this.boundVisitInContext = this.visitInContextInternal.bind(this);
    this.boundCreateProjections = this.createProjections.bind(this);
    this.boundCreateDefaultSelect = this.createDefaultSelect.bind(this);
  }

  /** Ponto de entrada principal para a tradução. */
  public translate(expression: LinqExpression): SqlExpression {
    this.context = new TranslationContext();
    this.aliasGenerator = new AliasGenerator();
    const result = this.visit(expression, this.context); // Passa contexto inicial
    if (!result) throw new Error("A tradução resultou em uma expressão nula.");

    let finalResult = result;
    if (result instanceof TableExpression || result instanceof CompositeUnionExpression) {
      finalResult = this.createDefaultSelect(result);
    }
    if (finalResult instanceof SqlExistsExpression) return finalResult;
    if (!(finalResult instanceof SelectExpression)) {
      console.error("Tipo inesperado no resultado final:", finalResult);
      throw new Error(
        `Resultado final inesperado: ${finalResult.constructor.name}. Esperado SelectExpression ou SqlExistsExpression.`
      );
    }
    if (finalResult.projection.length === 1) {
      const projExpr = finalResult.projection[0].expression;
      const alias = finalResult.projection[0].alias;
      if (
        (projExpr instanceof SqlFunctionCallExpression &&
          AGGREGATE_FUNCTION_NAMES.has(projExpr.functionName.toUpperCase()) &&
          finalResult.groupBy.length === 0) ||
        alias?.endsWith("_result")
      ) {
        return finalResult;
      }
    }
    return finalResult;
  }

  /** Cria uma SelectExpression padrão (SELECT [alias].*) para uma fonte. */
  private createDefaultSelect(source: TableExpressionBase): SelectExpression {
    const sourceAlias =
      source.alias || this.aliasGenerator.generateAlias(source instanceof TableExpression ? source.name : source.type);
    if (!source.alias) (source as { alias: string }).alias = sourceAlias;
    const tableRef = new TableExpression(
      source.type === SqlExpressionType.Table ? (source as TableExpression).name : `(<${source.type}>)`,
      sourceAlias
    );
    const projection = new ProjectionExpression(new ColumnExpression("*", tableRef), "*");
    return new SelectExpression(sourceAlias, [projection], source, null, null, [], [], null, null, []);
  }

  /** Método dispatcher principal - delega para visitors específicos. */
  // Adiciona 'context' como parâmetro para alinhar com VisitFn
  private visit(expression: LinqExpression | null, context: TranslationContext): SqlExpression | null {
    if (!expression) return null;

    let visitor: BaseExpressionVisitor<any, any>;

    switch (expression.type) {
      case LinqExpressionType.Constant: {
        visitor = new ConstantVisitor(context, this.aliasGenerator, this.boundVisit);
        return visitor.translate(expression as LinqConstantExpression);
      }
      case LinqExpressionType.Literal: {
        visitor = new LiteralVisitor(context, this.aliasGenerator, this.boundVisit);
        return visitor.translate(expression as LinqLiteralExpression);
      }
      case LinqExpressionType.Parameter: {
        visitor = new ParameterVisitor(context, this.aliasGenerator, this.boundVisit);
        return visitor.translate(expression as LinqParameterExpression);
      }
      case LinqExpressionType.MemberAccess: {
        visitor = new MemberVisitor(context, this.aliasGenerator, this.boundVisit);
        return visitor.translate(expression as LinqMemberExpression);
      }
      case LinqExpressionType.Binary: {
        visitor = new BinaryVisitor(context, this.aliasGenerator, this.boundVisit);
        return visitor.translate(expression as LinqBinaryExpression);
      }
      case LinqExpressionType.Scope: {
        visitor = new ScopeVisitor(context, this.aliasGenerator, this.boundVisit);
        return visitor.translate(expression as ScopeExpression);
      }
      case LinqExpressionType.Call: {
        return this.visitMethodCall(expression as LinqMethodCallExpression, context);
      }
      case LinqExpressionType.Lambda:
        throw new Error("Erro Interno: LambdaExpression não pode ser visitada diretamente.");
      case LinqExpressionType.NewObject:
        throw new Error("Erro Interno: NewObjectExpression não pode ser visitada diretamente.");
      default: {
        const exhaustiveCheck: never = expression.type;
        throw new Error(`Tipo de expressão LINQ não suportado: ${exhaustiveCheck}`);
      }
    }
  }

  /** Despacha chamadas de método para o visitor correto. Recebe contexto. */
  private visitMethodCall(callExpr: LinqMethodCallExpression, context: TranslationContext): SqlExpression {
    const methodName = callExpr.methodName;

    // --- Métodos que usam BaseExpressionVisitor + translate ---
    switch (methodName) {
      case "includes": {
        const includesVisitor = new IncludesVisitor(context, this.aliasGenerator, this.boundVisit);
        return includesVisitor.translate(callExpr);
      }
      case "toUpperCase":
      case "toLowerCase":
      case "trim":
      case "startsWith":
      case "endsWith":
      case "substring":
      case "getFullYear":
      case "getMonth":
      case "getDate":
      case "getHours":
      case "getMinutes":
      case "getSeconds": {
        const instanceVisitor = new InstanceMethodVisitor(context, this.aliasGenerator, this.boundVisit);
        return instanceVisitor.translate(callExpr);
      }
      case "__internal_ternary__": {
        const ternaryVisitor = new TernaryVisitor(context, this.aliasGenerator, this.boundVisit);
        return ternaryVisitor.translate(callExpr);
      }
      case "any": {
        const anyVisitor = new AnyVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundCreateDefaultSelect,
          this.boundVisitInContext
        );
        return anyVisitor.translate(callExpr);
      }
      case "union":
      case "concat": {
        const unionVisitor = new UnionConcatVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundCreateDefaultSelect
        );
        return unionVisitor.translate(callExpr);
      }
    }

    // --- Métodos de Extensão que usam MethodVisitor + apply ---
    if (!callExpr.source) throw new Error(`Método '${methodName}' requer uma expressão fonte.`);
    // Visita a fonte usando o contexto atual
    const baseSql = this.visit(callExpr.source, context);
    if (!baseSql) throw new Error(`Falha ao visitar a fonte para '${methodName}'.`);

    let currentSelect: SelectExpression;
    let sourceForLambda: SqlDataSource;
    // Determina currentSelect e sourceForLambda baseado no resultado da visita da fonte
    if (baseSql instanceof TableExpression) {
      currentSelect = this.createDefaultSelect(baseSql);
      sourceForLambda = baseSql;
    } else if (baseSql instanceof SelectExpression) {
      currentSelect = baseSql;
      sourceForLambda = currentSelect;
    } else if (baseSql instanceof CompositeUnionExpression) {
      currentSelect = this.createDefaultSelect(baseSql);
      sourceForLambda = currentSelect;
    } else {
      throw new Error(`Não é possível aplicar '${methodName}' a uma fonte SQL do tipo '${baseSql.constructor.name}'.`);
    }

    // Instancia e chama apply no MethodVisitor apropriado
    // Passa o 'context' atual para os construtores (que o passarão para super())

    switch (methodName) {
      case "where": {
        const isSourceGroupBy =
          callExpr.source.type === LinqExpressionType.Call &&
          (callExpr.source as LinqMethodCallExpression).methodName === "groupBy";
        if (isSourceGroupBy) {
          const havingVisitor = new HavingVisitor(
            context,
            this.aliasGenerator,
            this.boundVisit,
            this.boundVisitInContext
          );
          return havingVisitor.apply(callExpr, currentSelect, sourceForLambda);
        } else {
          const whereVisitor = new WhereVisitor(
            context,
            this.aliasGenerator,
            this.boundVisit,
            this.boundVisitInContext
          );
          return whereVisitor.apply(callExpr, currentSelect, sourceForLambda);
        }
      }
      case "select": {
        const selectVisitor = new SelectVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext,
          this.boundCreateProjections
        );
        return selectVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "join": {
        const joinVisitor = new JoinVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext,
          this.boundCreateProjections
        );
        return joinVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "leftJoin": {
        const leftJoinVisitor = new LeftJoinVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext,
          this.boundCreateProjections
        );
        return leftJoinVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "orderBy":
      case "orderByDescending": {
        const orderByVisitor = new OrderByVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext
        );
        return orderByVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "thenBy":
      case "thenByDescending": {
        const thenByVisitor = new ThenByVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext
        );
        return thenByVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "skip": {
        const skipVisitor = new SkipVisitor(context, this.aliasGenerator, this.boundVisit, this.boundVisitInContext);
        return skipVisitor.apply(callExpr, currentSelect, sourceForLambda); // sourceForLambda não usado por skip
      }
      case "take": {
        const takeVisitor = new TakeVisitor(context, this.aliasGenerator, this.boundVisit, this.boundVisitInContext);
        return takeVisitor.apply(callExpr, currentSelect, sourceForLambda); // sourceForLambda não usado por take
      }
      case "count":
      case "countAsync": {
        const countVisitor = new CountVisitor(context, this.aliasGenerator, this.boundVisit, this.boundVisitInContext);
        return countVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "avg":
      case "avgAsync": {
        const avgVisitor = new AvgVisitor(context, this.aliasGenerator, this.boundVisit, this.boundVisitInContext);
        return avgVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "sum":
      case "sumAsync": {
        const sumVisitor = new SumVisitor(context, this.aliasGenerator, this.boundVisit, this.boundVisitInContext);
        return sumVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "min":
      case "minAsync": {
        const minVisitor = new MinVisitor(context, this.aliasGenerator, this.boundVisit, this.boundVisitInContext);
        return minVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "max":
      case "maxAsync": {
        const maxVisitor = new MaxVisitor(context, this.aliasGenerator, this.boundVisit, this.boundVisitInContext);
        return maxVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "groupBy": {
        const groupByVisitor = new GroupByVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext
        );
        return groupByVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "first":
      case "firstAsync":
      case "firstOrDefault":
      case "firstOrDefaultAsync":
      case "single":
      case "singleAsync":
      case "singleOrDefault":
      case "singleOrDefaultAsync": {
        const firstSingleVisitor = new FirstSingleVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext
        );
        return firstSingleVisitor.apply(callExpr, currentSelect, sourceForLambda);
      }
      case "toList":
      case "toListAsync": {
        const toListVisitor = new ToListVisitor(
          context,
          this.aliasGenerator,
          this.boundVisit,
          this.boundVisitInContext
        );
        return toListVisitor.apply(callExpr, currentSelect, sourceForLambda); // sourceForLambda não usado por toList
      }
      default: {
        throw new Error(`Método de extensão LINQ não suportado: ${methodName}`);
      }
    }
  }

  /** Implementação interna para visitar em contexto aninhado. */
  private visitInContextInternal(expression: LinqExpression, context: TranslationContext): SqlExpression | null {
    return this.visit(expression, context);
  }

  /** Cria projeções SQL a partir do corpo de uma lambda. */
  public createProjections(body: LinqExpression, context: TranslationContext): ProjectionExpression[] {
    const projections: ProjectionExpression[] = [];
    // Usa a função vinculada que opera no contexto correto
    const visit = (expr: LinqExpression) => this.boundVisitInContext(expr, context);

    if (body.type === LinqExpressionType.NewObject) {
      const newObject = body as LinqNewObjectExpression;
      for (const [alias, expr] of newObject.properties.entries()) {
        const sqlExpr = visit(expr); // Usa o visit com o contexto da lambda

        if (!sqlExpr) throw new Error(`Projeção falhou para o alias '${String(alias)}'.`);

        if (sqlExpr instanceof TableExpression) {
          projections.push(new ProjectionExpression(new ColumnExpression("*", sqlExpr), String(alias) + "_all"));
        } else if (sqlExpr instanceof SelectExpression) {
          let isKnownAggregate = false;
          if (
            sqlExpr.projection.length === 1 &&
            sqlExpr.projection[0].expression instanceof SqlFunctionCallExpression
          ) {
            const funcName = (sqlExpr.projection[0].expression as SqlFunctionCallExpression).functionName.toUpperCase();
            isKnownAggregate = AGGREGATE_FUNCTION_NAMES.has(funcName);
          }
          const useScalarSubquery =
            isKnownAggregate &&
            !sqlExpr.offset &&
            !sqlExpr.limit &&
            sqlExpr.joins.length === 0 &&
            sqlExpr.groupBy.length === 0 &&
            !sqlExpr.having;
          let subqueryExpression: SqlExpression;
          if (useScalarSubquery) {
            subqueryExpression = new SqlScalarSubqueryExpression(sqlExpr);
          } else {
            const useWithoutArrayWrapper = sqlExpr.limit instanceof SqlConstantExpression && sqlExpr.limit.value === 1;
            if (!sqlExpr.alias) {
              console.warn(`SelectExpression para projeção JSON '${String(alias)}' não tinha alias. Gerando um.`);
              (sqlExpr as any).alias = this.aliasGenerator.generateAlias("select");
            }
            subqueryExpression = new SqlScalarSubqueryAsJsonExpression(
              sqlExpr as SelectExpression,
              undefined,
              undefined,
              useWithoutArrayWrapper
            );
          }
          projections.push(new ProjectionExpression(subqueryExpression, String(alias)));
        } else if (
          sqlExpr instanceof ColumnExpression ||
          sqlExpr instanceof SqlConstantExpression ||
          sqlExpr instanceof SqlFunctionCallExpression ||
          sqlExpr instanceof SqlBinaryExpression ||
          sqlExpr instanceof SqlCaseExpression ||
          sqlExpr instanceof SqlLikeExpression ||
          sqlExpr instanceof SqlInExpression
        ) {
          projections.push(new ProjectionExpression(sqlExpr, String(alias)));
        } else {
          throw new Error(
            `Tipo de expressão SQL inesperado (${sqlExpr.constructor.name}) na projeção para '${String(alias)}'.`
          );
        }
      }
    } else if (body.type === LinqExpressionType.Parameter) {
      const source = visit(body);
      let tableOrUnionSource: TableExpressionBase | null = null;
      if (source instanceof TableExpression) tableOrUnionSource = source;
      else if (source instanceof SelectExpression && source.from instanceof TableExpressionBase)
        tableOrUnionSource = source.from;
      else if (source instanceof CompositeUnionExpression) tableOrUnionSource = source;
      if (!tableOrUnionSource || !tableOrUnionSource.alias)
        throw new Error(`Projeção de identidade não resolveu para fonte com alias: ${source?.constructor.name}`);
      const tempTable = new TableExpression(
        tableOrUnionSource.type === SqlExpressionType.Union ? "(<union>)" : "(<table>)",
        tableOrUnionSource.alias
      );
      projections.push(new ProjectionExpression(new ColumnExpression("*", tempTable), "*"));
    } else {
      const sqlExpr = visit(body);
      if (!sqlExpr) throw new Error(`Falha na tradução da projeção simples: ${body.toString()}`);
      if (
        sqlExpr instanceof ColumnExpression ||
        sqlExpr instanceof SqlConstantExpression ||
        sqlExpr instanceof SqlFunctionCallExpression ||
        sqlExpr instanceof SqlBinaryExpression ||
        sqlExpr instanceof SqlCaseExpression ||
        sqlExpr instanceof SqlLikeExpression ||
        sqlExpr instanceof SqlInExpression
      ) {
        const alias =
          body.type === LinqExpressionType.MemberAccess
            ? (body as LinqMemberExpression).memberName
            : `expr${projections.length}`;
        projections.push(new ProjectionExpression(sqlExpr, alias));
      } else if (
        sqlExpr instanceof TableExpression ||
        sqlExpr instanceof SelectExpression ||
        sqlExpr instanceof CompositeUnionExpression
      ) {
        throw new Error(
          `Projeção simples resolvida inesperadamente para ${sqlExpr.constructor.name}: ${body.toString()}`
        );
      } else {
        throw new Error(
          `Projeção simples não resolveu para tipo SQL simples. Tipo: ${sqlExpr.constructor.name}, LINQ: ${body.toString()}`
        );
      }
    }
    if (projections.length === 0) throw new Error("Criação de projeção resultou em lista vazia.");
    return projections;
  }
}
