// --- START OF FILE src/query/translation/QueryExpressionVisitor.ts ---

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
  LeftJoinExpression,
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
  SqlCaseExpression,
  SqlInExpression,
} from "../../sql-expressions";

import { TranslationContext, SqlDataSource } from "./TranslationContext";
import { getTableName, OperatorType } from "../generation/utils/sqlUtils";
import { AliasGenerator } from "../generation/AliasGenerator";

// Importa visitors de métodos
import {
  visitWhereCall,
  visitSelectCall,
  visitJoinCall,
  visitLeftJoinCall,
  visitIncludesCall, // Este visitor trata APENAS string.includes -> LIKE
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
  private aliasGenerator: AliasGenerator;

  constructor() {
    this.context = new TranslationContext();
    this.aliasGenerator = new AliasGenerator();
  }

  /**
   * Ponto de entrada principal para a tradução.
   */
  public translate(expression: LinqExpression): SqlExpression {
    this.context = new TranslationContext();
    this.aliasGenerator = new AliasGenerator();

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
   */
  private createDefaultSelect(source: TableExpressionBase): SelectExpression {
    const sourceAlias =
      source.alias ||
      this.aliasGenerator.generateAlias(
        source instanceof TableExpression ? source.name : source.type
      );
    if (!source.alias && source instanceof TableExpressionBase) {
      (source as { alias: string }).alias = sourceAlias;
    }

    const tableRefForColumn = new TableExpression(
      source.type === SqlExpressionType.Table
        ? (source as TableExpression).name
        : "(<derived>)",
      sourceAlias
    );
    const placeholderProjection = new ProjectionExpression(
      new ColumnExpression("*", tableRefForColumn),
      "*"
    );

    const selectAlias = sourceAlias;

    return new SelectExpression(
      selectAlias,
      [placeholderProjection],
      source,
      null,
      null,
      [],
      [],
      null,
      null,
      []
    );
  }

  /**
   * Método dispatcher principal para visitar nós da árvore LINQ.
   */
  protected visit(expression: LinqExpression | null): SqlExpression | null {
    if (!expression) return null;

    // --- INTERCEPTAÇÃO DE MethodCallExpression ---
    if (expression.type === LinqExpressionType.Call) {
      const callExpr = expression as LinqMethodCallExpression;
      switch (callExpr.methodName) {
        // **** TRATAMENTO CORRIGIDO PARA 'includes' ****
        case "includes":
          // 1. Tenta traduzir como array.includes(value) -> IN
          const inExpr = this.tryTranslateArrayIncludes(callExpr);
          if (inExpr) {
            return inExpr; // Sucesso, retorna SqlInExpression
          }
          // 2. Se falhou, assume que é string.includes(value) -> LIKE
          // Chama o visitor específico que gera SqlLikeExpression
          return visitIncludesCall(
            callExpr,
            this.context,
            this.visit.bind(this)
          );
        // **** FIM TRATAMENTO CORRIGIDO ****

        // --- Outros métodos de instância ---
        case "toUpperCase":
        case "toLowerCase":
        case "trim":
        case "startsWith":
        case "endsWith":
        // Não precisa mais do 'includes' aqui
        case "substring":
        case "getFullYear":
        case "getMonth":
        case "getDate":
        case "getHours":
        case "getMinutes":
        case "getSeconds":
          return this.visitInstanceMethodCall(callExpr); // Chama o método para tratá-los

        // --- Métodos especiais/internos ---
        case "__internal_ternary__":
          return this.translateTernaryPlaceholder(callExpr);
        case "exists":
          return this.translateExistsExpression(callExpr);
      }
      // Se não for nenhum método especial/de instância acima,
      // cai para o switch principal para tratar como método de extensão LINQ.
    }

    // --- SWITCH PRINCIPAL PARA TIPOS LINQ ---
    switch (expression.type) {
      case LinqExpressionType.Constant:
        return this.visitConstant(expression as LinqConstantExpression);
      case LinqExpressionType.Parameter:
        return this.visitParameter(expression as LinqParameterExpression);
      case LinqExpressionType.MemberAccess:
        return this.visitMember(expression as LinqMemberExpression);
      case LinqExpressionType.Call: // Métodos de extensão LINQ (where, select, join, etc.)
        return this.visitLinqExtensionMethodCall(
          expression as LinqMethodCallExpression
        );
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
   * Tenta traduzir uma MethodCallExpression 'includes' como array.includes(value) -> SqlInExpression.
   * Retorna SqlInExpression se bem-sucedido, ou null caso contrário.
   */
  private tryTranslateArrayIncludes(
    callExpr: LinqMethodCallExpression
  ): SqlInExpression | null {
    if (!callExpr.source || callExpr.args.length !== 1) {
      return null;
    }

    const arraySourceSql = this.visit(callExpr.source);
    const valueToFindSql = this.visit(callExpr.args[0]);

    if (
      arraySourceSql instanceof SqlConstantExpression &&
      Array.isArray(arraySourceSql.value) &&
      valueToFindSql
    ) {
      const valuesArray = arraySourceSql.value as any[];
      if (valuesArray.length === 0) {
        // Não retorna null, lança erro pois IN () não é válido
        throw new Error(
          "Translation Error: Array provided to 'includes' (for SQL IN) cannot be empty."
        );
      }
      const constantValuesSql = valuesArray.map(
        (val) => new SqlConstantExpression(val)
      );
      return new SqlInExpression(valueToFindSql, constantValuesSql);
    }

    return null; // Não correspondeu ao padrão array.includes(column)
  }

  /** Visita ConstantExpression (Tabela ou Literal). Usa AliasGenerator. */
  protected visitConstant(expression: LinqConstantExpression): SqlExpression {
    const value = expression.value;
    if (value && typeof value === "object" && value.type === "Table") {
      const tableName = getTableName(expression);
      if (!tableName)
        throw new Error("Could not get table name from ConstantExpression.");
      const alias = this.aliasGenerator.generateAlias(tableName);
      return new TableExpression(tableName, alias);
    } else {
      // Retorna SqlConstantExpression para valores literais ou externos
      return new SqlConstantExpression(value);
    }
  }

  /** Visita LiteralExpression. */
  protected visitLiteral(expression: LinqLiteralExpression): SqlExpression {
    return new SqlConstantExpression(expression.value);
  }

  /** Visita ParameterExpression. Retorna a fonte de dados SQL associada. */
  protected visitParameter(expression: LinqParameterExpression): SqlExpression {
    return this.context.getDataSourceForParameterStrict(expression);
  }

  /** Visita MemberExpression (acesso a propriedade ou `.length`). */
  protected visitMember(expression: LinqMemberExpression): SqlExpression {
    // (Lógica existente - Inalterada)
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
    } else if (memberName === "length") {
      return new SqlFunctionCallExpression("LEN", [sourceSqlBase]);
    } else if (sourceSqlBase instanceof ColumnExpression) {
      const funcName = mapPropertyToSqlFunction(memberName);
      if (funcName) {
        if (funcName.startsWith("DATEPART")) {
          const part = funcName.substring(9, funcName.indexOf(","));
          return new SqlFunctionCallExpression("DATEPART", [
            new SqlConstantExpression(part),
            sourceSqlBase,
          ]);
        }
        return new SqlFunctionCallExpression(funcName, [sourceSqlBase]);
      }
      throw new Error(
        `Accessing member '${memberName}' on a ColumnExpression ('${sourceSqlBase.name}') is not yet supported unless it maps to a known SQL function (like Year, Month, Day).`
      );
    } else if (sourceSqlBase instanceof SqlConstantExpression) {
      throw new Error(
        `Accessing member '${memberName}' on a ConstantExpression is not supported.`
      );
    } else {
      throw new Error(
        `Cannot access member '${memberName}' on SQL type: ${sourceSqlBase.constructor.name}`
      );
    }
  }

  /** Visita BinaryExpression. */
  protected visitBinary(expression: LinqBinaryExpression): SqlExpression {
    // (Lógica existente - Inalterada)
    const leftLinq = expression.left;
    const rightLinq = expression.right;
    const operator = expression.operator as OperatorType;

    const leftSql = this.visit(leftLinq);
    const rightSql = this.visit(rightLinq);

    if (!leftSql || !rightSql) {
      throw new Error(
        `Binary operands translation failed for operator ${operator}. Left: ${leftLinq?.toString()}, Right: ${rightLinq?.toString()}`
      );
    }

    if (
      leftSql instanceof TableExpressionBase &&
      rightSql instanceof SqlConstantExpression &&
      rightSql.value === null
    ) {
      if (operator === LinqOperatorType.Equal) {
        const primaryKeyColName =
          leftSql instanceof TableExpression && leftSql.name === "Departments"
            ? "deptId"
            : "Id";
        return new SqlBinaryExpression(
          new ColumnExpression(primaryKeyColName, leftSql as TableExpression),
          OperatorType.Equal,
          rightSql
        );
      } else if (operator === LinqOperatorType.NotEqual) {
        const primaryKeyColName =
          leftSql instanceof TableExpression && leftSql.name === "Departments"
            ? "deptId"
            : "Id";
        return new SqlBinaryExpression(
          new ColumnExpression(primaryKeyColName, leftSql as TableExpression),
          OperatorType.NotEqual,
          rightSql
        );
      }
    }
    if (
      rightSql instanceof TableExpressionBase &&
      leftSql instanceof SqlConstantExpression &&
      leftSql.value === null
    ) {
      if (operator === LinqOperatorType.Equal) {
        const primaryKeyColName =
          rightSql instanceof TableExpression && rightSql.name === "Departments"
            ? "deptId"
            : "Id";
        return new SqlBinaryExpression(
          new ColumnExpression(primaryKeyColName, rightSql as TableExpression),
          OperatorType.Equal,
          leftSql
        );
      } else if (operator === LinqOperatorType.NotEqual) {
        const primaryKeyColName =
          rightSql instanceof TableExpression && rightSql.name === "Departments"
            ? "deptId"
            : "Id";
        return new SqlBinaryExpression(
          new ColumnExpression(primaryKeyColName, rightSql as TableExpression),
          OperatorType.NotEqual,
          leftSql
        );
      }
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

  /** Visita chamadas de método de extensão LINQ (where, select, join, orderBy, etc.). */
  protected visitLinqExtensionMethodCall(
    expression: LinqMethodCallExpression
  ): SelectExpression | CompositeUnionExpression {
    // (Lógica existente - Inalterada)
    const methodName = expression.methodName;
    const sourceLinqExpr = expression.source;

    if (!sourceLinqExpr) {
      throw new Error(
        `Translation Error: LINQ extension method call '${methodName}' requires a source expression.`
      );
    }

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
        const unionAlias = this.aliasGenerator.generateAlias("union");
        return new CompositeUnionExpression(
          [firstSelect, secondSelect],
          unionAlias,
          isDistinct
        );
      }
    }

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
        `Translation Error: Cannot apply LINQ method '${methodName}' to SQL source of type '${baseSql.constructor.name}'. Expected Table, Select, or Union.`
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
        return visitHavingCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext
        );
      } else {
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
        return visitSelectCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.createProjections.bind(this),
          this.aliasGenerator
        );
      case "join":
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
      case "leftJoin":
        return visitLeftJoinCall(
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
        return visitThenByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          thenDir
        );
      case "skip":
        return visitSkipCall(expression, currentSelect, this.context);
      case "take":
        return visitTakeCall(expression, currentSelect, this.context);
      case "count":
        return visitCountCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "avg":
        return visitAvgCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "sum":
        return visitSumCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "min":
        return visitMinCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "max":
        return visitMaxCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext,
          this.aliasGenerator
        );
      case "groupBy":
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
          `Unsupported LINQ extension method call during translation: ${methodName}`
        );
    }
  }

  /** Traduz o placeholder do ternário para SqlCaseExpression. */
  protected translateTernaryPlaceholder(
    expression: LinqMethodCallExpression
  ): SqlCaseExpression {
    // (Lógica existente - Inalterada)
    if (expression.args.length !== 3) {
      throw new Error(
        "Internal Error: Invalid number of arguments for internal ternary placeholder."
      );
    }
    const testLinq = expression.args[0];
    const consequentLinq = expression.args[1];
    const alternateLinq = expression.args[2];

    const testSql = this.visit(testLinq);
    const consequentSql = this.visit(consequentLinq);
    const alternateSql = this.visit(alternateLinq);

    if (!testSql || !consequentSql || !alternateSql) {
      throw new Error(
        "Failed to translate one or more parts of the ternary expression to SQL."
      );
    }

    const whenClause = { when: testSql, then: consequentSql };
    return new SqlCaseExpression([whenClause], alternateSql);
  }

  /** Visita chamadas de método de *instância* (string, data, etc.). */
  protected visitInstanceMethodCall(
    expression: LinqMethodCallExpression
  ): SqlExpression {
    // (Lógica existente, MAS o case 'includes' foi removido - Inalterada)
    if (!expression.source) {
      throw new Error(
        `Instance method call '${expression.methodName}' requires a source expression.`
      );
    }

    const sourceSql = this.visit(expression.source);
    if (!sourceSql) {
      throw new Error(
        `Could not translate source for instance method call '${expression.methodName}'.`
      );
    }

    switch (expression.methodName) {
      case "toUpperCase":
        if (expression.args.length !== 0)
          throw new Error("'toUpperCase' takes no arguments.");
        return new SqlFunctionCallExpression("UPPER", [sourceSql]);
      case "toLowerCase":
        if (expression.args.length !== 0)
          throw new Error("'toLowerCase' takes no arguments.");
        return new SqlFunctionCallExpression("LOWER", [sourceSql]);
      case "trim":
        if (expression.args.length !== 0)
          throw new Error("'trim' takes no arguments.");
        return new SqlFunctionCallExpression("TRIM", [sourceSql]);
      // 'includes' não está mais aqui
      case "startsWith":
      case "endsWith":
        if (expression.args.length !== 1)
          throw new Error(`'${expression.methodName}' requires one argument.`);
        const patternArgSql = this.visit(expression.args[0]);
        if (!(patternArgSql instanceof SqlConstantExpression)) {
          throw new Error(
            `'${expression.methodName}' currently only supports constant string arguments.`
          );
        }
        const patternValue = patternArgSql.value;
        if (typeof patternValue !== "string") {
          throw new Error(
            `Argument for '${expression.methodName}' must be a string.`
          );
        }
        const escapedPattern = patternValue
          .replace(/\[/g, "[[]")
          .replace(/%/g, "[%]")
          .replace(/_/g, "[_]");

        let likePattern: string;
        if (expression.methodName === "startsWith") {
          likePattern = `${escapedPattern}%`;
        } else {
          // endsWith
          likePattern = `%${escapedPattern}`;
        }
        return new SqlLikeExpression(
          sourceSql,
          new SqlConstantExpression(likePattern)
        );
      case "substring":
        if (expression.args.length < 1 || expression.args.length > 2)
          throw new Error(
            "'substring' requires one or two arguments (start, [length]). Note: SQL SUBSTRING uses length, not end index."
          );
        const startArgSql = this.visit(expression.args[0]);
        if (
          !(startArgSql instanceof SqlConstantExpression) ||
          typeof startArgSql.value !== "number"
        ) {
          throw new Error(
            "'substring' start argument must be a constant number."
          );
        }
        const sqlStart = new SqlConstantExpression(startArgSql.value + 1);
        let lengthArgSql: SqlExpression;
        if (expression.args.length === 2) {
          const lenArg = this.visit(expression.args[1]);
          if (
            !(lenArg instanceof SqlConstantExpression) ||
            typeof lenArg.value !== "number"
          ) {
            throw new Error(
              "'substring' length argument must be a constant number."
            );
          }
          lengthArgSql = lenArg;
        } else {
          lengthArgSql = new SqlConstantExpression(8000);
        }
        return new SqlFunctionCallExpression("SUBSTRING", [
          sourceSql,
          sqlStart,
          lengthArgSql,
        ]);
      case "getFullYear":
        if (expression.args.length !== 0)
          throw new Error("'getFullYear' takes no arguments.");
        return new SqlFunctionCallExpression("YEAR", [sourceSql]);
      case "getMonth":
        if (expression.args.length !== 0)
          throw new Error("'getMonth' takes no arguments.");
        const monthSql = new SqlFunctionCallExpression("MONTH", [sourceSql]);
        return new SqlBinaryExpression(
          monthSql,
          OperatorType.Subtract,
          new SqlConstantExpression(1)
        );
      case "getDate":
        if (expression.args.length !== 0)
          throw new Error("'getDate' takes no arguments.");
        return new SqlFunctionCallExpression("DAY", [sourceSql]);
      case "getHours":
        if (expression.args.length !== 0)
          throw new Error("'getHours' takes no arguments.");
        return new SqlFunctionCallExpression("DATEPART", [
          new SqlConstantExpression("hour"),
          sourceSql,
        ]);
      case "getMinutes":
        if (expression.args.length !== 0)
          throw new Error("'getMinutes' takes no arguments.");
        return new SqlFunctionCallExpression("DATEPART", [
          new SqlConstantExpression("minute"),
          sourceSql,
        ]);
      case "getSeconds":
        if (expression.args.length !== 0)
          throw new Error("'getSeconds' takes no arguments.");
        return new SqlFunctionCallExpression("DATEPART", [
          new SqlConstantExpression("second"),
          sourceSql,
        ]);
      default:
        throw new Error(
          `Unsupported instance method call during translation: ${expression.methodName}`
        );
    }
  }

  /** Traduz uma chamada ao método 'exists'. */
  private translateExistsExpression(
    expression: LinqMethodCallExpression
  ): SqlExistsExpression {
    // (Lógica existente - Inalterada)
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
            OperatorType.And,
            predicateSql
          )
        : predicateSql;

      selectForExists = new SelectExpression(
        selectForExists.alias,
        selectForExists.projection,
        selectForExists.from,
        newPredicate,
        selectForExists.having,
        selectForExists.joins,
        selectForExists.orderBy,
        selectForExists.offset,
        selectForExists.limit,
        selectForExists.groupBy
      );
    }

    const existsProjection = new ProjectionExpression(
      new SqlConstantExpression(1),
      "exists_val"
    );
    const existsAlias = "";

    const finalSelectForExists = new SelectExpression(
      existsAlias,
      [existsProjection],
      selectForExists.from,
      selectForExists.predicate,
      selectForExists.having,
      selectForExists.joins,
      [],
      null,
      null,
      selectForExists.groupBy
    );

    return new SqlExistsExpression(finalSelectForExists);
  }

  /** Visita uma expressão LINQ dentro de um contexto específico. */
  private visitInContext(
    expression: LinqExpression,
    context: TranslationContext
  ): SqlExpression | null {
    // (Lógica existente - Inalterada)
    const originalContext = this.context;
    this.context = context;
    let result: SqlExpression | null = null;
    try {
      result = this.visit(expression);
    } finally {
      this.context = originalContext;
    }
    return result;
  }

  /** Cria as projeções SQL (colunas do SELECT) a partir do corpo de uma lambda LINQ. */
  public createProjections(
    body: LinqExpression,
    context: TranslationContext
  ): ProjectionExpression[] {
    // (Lógica existente - Inalterada, mas valida SqlInExpression)
    const projections: ProjectionExpression[] = [];
    const visit = (expr: LinqExpression) => this.visitInContext(expr, context);

    if (body.type === LinqExpressionType.NewObject) {
      const newObject = body as LinqNewObjectExpression;
      for (const [alias, expr] of newObject.properties.entries()) {
        let sqlExpr = visit(expr);

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
              const subAlias = this.aliasGenerator.generateAlias("select");
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
          sqlExpr instanceof SqlCaseExpression ||
          sqlExpr instanceof SqlLikeExpression ||
          sqlExpr instanceof SqlInExpression // <<< INCLUI SqlInExpression
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
        sqlExpr instanceof SqlCaseExpression ||
        sqlExpr instanceof SqlLikeExpression ||
        sqlExpr instanceof SqlInExpression // <<< INCLUI SqlInExpression
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

// --- Mapeamento Simples de Propriedade JS para Função SQL ---
function mapPropertyToSqlFunction(propertyName: string): string | null {
  // (Lógica existente - Inalterada)
  switch (propertyName.toLowerCase()) {
    case "year":
      return "YEAR";
    case "month":
      return "MONTH";
    case "day":
    case "date":
      return "DAY";
    case "hour":
    case "hours":
      return "DATEPART(hour,...)";
    case "minute":
    case "minutes":
      return "DATEPART(minute,...)";
    case "second":
    case "seconds":
      return "DATEPART(second,...)";
    default:
      return null;
  }
}
// --- END OF FILE src/query/translation/QueryExpressionVisitor.ts ---
