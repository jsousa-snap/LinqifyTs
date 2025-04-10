// --- START OF FILE src/query/generation/SqlServerQuerySqlGenerator.ts ---

// src/query/generation/SqlServerQuerySqlGenerator.ts

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
  SqlScalarSubqueryAsJsonExpression,
  JsonMode,
  SqlExistsExpression,
  SqlLikeExpression,
  SqlFunctionCallExpression,
  SqlScalarSubqueryExpression,
  CompositeUnionExpression,
  TableExpressionBase,
  SqlCaseExpression,
  SqlInExpression, // <<< IMPORTAR SqlInExpression
} from "../../sql-expressions";
import {
  escapeIdentifier,
  generateSqlLiteral,
  mapOperatorToSql,
  OperatorType,
  getOperatorPrecedence,
} from "./utils/sqlUtils";

// Classe SqlBuilder (Inalterada)
class SqlBuilder {
  private parts: string[] = [];
  private indentationLevel = 0;
  private readonly indentSize = 4;
  public getIndent(): string {
    return " ".repeat(this.indentationLevel * this.indentSize);
  }
  public append(text: string): this {
    this.parts.push(text);
    return this;
  }
  public appendSpace(): this {
    this.parts.push(" ");
    return this;
  }
  public appendLine(text: string = ""): this {
    if (this.parts.length > 0) {
      this.parts.push("\n");
    }
    this.parts.push(this.getIndent() + text);
    return this;
  }
  public indent(): this {
    this.indentationLevel++;
    return this;
  }
  public dedent(): this {
    if (this.indentationLevel > 0) this.indentationLevel--;
    return this;
  }
  public clear(): void {
    this.parts = [];
    this.indentationLevel = 0;
  }
  public toString(): string {
    let result = this.parts.join("");
    if (result.startsWith("\n")) result = result.substring(1);
    return result.trim();
  }
  public isEmpty(): boolean {
    return this.parts.length === 0;
  }
  public trimTrailingComma(): this {
    if (this.parts.length > 0) {
      const lastPartIndex = this.parts.length - 1;
      this.parts[lastPartIndex] = this.parts[lastPartIndex].trimEnd();
      if (this.parts[lastPartIndex].endsWith(",")) {
        this.parts[lastPartIndex] = this.parts[lastPartIndex].slice(0, -1);
      }
      if (this.parts[lastPartIndex].trim() === "") {
        this.parts.pop();
      }
    }
    return this;
  }
  public trimTrailingSpace(): this {
    if (this.parts.length > 0) {
      const lastPartIndex = this.parts.length - 1;
      this.parts[lastPartIndex] = this.parts[lastPartIndex].trimEnd();
      if (this.parts[lastPartIndex] === "") {
        this.parts.pop();
      }
    }
    return this;
  }
}
// --- Fim do SqlBuilder ---

/**
 * Gera SQL para consultas compatível com SQL Server a partir de uma árvore de SqlExpression.
 */
export class SqlServerQuerySqlGenerator {
  private builder: SqlBuilder;

  constructor() {
    this.builder = new SqlBuilder();
  }

  /**
   * Ponto de entrada principal para gerar a string SQL final.
   */
  public Generate(expression: SqlExpression): string {
    this.builder.clear();
    this.Visit(expression);
    return this.builder.toString();
  }

  /**
   * Método dispatcher principal que chama o método Visit específico.
   */
  protected Visit(expression: SqlExpression | null, isSubquerySource: boolean = false): void {
    if (!expression) {
      this.builder.append("NULL");
      return;
    }

    switch (expression.type) {
      case SqlExpressionType.Select:
        this.VisitSelect(expression as SelectExpression, isSubquerySource);
        break;
      case SqlExpressionType.Table:
        this.VisitTable(expression as TableExpression, isSubquerySource);
        break;
      case SqlExpressionType.Union:
        this.VisitUnion(expression as CompositeUnionExpression, isSubquerySource);
        break;
      case SqlExpressionType.Column:
        this.VisitColumn(expression as ColumnExpression);
        break;
      case SqlExpressionType.Constant:
        this.VisitConstant(expression as SqlConstantExpression);
        break;
      case SqlExpressionType.Binary:
        this.VisitBinary(expression as SqlBinaryExpression);
        break;
      case SqlExpressionType.FunctionCall:
        this.VisitFunctionCall(expression as SqlFunctionCallExpression);
        break;
      case SqlExpressionType.Case:
        this.VisitCase(expression as SqlCaseExpression);
        break;
      // **** NOVO CASO: In ****
      case SqlExpressionType.In:
        this.VisitIn(expression as SqlInExpression);
        break;
      case SqlExpressionType.ScalarSubquery:
        this.VisitScalarSubquery(expression as SqlScalarSubqueryExpression);
        break;
      case SqlExpressionType.ScalarSubqueryAsJson:
        this.VisitScalarSubqueryAsJson(expression as SqlScalarSubqueryAsJsonExpression);
        break;
      case SqlExpressionType.Like:
        this.VisitLike(expression as SqlLikeExpression);
        break;
      case SqlExpressionType.Exists:
        this.VisitExists(expression as SqlExistsExpression);
        break;
      case SqlExpressionType.Projection:
      case SqlExpressionType.InnerJoin:
      case SqlExpressionType.LeftJoin:
        throw new Error(`Cannot directly visit SqlExpressionType: ${expression.type}`);
      default:
        const exCheck: never = expression.type;
        throw new Error(`Unsupported SqlExpressionType in generator dispatcher: ${exCheck}`);
    }
  }

  // VisitSelect, VisitProjection, VisitTable, VisitColumn, VisitConstant, VisitBinary, VisitFunctionCall, VisitCase, VisitScalarSubquery, VisitScalarSubqueryAsJson, VisitLike, VisitExists, VisitJoin, VisitInnerJoin, VisitLeftJoin, VisitUnion
  // (Lógica existente inalterada)
  // ... (cole aqui os métodos Visit* existentes e inalterados) ...
  protected VisitSelect(expression: SelectExpression, isSubquerySource: boolean): void {
    const isSub = isSubquerySource;

    if (isSub) {
      this.builder.append("(");
      this.builder.indent();
      this.builder.appendLine();
    }

    this.builder.append("SELECT ");
    if (expression.projection.length === 0) {
      console.warn("Warning: SELECT expression has no projections. Generating SELECT 1.");
      this.builder.append("1");
    } else {
      expression.projection.forEach((p, i) => {
        this.VisitProjection(p);
        if (i < expression.projection.length - 1) {
          this.builder.append(", ");
        }
      });
    }

    this.builder.appendLine().indent().append("FROM ");
    this.Visit(expression.from, true);
    this.builder.dedent();

    if (expression.joins.length > 0) {
      expression.joins.forEach((j) => {
        this.builder.appendLine();
        this.VisitJoin(j);
      });
    }

    if (expression.predicate) {
      this.builder.appendLine().indent().append("WHERE ");
      this.Visit(expression.predicate);
      this.builder.dedent();
    }

    if (expression.groupBy.length > 0) {
      this.builder.appendLine().indent().append("GROUP BY ");
      expression.groupBy.forEach((g, i) => {
        this.Visit(g);
        if (i < expression.groupBy.length - 1) {
          this.builder.append(", ");
        }
      });
      this.builder.dedent();
    }

    if (expression.having) {
      this.builder.appendLine().indent().append("HAVING ");
      this.Visit(expression.having);
      this.builder.dedent();
    }

    const hasPaging = !!(expression.offset || expression.limit);
    if (expression.orderBy.length > 0 || hasPaging) {
      if (expression.orderBy.length > 0) {
        this.builder.appendLine().indent().append("ORDER BY ");
        expression.orderBy.forEach((o, i) => {
          this.Visit(o.expression);
          this.builder.appendSpace().append(o.direction);
          if (i < expression.orderBy.length - 1) {
            this.builder.append(", ");
          }
        });
        this.builder.dedent();
      } else if (hasPaging) {
        console.warn(
          "Warning: SQL generation includes OFFSET or FETCH without ORDER BY. Adding 'ORDER BY (SELECT NULL)' for compatibility."
        );
        this.builder.appendLine().indent().append("ORDER BY (SELECT NULL)");
        this.builder.dedent();
      }
    }

    if (hasPaging) {
      const offsetValue = expression.offset ?? new SqlConstantExpression(0);
      this.builder.appendLine().indent().append("OFFSET ");
      this.Visit(offsetValue);
      this.builder.append(" ROWS");
      if (expression.limit) {
        this.builder.append(" FETCH NEXT ");
        this.Visit(expression.limit);
        this.builder.append(" ROWS ONLY");
      }
      this.builder.dedent();
    }

    if (isSub) {
      this.builder.dedent();
      this.builder.appendLine(`) AS ${escapeIdentifier(expression.alias)}`);
    }
  }
  protected VisitProjection(projection: ProjectionExpression): void {
    this.Visit(projection.expression);

    let needsAlias = true;
    if (projection.expression instanceof ColumnExpression) {
      if (projection.alias === projection.expression.name || projection.expression.name === "*") {
        needsAlias = false;
      }
    } else if (projection.expression.type === SqlExpressionType.Constant) {
      needsAlias = !!projection.alias && !projection.alias.startsWith("expr");
    }

    if (
      projection.alias === "*" ||
      projection.alias === "exists_val" ||
      projection.alias?.endsWith("_all") ||
      projection.alias?.endsWith("_result")
    ) {
      needsAlias = false;
    }

    if (
      projection.expression.type === SqlExpressionType.FunctionCall ||
      projection.expression.type === SqlExpressionType.ScalarSubqueryAsJson ||
      projection.expression.type === SqlExpressionType.ScalarSubquery ||
      projection.expression.type === SqlExpressionType.Case ||
      projection.expression.type === SqlExpressionType.In // <<< IN também pode precisar de alias
    ) {
      needsAlias = !!projection.alias;
    }

    if (needsAlias && projection.alias) {
      this.builder.append(` AS ${escapeIdentifier(projection.alias)}`);
    }
  }
  protected VisitTable(table: TableExpression, isSubquerySource: boolean): void {
    this.builder.append(escapeIdentifier(table.name));
    if (!table.alias) {
      throw new Error(`Internal Error: Table '${table.name}' must have an alias.`);
    }
    this.builder.append(` AS ${escapeIdentifier(table.alias)}`);
  }
  protected VisitColumn(column: ColumnExpression): void {
    if (!column.table.alias) {
      throw new Error(
        `Internal Translation Error: Alias missing for table '${column.table.name}' when accessing column '${column.name}'.`
      );
    }
    this.builder.append(`${escapeIdentifier(column.table.alias)}.${escapeIdentifier(column.name)}`);
  }
  protected VisitConstant(constant: SqlConstantExpression): void {
    this.builder.append(generateSqlLiteral(constant.value));
  }
  protected VisitBinary(binary: SqlBinaryExpression): void {
    let isNullComparison = false;
    let sqlOperator: string | null = null;
    let operandForNullCheck: SqlExpression | null = null;

    const leftIsNull =
      binary.left.type === SqlExpressionType.Constant && (binary.left as SqlConstantExpression).value === null;
    const rightIsNull =
      binary.right.type === SqlExpressionType.Constant && (binary.right as SqlConstantExpression).value === null;

    if (leftIsNull && !rightIsNull) {
      isNullComparison = true;
      operandForNullCheck = binary.right;
      if (binary.operator === OperatorType.Equal) sqlOperator = "IS NULL";
      else if (binary.operator === OperatorType.NotEqual) sqlOperator = "IS NOT NULL";
    } else if (rightIsNull && !leftIsNull) {
      isNullComparison = true;
      operandForNullCheck = binary.left;
      if (binary.operator === OperatorType.Equal) sqlOperator = "IS NULL";
      else if (binary.operator === OperatorType.NotEqual) sqlOperator = "IS NOT NULL";
    }

    if (isNullComparison && sqlOperator && operandForNullCheck) {
      const wrapOperand =
        operandForNullCheck.type === SqlExpressionType.Binary ||
        operandForNullCheck.type === SqlExpressionType.In || // <<< IN também precisa de parênteses
        operandForNullCheck.type === SqlExpressionType.Case;
      if (wrapOperand) this.builder.append("(");
      this.Visit(operandForNullCheck);
      if (wrapOperand) this.builder.append(")");
      this.builder.appendSpace().append(sqlOperator);
    } else {
      const currentPrecedence = getOperatorPrecedence(binary.operator);

      const wrapLeft =
        (binary.left.type === SqlExpressionType.Binary ||
          binary.left.type === SqlExpressionType.In || // <<< IN pode precisar de parênteses
          binary.left.type === SqlExpressionType.Case) &&
        getOperatorPrecedence(
          binary.left.type === SqlExpressionType.Binary
            ? (binary.left as SqlBinaryExpression).operator
            : OperatorType.Equal // Assume baixa precedência para IN e CASE
        ) < currentPrecedence;

      const wrapRight =
        (binary.right.type === SqlExpressionType.Binary ||
          binary.right.type === SqlExpressionType.In || // <<< IN pode precisar de parênteses
          binary.right.type === SqlExpressionType.Case) &&
        getOperatorPrecedence(
          binary.right.type === SqlExpressionType.Binary
            ? (binary.right as SqlBinaryExpression).operator
            : OperatorType.Equal // Assume baixa precedência para IN e CASE
        ) < currentPrecedence;

      if (wrapLeft) this.builder.append("(");
      this.Visit(binary.left);
      if (wrapLeft) this.builder.append(")");

      this.builder.append(` ${mapOperatorToSql(binary.operator)} `);

      if (wrapRight) this.builder.append("(");
      this.Visit(binary.right);
      if (wrapRight) this.builder.append(")");
    }
  }
  protected VisitJoin(join: JoinExpressionBase): void {
    switch (join.type) {
      case SqlExpressionType.InnerJoin:
        this.VisitInnerJoin(join as InnerJoinExpression);
        break;
      case SqlExpressionType.LeftJoin:
        this.VisitLeftJoin(join as LeftJoinExpression);
        break;
      default:
        const exhaustiveCheck: never = join.type;
        throw new Error(`Unsupported join type: ${exhaustiveCheck}`);
    }
  }
  protected VisitInnerJoin(join: InnerJoinExpression): void {
    this.builder.append("INNER JOIN");
    this.builder.appendSpace();
    this.Visit(join.table, true);
    this.builder.append(" ON ");
    this.Visit(join.joinPredicate);
  }
  protected VisitLeftJoin(join: LeftJoinExpression): void {
    this.builder.append("LEFT JOIN");
    this.builder.appendSpace();
    this.Visit(join.table, true);
    this.builder.append(" ON ");
    this.Visit(join.joinPredicate);
  }
  protected VisitScalarSubqueryAsJson(expression: SqlScalarSubqueryAsJsonExpression): void {
    const needsCoalesceWrapper = !expression.withoutArrayWrapper;

    if (needsCoalesceWrapper) {
      this.builder.append("JSON_QUERY(COALESCE(");
    }

    this.builder.append("(");
    this.builder.indent();
    this.builder.appendLine();
    this.VisitSelect(expression.selectExpression, false);
    this.builder.appendLine().append(`FOR JSON ${expression.mode}`);
    const options: string[] = [];
    if (expression.includeNullValues) options.push("INCLUDE_NULL_VALUES");
    if (expression.withoutArrayWrapper) options.push("WITHOUT_ARRAY_WRAPPER");
    if (options.length > 0) this.builder.append(`, ${options.join(", ")}`);
    this.builder.dedent();
    this.builder.appendLine().append(")");

    if (needsCoalesceWrapper) {
      this.builder.append(", '[]'))");
    }
  }
  protected VisitExists(expression: SqlExistsExpression): void {
    this.builder.append("EXISTS").appendSpace().append("(");
    this.builder.indent().appendLine();
    this.VisitSelect(expression.selectExpression, false);
    this.builder.dedent().appendLine().append(")");
  }
  protected VisitLike(expression: SqlLikeExpression): void {
    const wrapSource = expression.sourceExpression.type === SqlExpressionType.Binary;
    if (wrapSource) this.builder.append("(");
    this.Visit(expression.sourceExpression);
    if (wrapSource) this.builder.append(")");

    this.builder.append(" LIKE ");
    this.Visit(expression.patternExpression);
  }
  protected VisitFunctionCall(expression: SqlFunctionCallExpression): void {
    const functionNameUpper = expression.functionName.toUpperCase();

    if (functionNameUpper === "DATEPART" && expression.args.length === 2) {
      const datePartArg = expression.args[0];
      const dateSourceArg = expression.args[1];
      if (datePartArg instanceof SqlConstantExpression && typeof datePartArg.value === "string") {
        this.builder.append(expression.functionName);
        this.builder.append("(");
        this.builder.append(datePartArg.value);
        this.builder.append(", ");
        this.Visit(dateSourceArg);
        this.builder.append(")");
        return;
      } else {
        console.error("Invalid DATEPART argument:", datePartArg);
        throw new Error(
          "DATEPART SQL function expects the date part identifier (e.g., 'hour', 'minute') as the first argument."
        );
      }
    }

    this.builder.append(expression.functionName);
    this.builder.append("(");
    expression.args.forEach((arg, index) => {
      this.Visit(arg);
      if (index < expression.args.length - 1) {
        this.builder.append(", ");
      }
    });
    this.builder.append(")");
  }
  protected VisitCase(expression: SqlCaseExpression): void {
    this.builder.append("CASE");
    expression.whenClauses.forEach((wc) => {
      this.builder.append(" WHEN ");
      this.Visit(wc.when);
      this.builder.append(" THEN ");
      this.Visit(wc.then);
    });
    if (expression.elseExpression) {
      this.builder.append(" ELSE ");
      this.Visit(expression.elseExpression);
    }
    this.builder.append(" END");
  }
  protected VisitScalarSubquery(expression: SqlScalarSubqueryExpression): void {
    this.builder.append("(");
    this.builder.indent();
    this.builder.appendLine();
    this.VisitSelect(expression.selectExpression, false);
    this.builder.dedent();
    this.builder.appendLine().append(")");
  }
  protected VisitUnion(expression: CompositeUnionExpression, isSubquerySource: boolean): void {
    const isSub = isSubquerySource;

    if (isSub) {
      this.builder.append("(");
      this.builder.indent();
    }

    const unionOperator = expression.distinct ? "UNION" : "UNION ALL";

    expression.sources.forEach((sourceSelect, index) => {
      this.builder.appendLine("(");
      this.builder.indent();
      this.builder.appendLine();
      this.VisitSelect(sourceSelect, false);
      this.builder.dedent();
      this.builder.appendLine(")");

      if (index < expression.sources.length - 1) {
        this.builder.appendLine(unionOperator);
      }
    });

    if (isSub) {
      this.builder.dedent();
      this.builder.appendLine(`) AS ${escapeIdentifier(expression.alias)}`);
    }
  }

  // **** NOVO MÉTODO: VisitIn ****
  /**
   * Visita e gera SQL para uma expressão IN.
   * @param expression A expressão IN a ser visitada.
   */
  protected VisitIn(expression: SqlInExpression): void {
    // Adiciona parênteses se a expressão base for binária
    const wrapBase = expression.expression.type === SqlExpressionType.Binary;
    if (wrapBase) this.builder.append("(");
    this.Visit(expression.expression); // Visita a coluna/expressão a ser verificada
    if (wrapBase) this.builder.append(")");

    this.builder.append(" IN (");

    // Itera sobre os valores constantes
    expression.values.forEach((valueExpr, index) => {
      this.VisitConstant(valueExpr); // Visita cada constante (gera o literal SQL)
      if (index < expression.values.length - 1) {
        this.builder.append(", ");
      }
    });

    this.builder.append(")");
  }
  // **** FIM NOVO MÉTODO ****
}
// --- END OF FILE src/query/generation/SqlServerQuerySqlGenerator.ts ---
