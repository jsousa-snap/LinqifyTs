// --- START OF FILE src/query/translation/QueryExpressionVisitor.ts ---

// src/query/translation/QueryExpressionVisitor.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  ConstantExpression as LinqConstantExpression,
  ParameterExpression as LinqParameterExpression,
  MemberExpression as LinqMemberExpression,
  BinaryExpression as LinqBinaryExpression,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
  NewObjectExpression as LinqNewObjectExpression,
  LiteralExpression as LinqLiteralExpression,
  ScopeExpression,
  OperatorType as LinqOperatorType,
} from "../../expressions";

import {
  SqlExpression,
  SelectExpression,
  TableExpression,
  ColumnExpression,
  SqlConstantExpression,
  SqlBinaryExpression,
  ProjectionExpression,
  InnerJoinExpression,
  JoinExpressionBase,
  SqlExpressionType,
  SqlExistsExpression,
  SqlScalarSubqueryAsJsonExpression,
  SqlLikeExpression,
  SqlOrdering,
  SortDirection,
  SqlFunctionCallExpression,
  SqlScalarSubqueryExpression,
  CompositeUnionExpression,
  TableExpressionBase,
} from "../../sql-expressions";

import { TranslationContext, SqlDataSource } from "./TranslationContext";
import { getTableName } from "../generation/utils/sqlUtils";
// *** NOVO: Importa AliasGenerator ***
import { AliasGenerator } from "../generation/AliasGenerator";

// Importa visitors de métodos
import {
  visitWhereCall,
  visitSelectCall,
  visitJoinCall,
  visitIncludesCall,
  visitOrderByCall,
  visitThenByCall,
  visitCountCall,
  visitSkipCall,
  visitTakeCall,
  visitAvgCall,
  visitSumCall,
  visitMinCall,
  visitMaxCall,
  visitGroupByCall,
  visitHavingCall,
} from "./method-visitors";

type VisitInContextFn = (
  expression: LinqExpression,
  context: TranslationContext
) => SqlExpression | null;

const AGGREGATE_FUNCTION_NAMES = new Set([
  "COUNT",
  "COUNT_BIG",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
]);

/**
 * Traduz uma árvore de expressão LINQ para uma árvore de expressão SQL.
 */
export class QueryExpressionVisitor {
  private context: TranslationContext;
  // *** NOVO: Instância do gerador de alias ***
  private aliasGenerator: AliasGenerator;

  constructor() {
    this.context = new TranslationContext();
    // *** NOVO: Inicializa o gerador de alias ***
    this.aliasGenerator = new AliasGenerator();
  }

  /**
   * Ponto de entrada principal para a tradução.
   */
  public translate(expression: LinqExpression): SqlExpression {
    // *** NOVO: Reseta/Recria o gerador e o contexto para cada tradução ***
    this.context = new TranslationContext();
    this.aliasGenerator = new AliasGenerator(); // Garante estado limpo por consulta

    const result = this.visit(expression);
    if (!result) throw new Error("Translation resulted in a null expression.");

    let finalResult = result;

    if (
      result instanceof TableExpression ||
      result instanceof CompositeUnionExpression
    ) {
      finalResult = this.createDefaultSelect(result);
    }

    if (
      finalResult instanceof SelectExpression ||
      finalResult instanceof SqlExistsExpression
    ) {
      if (
        finalResult instanceof SelectExpression &&
        finalResult.projection.length === 1
      ) {
        const projExpr = finalResult.projection[0].expression;
        if (
          projExpr instanceof SqlFunctionCallExpression &&
          AGGREGATE_FUNCTION_NAMES.has(projExpr.functionName.toUpperCase()) &&
          finalResult.groupBy.length === 0
        ) {
          return finalResult;
        }
      }
      return finalResult;
    }

    console.error("Unexpected final translation result type:", finalResult);
    throw new Error(
      `Unexpected translation result type at root: ${finalResult.constructor.name}. Expected SelectExpression or SqlExistsExpression.`
    );
  }

  /**
   * Cria uma SelectExpression padrão (SELECT [alias].*) para uma fonte TableExpressionBase.
   * Garante que a fonte tenha um alias gerado se necessário.
   */
  private createDefaultSelect(source: TableExpressionBase): SelectExpression {
    // *** NOVO: Usa aliasGenerator se a fonte não tiver alias ***
    const sourceAlias =
      source.alias ||
      this.aliasGenerator.generateAlias(
        source instanceof TableExpression ? source.name : source.type // Base para o prefixo
      );
    // Se a fonte original não tinha alias, atualiza-a (mutação controlada aqui)
    if (!source.alias && source instanceof TableExpressionBase) {
      // Esta mutação é geralmente segura no fluxo de tradução, pois a fonte
      // original (TableExpression ou CompositeUnion) não será reutilizada
      // diretamente com alias diferente após esta etapa.
      (source as { alias: string }).alias = sourceAlias;
    }

    const tableRefForColumn = new TableExpression(
      source.type === SqlExpressionType.Table
        ? (source as TableExpression).name
        : "(<derived>)",
      sourceAlias // Usa o alias garantido
    );
    const placeholderProjection = new ProjectionExpression(
      new ColumnExpression("*", tableRefForColumn),
      "*"
    );

    // O alias da SelectExpression que *envolve* a fonte base é o mesmo da fonte
    const selectAlias = sourceAlias;

    return new SelectExpression(
      selectAlias, // alias (Reutiliza da fonte)
      [placeholderProjection], // projection
      source, // from (a própria fonte)
      null, // predicate
      null, // having
      [], // joins
      [], // orderBy
      null, // offset
      null, // limit
      [] // groupBy
    );
  }

  /**
   * Método dispatcher principal para visitar nós da árvore LINQ.
   */
  protected visit(expression: LinqExpression | null): SqlExpression | null {
    // (Lógica do dispatcher inalterada)
    if (!expression) return null;
    if (expression.type === LinqExpressionType.Call) {
      const callExpr = expression as LinqMethodCallExpression;
      switch (callExpr.methodName) {
        case "exists":
          return this.translateExistsExpression(callExpr);
        case "includes":
          return visitIncludesCall(
            callExpr,
            this.context,
            this.visit.bind(this)
          );
      }
    }
    switch (expression.type) {
      case LinqExpressionType.Constant:
        return this.visitConstant(expression as LinqConstantExpression);
      case LinqExpressionType.Parameter:
        return this.visitParameter(expression as LinqParameterExpression);
      case LinqExpressionType.MemberAccess:
        return this.visitMember(expression as LinqMemberExpression);
      case LinqExpressionType.Call:
        return this.visitMethodCall(expression as LinqMethodCallExpression);
      case LinqExpressionType.Binary:
        return this.visitBinary(expression as LinqBinaryExpression);
      case LinqExpressionType.Literal:
        return this.visitLiteral(expression as LinqLiteralExpression);
      case LinqExpressionType.Lambda:
        throw new Error(
          "Internal Error: Cannot directly visit LambdaExpression."
        );
      case LinqExpressionType.NewObject:
        throw new Error(
          "Internal Error: Cannot directly visit NewObjectExpression. It should be handled by projection logic."
        );
      case LinqExpressionType.Scope:
        return this.visit((expression as ScopeExpression).sourceExpression);
      default:
        const exhaustiveCheck: never = expression.type;
        throw new Error(`Unsupported LINQ expression type: ${exhaustiveCheck}`);
    }
  }

  /**
   * Visita ConstantExpression (Tabela). Usa AliasGenerator.
   */
  protected visitConstant(expression: LinqConstantExpression): SqlExpression {
    const value = expression.value;
    if (value && typeof value === "object" && value.type === "Table") {
      const tableName = getTableName(expression);
      if (!tableName)
        throw new Error("Could not get table name from ConstantExpression.");
      // *** NOVO: Usa aliasGenerator ***
      const alias = this.aliasGenerator.generateAlias(tableName);
      return new TableExpression(tableName, alias);
    } else {
      return new SqlConstantExpression(value);
    }
  }

  // (visitLiteral, visitParameter, visitMember, visitBinary - inalterados)
  protected visitLiteral(expression: LinqLiteralExpression): SqlExpression {
    return new SqlConstantExpression(expression.value);
  }
  protected visitParameter(expression: LinqParameterExpression): SqlExpression {
    return this.context.getDataSourceForParameterStrict(expression);
  }
  protected visitMember(expression: LinqMemberExpression): SqlExpression {
    const memberName = expression.memberName;
    const sourceSqlBase = this.visit(expression.objectExpression);
    if (!sourceSqlBase)
      throw new Error(`Could not resolve source for member '${memberName}'.`);
    if ((sourceSqlBase as any).isGroupKeyPlaceholder) {
      const keySql = (sourceSqlBase as any).getSqlForKeyAccess(memberName);
      if (keySql) return keySql;
      else
        throw new Error(
          `Could not resolve key member '${memberName}' in groupBy resultSelector.`
        );
    }
    if (sourceSqlBase && (sourceSqlBase as any).isGroupKeyPlaceholder) {
      const keySql = (sourceSqlBase as any).getSqlForKeyAccess();
      if (keySql) return keySql;
    }
    if (sourceSqlBase instanceof TableExpressionBase) {
      const sourceAlias = sourceSqlBase.alias;
      if (!sourceAlias) {
        throw new Error(
          `Source for member '${memberName}' is missing an alias. Source type: ${sourceSqlBase.constructor.name}`
        );
      }
      if (sourceSqlBase instanceof TableExpression) {
        return new ColumnExpression(memberName, sourceSqlBase);
      } else if (sourceSqlBase instanceof SelectExpression) {
        const projection = sourceSqlBase.projection.find(
          (p) => p.alias === memberName
        );
        if (projection) {
          return projection.expression;
        }
        const starProjection = sourceSqlBase.projection.find(
          (p) =>
            p.alias === "*" &&
            p.expression instanceof ColumnExpression &&
            p.expression.name === "*"
        );
        if (
          starProjection &&
          starProjection.expression instanceof ColumnExpression &&
          starProjection.expression.table
        ) {
          console.warn(
            `Accessing member '${memberName}' via '*' projection on SelectExpression [${sourceAlias}]. This might be ambiguous.`
          );
          return new ColumnExpression(
            memberName,
            starProjection.expression.table
          );
        }
        const tablePlaceholderAlias = memberName + "_all";
        const tableProjection = sourceSqlBase.projection.find(
          (p) =>
            p.alias === tablePlaceholderAlias &&
            p.expression instanceof ColumnExpression &&
            p.expression.name === "*"
        );
        if (
          tableProjection &&
          tableProjection.expression instanceof ColumnExpression &&
          tableProjection.expression.table
        ) {
          return tableProjection.expression.table;
        }
        const tempTableForSelect = new TableExpression(
          `(<select>)`,
          sourceAlias
        );
        return new ColumnExpression(memberName, tempTableForSelect);
      } else if (sourceSqlBase instanceof CompositeUnionExpression) {
        const tempTableForUnion = new TableExpression(`(<union>)`, sourceAlias);
        return new ColumnExpression(memberName, tempTableForUnion);
      } else {
        throw new Error(
          `Unexpected type derived from TableExpressionBase: ${sourceSqlBase.constructor.name}`
        );
      }
    } else if (sourceSqlBase instanceof ColumnExpression) {
      throw new Error(
        `Accessing member '${memberName}' on a ColumnExpression ('${sourceSqlBase.name}') is not yet supported (requires SQL function mapping like LEN, etc.).`
      );
    } else if (sourceSqlBase instanceof SqlConstantExpression) {
      throw new Error(
        `Accessing member '${memberName}' on a ConstantExpression is not yet supported.`
      );
    } else {
      throw new Error(
        `Cannot access member '${memberName}' on SQL type: ${sourceSqlBase.constructor.name}`
      );
    }
  }
  protected visitBinary(expression: LinqBinaryExpression): SqlExpression {
    const leftLinq = expression.left;
    const rightLinq = expression.right;
    const operator = expression.operator as LinqOperatorType;
    const leftSql = this.visit(leftLinq);
    const rightSql = this.visit(rightLinq);
    if (!leftSql || !rightSql) {
      throw new Error("Binary operands translation failed.");
    }
    if (
      leftSql instanceof SqlConstantExpression &&
      rightSql instanceof ColumnExpression
    ) {
      let flippedOp = operator;
      if (operator === LinqOperatorType.LessThan)
        flippedOp = LinqOperatorType.GreaterThan;
      else if (operator === LinqOperatorType.LessThanOrEqual)
        flippedOp = LinqOperatorType.GreaterThanOrEqual;
      else if (operator === LinqOperatorType.GreaterThan)
        flippedOp = LinqOperatorType.LessThan;
      else if (operator === LinqOperatorType.GreaterThanOrEqual)
        flippedOp = LinqOperatorType.LessThanOrEqual;
      if (flippedOp !== operator) {
        return new SqlBinaryExpression(rightSql, flippedOp, leftSql);
      }
    }
    return new SqlBinaryExpression(leftSql, operator, rightSql);
  }

  /**
   * Visita MethodCallExpression. Usa AliasGenerator e passa para os visitors.
   */
  protected visitMethodCall(
    expression: LinqMethodCallExpression
  ): SelectExpression | CompositeUnionExpression {
    const methodName = expression.methodName;
    const sourceLinqExpr = expression.source;
    if (!sourceLinqExpr) {
      throw new Error(
        `Translation Error: Method call '${methodName}' requires a source expression.`
      );
    }

    // --- TRATAMENTO UNION/CONCAT ---
    if (methodName === "union" || methodName === "concat") {
      if (expression.args.length !== 1) {
        throw new Error(`Invalid arguments for '${methodName}'.`);
      }
      const isDistinct = methodName === "union";
      const secondLinqExpr = expression.args[0];
      const firstVisited = this.visit(sourceLinqExpr);
      const secondVisited = this.visit(secondLinqExpr);
      let secondSelect: SelectExpression;
      if (
        secondVisited instanceof TableExpression ||
        secondVisited instanceof CompositeUnionExpression
      ) {
        secondSelect = this.createDefaultSelect(secondVisited);
      } else if (secondVisited instanceof SelectExpression) {
        secondSelect = secondVisited;
      } else {
        throw new Error(
          `Second argument for '${methodName}' did not translate to Table, Select, or Union.`
        );
      }
      if (
        firstVisited instanceof CompositeUnionExpression &&
        firstVisited.distinct === isDistinct
      ) {
        const existingSources = firstVisited.sources;
        const newSources = [...existingSources, secondSelect];
        // *** NOVO: Usa aliasGenerator ***
        const unionAlias = this.aliasGenerator.generateAlias("union");
        return new CompositeUnionExpression(newSources, unionAlias, isDistinct);
      } else {
        let firstSelect: SelectExpression;
        if (
          firstVisited instanceof TableExpression ||
          firstVisited instanceof CompositeUnionExpression
        ) {
          firstSelect = this.createDefaultSelect(firstVisited);
        } else if (firstVisited instanceof SelectExpression) {
          firstSelect = firstVisited;
        } else {
          throw new Error(
            `First argument for '${methodName}' did not translate to Table, Select, or Union.`
          );
        }
        // *** NOVO: Usa aliasGenerator ***
        const unionAlias = this.aliasGenerator.generateAlias("union");
        return new CompositeUnionExpression(
          [firstSelect, secondSelect],
          unionAlias,
          isDistinct
        );
      }
    }
    // --- FIM TRATAMENTO UNION/CONCAT ---

    const baseSql = this.visit(sourceLinqExpr);
    if (!baseSql) {
      throw new Error(
        `Translation Error: Visiting the source expression for method '${methodName}' failed. Source: ${sourceLinqExpr.toString()}`
      );
    }
    let currentSelect: SelectExpression;
    let sourceForLambda: SqlDataSource;
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
      throw new Error(
        `Translation Error: Cannot apply method '${methodName}' to SQL source of type '${baseSql.constructor.name}'. Expected Table, Select, or Union.`
      );
    }

    const boundVisitInContext: VisitInContextFn =
      this.visitInContext.bind(this);

    if (methodName === "where") {
      let isSourceGroupBy = false;
      if (
        sourceLinqExpr.type === LinqExpressionType.Call &&
        (sourceLinqExpr as LinqMethodCallExpression).methodName === "groupBy"
      ) {
        isSourceGroupBy = true;
      }
      if (isSourceGroupBy) {
        // Passa aliasGenerator explicitamente se o visitor precisar (neste caso, não precisa)
        return visitHavingCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext
        );
      } else {
        // Passa aliasGenerator explicitamente se o visitor precisar (neste caso, não precisa)
        return visitWhereCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext
        );
      }
    }

    switch (methodName) {
      case "select":
        // *** Passa aliasGenerator ***
        return visitSelectCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.createProjections.bind(this),
          this.aliasGenerator
        );
      case "join":
        // *** Passa aliasGenerator ***
        return visitJoinCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visit.bind(this),
          boundVisitInContext,
          this.createProjections.bind(this),
          this.aliasGenerator
        );
      case "orderBy":
      case "orderByDescending":
        const orderDir = methodName === "orderBy" ? "ASC" : "DESC";
        // Não precisa de aliasGenerator
        return visitOrderByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          orderDir
        );
      case "thenBy":
      case "thenByDescending":
        const thenDir = methodName === "thenBy" ? "ASC" : "DESC";
        // Não precisa de aliasGenerator
        return visitThenByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          thenDir
        );
      case "skip":
        // Não precisa de aliasGenerator
        return visitSkipCall(expression, currentSelect, this.context);
      case "take":
        // Não precisa de aliasGenerator
        return visitTakeCall(expression, currentSelect, this.context);
      case "count":
        // *** Passa aliasGenerator (para o alias do Select resultante) ***
        return visitCountCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "avg":
        // *** Passa aliasGenerator (para o alias do Select resultante) ***
        return visitAvgCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "sum":
        // *** Passa aliasGenerator (para o alias do Select resultante) ***
        return visitSumCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "min":
        // *** Passa aliasGenerator (para o alias do Select resultante) ***
        return visitMinCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "max":
        // *** Passa aliasGenerator (para o alias do Select resultante) ***
        return visitMaxCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "groupBy":
        // *** Passa aliasGenerator ***
        return visitGroupByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this,
          this.aliasGenerator
        );
      default:
        throw new Error(
          `Unsupported LINQ method call during translation: ${methodName}`
        );
    }
  }

  // translateExistsExpression (Usa aliasGenerator)
  private translateExistsExpression(
    expression: LinqMethodCallExpression
  ): SqlExistsExpression {
    if (!expression.source) throw new Error("'exists' requires a source.");
    let sourceSql = this.visit(expression.source);
    if (!sourceSql) throw new Error("Could not translate 'exists' source.");
    let selectForExists: SelectExpression;

    if (
      sourceSql instanceof TableExpression ||
      sourceSql instanceof CompositeUnionExpression
    ) {
      selectForExists = this.createDefaultSelect(sourceSql);
    } else if (sourceSql instanceof SelectExpression) {
      selectForExists = sourceSql;
    } else {
      throw new Error(
        `'exists' requires Table, Select or Union source. Found: ${sourceSql.constructor.name}`
      );
    }

    if (expression.args.length > 0) {
      // (Lógica do predicado inalterada...)
      if (
        expression.args.length !== 1 ||
        expression.args[0].type !== LinqExpressionType.Lambda
      ) {
        throw new Error("Invalid 'exists' predicate arguments.");
      }
      const lambda = expression.args[0] as LinqLambdaExpression;
      const param = lambda.parameters[0];
      const sourceForPredicate: SqlDataSource =
        selectForExists.from instanceof TableExpressionBase &&
        selectForExists.projection.length === 1 &&
        selectForExists.projection[0].expression instanceof ColumnExpression &&
        selectForExists.projection[0].expression.name === "*"
          ? selectForExists.from
          : selectForExists;
      const predicateContext = this.context.createChildContext(
        [param],
        [sourceForPredicate]
      );
      const predicateSql = this.visitInContext(lambda.body, predicateContext);
      if (!predicateSql)
        throw new Error("Could not translate 'exists' predicate.");
      const newPredicate = selectForExists.predicate
        ? new SqlBinaryExpression(
            selectForExists.predicate,
            LinqOperatorType.And,
            predicateSql
          )
        : predicateSql;

      selectForExists = new SelectExpression(
        selectForExists.alias, // alias
        selectForExists.projection, // projection
        selectForExists.from, // from
        newPredicate, // predicate
        null, // having
        selectForExists.joins, // joins
        selectForExists.orderBy, // orderBy
        selectForExists.offset, // offset
        selectForExists.limit, // limit
        selectForExists.groupBy // groupBy
      );
    }

    const existsProjection = new ProjectionExpression(
      new SqlConstantExpression(1),
      "exists_val"
    );
    const existsAlias = ""; // Alias vazio para subconsulta EXISTS

    const finalSelectForExists = new SelectExpression(
      existsAlias, // alias
      [existsProjection], // projection
      selectForExists.from, // from
      selectForExists.predicate, // predicate
      null, // having
      selectForExists.joins, // joins
      [], // orderBy
      null, // offset
      null, // limit
      [] // groupBy
    );
    return new SqlExistsExpression(finalSelectForExists);
  }

  // visitInContext (inalterado)
  private visitInContext(
    expression: LinqExpression,
    context: TranslationContext
  ): SqlExpression | null {
    const originalContext = this.context;
    this.context = context;
    let result: SqlExpression | null = null;
    try {
      result = this.visit(expression);
    } finally {
      this.context =
        originalContext; /* Não precisa mais atualizar alias counter */
    }
    return result;
  }

  // createProjections (Usa aliasGenerator)
  public createProjections(
    body: LinqExpression,
    context: TranslationContext
  ): ProjectionExpression[] {
    const projections: ProjectionExpression[] = [];
    const visit = (expr: LinqExpression) => this.visitInContext(expr, context);

    if (body.type === LinqExpressionType.NewObject) {
      const newObject = body as LinqNewObjectExpression;
      for (const [alias, expr] of newObject.properties.entries()) {
        let sqlExpr = visit(expr); // Usa let
        if (!sqlExpr)
          throw new Error(`Projection failed for alias '${alias}'.`);
        if (sqlExpr instanceof TableExpression) {
          projections.push(
            new ProjectionExpression(
              new ColumnExpression("*", sqlExpr),
              alias + "_all"
            )
          );
        } else if (sqlExpr instanceof SelectExpression) {
          let isKnownAggregate = false;
          if (
            sqlExpr.projection.length === 1 &&
            sqlExpr.projection[0].expression instanceof
              SqlFunctionCallExpression
          ) {
            const funcName = (
              sqlExpr.projection[0].expression as SqlFunctionCallExpression
            ).functionName.toUpperCase();
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
            const useWithoutArrayWrapper =
              sqlExpr.limit instanceof SqlConstantExpression &&
              sqlExpr.limit.value === 1;
            if (!sqlExpr.alias && !useScalarSubquery) {
              console.warn(
                `SelectExpression for JSON projection '${alias}' was missing alias. Generating one.`
              );
              // *** NOVO: Usa aliasGenerator ***
              const subAlias = this.aliasGenerator.generateAlias("select");
              // Recria o Select com um alias novo
              sqlExpr = new SelectExpression(
                subAlias,
                sqlExpr.projection,
                sqlExpr.from,
                sqlExpr.predicate,
                sqlExpr.having,
                sqlExpr.joins,
                sqlExpr.orderBy,
                sqlExpr.offset,
                sqlExpr.limit,
                sqlExpr.groupBy
              );
            }
            subqueryExpression = new SqlScalarSubqueryAsJsonExpression(
              sqlExpr as SelectExpression,
              undefined,
              undefined,
              useWithoutArrayWrapper
            );
          }
          projections.push(new ProjectionExpression(subqueryExpression, alias));
        } else if (
          sqlExpr instanceof ColumnExpression ||
          sqlExpr instanceof SqlConstantExpression ||
          sqlExpr instanceof SqlFunctionCallExpression ||
          sqlExpr instanceof SqlBinaryExpression ||
          sqlExpr instanceof SqlLikeExpression
        ) {
          projections.push(new ProjectionExpression(sqlExpr, alias));
        } else {
          throw new Error(
            `Unexpected SQL expression type (${sqlExpr.constructor.name}) encountered during projection creation for alias '${alias}'.`
          );
        }
      }
    } else if (body.type === LinqExpressionType.Parameter) {
      const param = body as LinqParameterExpression;
      const source = visit(param);
      let tableOrUnionSource: TableExpressionBase | null = null;
      if (source instanceof TableExpression) {
        tableOrUnionSource = source;
      } else if (
        source instanceof SelectExpression &&
        source.from instanceof TableExpressionBase
      ) {
        tableOrUnionSource = source.from;
        console.warn(
          `Identity projection on a SelectExpression [${tableOrUnionSource?.alias}]. Projecting underlying source columns.`
        );
      } else if (source instanceof CompositeUnionExpression) {
        tableOrUnionSource = source;
        console.warn(
          `Identity projection on a Union source [${tableOrUnionSource?.alias}]. Projecting union result columns.`
        );
      }
      if (!tableOrUnionSource)
        throw new Error(
          `Identity projection did not resolve to a base table or union source. Found: ${source?.constructor.name}`
        );
      const tempTable = new TableExpression(
        tableOrUnionSource.type === SqlExpressionType.Union
          ? "(<union>)"
          : "(<table>)",
        tableOrUnionSource.alias
      );
      projections.push(
        new ProjectionExpression(new ColumnExpression("*", tempTable), "*")
      );
    } else {
      const sqlExpr = visit(body);
      if (!sqlExpr)
        throw new Error(
          `Simple projection translation failed for: ${body.toString()}`
        );
      if (
        sqlExpr instanceof ColumnExpression ||
        sqlExpr instanceof SqlConstantExpression ||
        sqlExpr instanceof SqlFunctionCallExpression ||
        sqlExpr instanceof SqlBinaryExpression ||
        sqlExpr instanceof SqlLikeExpression
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
          `Simple projection resolved to a Table/Select/Union expression unexpectedly: ${body.toString()}`
        );
      } else {
        throw new Error(
          `Simple projection did not resolve to a simple column/value/aggregate/known SQL type. Result type: ${
            sqlExpr.constructor.name
          }, Original LINQ: ${body.toString()}`
        );
      }
    }
    if (projections.length === 0) {
      throw new Error(
        "Internal Error: Projection creation resulted in empty list."
      );
    }
    return projections;
  }
} // Fim da classe QueryExpressionVisitor

// --- END OF FILE src/query/translation/QueryExpressionVisitor.ts ---
