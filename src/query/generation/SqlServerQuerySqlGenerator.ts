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
} from "../../sql-expressions";
import {
  escapeIdentifier,
  generateSqlLiteral,
  mapOperatorToSql,
  OperatorType, // Importa o OperatorType reexportado
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
 *
 * @export
 * @class SqlServerQuerySqlGenerator
 */
export class SqlServerQuerySqlGenerator {
  private builder: SqlBuilder;

  constructor() {
    this.builder = new SqlBuilder();
  }

  /**
   * Ponto de entrada principal para gerar a string SQL final.
   *
   * @param {SqlExpression} expression A raiz da árvore de expressão SQL.
   * @returns {string} A string SQL gerada.
   * @memberof SqlServerQuerySqlGenerator
   */
  public Generate(expression: SqlExpression): string {
    this.builder.clear();
    this.Visit(expression);
    return this.builder.toString();
  }

  /**
   * Método dispatcher principal que chama o método Visit específico
   * com base no tipo da SqlExpression.
   *
   * @protected
   * @param {(SqlExpression | null)} expression A expressão SQL a ser visitada.
   * @param {boolean} [isSubquerySource=false] Indica se a expressão está sendo visitada como fonte em FROM/JOIN.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected Visit(
    expression: SqlExpression | null,
    isSubquerySource: boolean = false
  ): void {
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
        this.VisitUnion(
          expression as CompositeUnionExpression,
          isSubquerySource
        );
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
        this.VisitFunctionCall(expression as SqlFunctionCallExpression); // <<< Chamada aqui
        break;
      case SqlExpressionType.ScalarSubquery:
        this.VisitScalarSubquery(expression as SqlScalarSubqueryExpression);
        break;
      case SqlExpressionType.ScalarSubqueryAsJson:
        this.VisitScalarSubqueryAsJson(
          expression as SqlScalarSubqueryAsJsonExpression
        );
        break;
      case SqlExpressionType.Like:
        this.VisitLike(expression as SqlLikeExpression);
        break;
      case SqlExpressionType.Exists:
        this.VisitExists(expression as SqlExistsExpression);
        break;
      case SqlExpressionType.Projection:
      case SqlExpressionType.InnerJoin:
        throw new Error(
          `Cannot directly visit SqlExpressionType: ${expression.type}`
        );
      default:
        const exCheck: never = expression.type;
        throw new Error(
          `Unsupported SqlExpressionType in generator dispatcher: ${exCheck}`
        );
    }
  }

  // VisitSelect, VisitTable, VisitColumn, VisitConstant, VisitBinary, VisitJoin, VisitInnerJoin, VisitScalarSubqueryAsJson, VisitExists, VisitLike, VisitScalarSubquery, VisitUnion, VisitProjection
  // (Métodos inalterados - exceto VisitFunctionCall abaixo)

  /**
   * Visita e gera SQL para uma expressão SELECT.
   * Se isSubquerySource for true, gera como (SELECT ...) AS alias.
   *
   * @protected
   * @param {SelectExpression} expression A expressão SELECT a ser visitada.
   * @param {boolean} isSubquerySource Indica se é fonte em FROM/JOIN.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitSelect(
    expression: SelectExpression,
    isSubquerySource: boolean
  ): void {
    const isSub = isSubquerySource;

    if (isSub) {
      this.builder.append("(");
      this.builder.indent();
      this.builder.appendLine();
    }

    this.builder.append("SELECT ");
    if (expression.projection.length === 0) {
      console.warn(
        "Warning: SELECT expression has no projections. Generating SELECT 1."
      );
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
    this.Visit(expression.from, true); // A fonte do FROM é sempre tratada como uma (sub)fonte
    this.builder.dedent();

    if (expression.joins.length > 0) {
      expression.joins.forEach((j) => {
        this.builder.appendLine();
        this.VisitJoin(j);
      });
    }

    if (expression.predicate) {
      this.builder.appendLine().indent().append("WHERE ");
      this.Visit(expression.predicate); // Chama Visit para o predicado
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
      this.Visit(expression.having); // Chama Visit para o having
      this.builder.dedent();
    }

    // Tratamento de ORDER BY e Paginação (OFFSET/FETCH)
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

  /**
   * Visita e gera SQL para um item na lista de projeção do SELECT (expressão + alias).
   * @protected
   * @param {ProjectionExpression} projection A expressão de projeção a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitProjection(projection: ProjectionExpression): void {
    this.Visit(projection.expression); // Visita a expressão a ser projetada

    // Lógica para adicionar 'AS alias' (simplificada, pode precisar de ajustes)
    let needsAlias = true;
    if (projection.expression instanceof ColumnExpression) {
      if (
        projection.alias === projection.expression.name ||
        projection.expression.name === "*"
      ) {
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
      projection.expression.type === SqlExpressionType.ScalarSubquery
    ) {
      needsAlias = !!projection.alias;
    }

    if (needsAlias && projection.alias) {
      this.builder.append(` AS ${escapeIdentifier(projection.alias)}`);
    }
  }

  /**
   * Visita e gera SQL para uma referência a uma tabela física.
   * @protected
   * @param {TableExpression} table A expressão da tabela a ser visitada.
   * @param {boolean} isSubquerySource Indica se é fonte em FROM/JOIN.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitTable(
    table: TableExpression,
    isSubquerySource: boolean
  ): void {
    this.builder.append(escapeIdentifier(table.name));
    if (!table.alias) {
      throw new Error(
        `Internal Error: Table '${table.name}' must have an alias.`
      );
    }
    this.builder.append(` AS ${escapeIdentifier(table.alias)}`);
  }

  /**
   * Visita e gera SQL para uma referência a uma coluna.
   * @protected
   * @param {ColumnExpression} column A expressão da coluna a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitColumn(column: ColumnExpression): void {
    if (!column.table.alias) {
      throw new Error(
        `Internal Translation Error: Alias missing for table '${column.table.name}' when accessing column '${column.name}'.`
      );
    }
    this.builder.append(
      `${escapeIdentifier(column.table.alias)}.${escapeIdentifier(column.name)}`
    );
  }

  /**
   * Visita e gera SQL para uma constante.
   * @protected
   * @param {SqlConstantExpression} constant A expressão constante a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitConstant(constant: SqlConstantExpression): void {
    this.builder.append(generateSqlLiteral(constant.value));
  }

  /**
   * Visita e gera SQL para uma expressão binária.
   * Adiciona parênteses aos operandos INTERNOS APENAS se necessário por precedência.
   * NÃO adiciona parênteses externos à expressão binária completa.
   * Trata comparações com NULL usando IS NULL / IS NOT NULL.
   * @protected
   * @param {SqlBinaryExpression} binary A expressão binária a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitBinary(binary: SqlBinaryExpression): void {
    let isNullComparison = false;
    let sqlOperator: string | null = null;
    let operandForNullCheck: SqlExpression | null = null;

    if (
      binary.right.type === SqlExpressionType.Constant &&
      (binary.right as SqlConstantExpression).value === null
    ) {
      isNullComparison = true;
      operandForNullCheck = binary.left;
      if (binary.operator === OperatorType.Equal) sqlOperator = "IS NULL";
      else if (binary.operator === OperatorType.NotEqual)
        sqlOperator = "IS NOT NULL";
    } else if (
      binary.left.type === SqlExpressionType.Constant &&
      (binary.left as SqlConstantExpression).value === null
    ) {
      isNullComparison = true;
      operandForNullCheck = binary.right;
      if (binary.operator === OperatorType.Equal) sqlOperator = "IS NULL";
      else if (binary.operator === OperatorType.NotEqual)
        sqlOperator = "IS NOT NULL";
    }

    if (isNullComparison && sqlOperator && operandForNullCheck) {
      this.Visit(operandForNullCheck);
      this.builder.appendSpace().append(sqlOperator);
    } else {
      const currentPrecedence = getOperatorPrecedence(binary.operator);
      const wrapLeft =
        binary.left.type === SqlExpressionType.Binary &&
        getOperatorPrecedence((binary.left as SqlBinaryExpression).operator) <
          currentPrecedence;
      const wrapRight =
        binary.right.type === SqlExpressionType.Binary &&
        getOperatorPrecedence((binary.right as SqlBinaryExpression).operator) <
          currentPrecedence;

      if (wrapLeft) this.builder.append("(");
      this.Visit(binary.left);
      if (wrapLeft) this.builder.append(")");

      this.builder.append(` ${mapOperatorToSql(binary.operator)} `);

      if (wrapRight) this.builder.append("(");
      this.Visit(binary.right);
      if (wrapRight) this.builder.append(")");
    }
  }

  /**
   * Visita uma expressão JOIN base (dispatcher).
   * @protected
   * @param {JoinExpressionBase} join A expressão JOIN a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitJoin(join: JoinExpressionBase): void {
    switch (join.type) {
      case SqlExpressionType.InnerJoin:
        this.VisitInnerJoin(join as InnerJoinExpression);
        break;
      default:
        throw new Error(`Unsupported join type: ${join.type}`);
    }
  }

  /**
   * Visita e gera SQL para uma expressão INNER JOIN.
   * @protected
   * @param {InnerJoinExpression} join A expressão INNER JOIN a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitInnerJoin(join: InnerJoinExpression): void {
    this.builder.append("INNER JOIN");
    this.builder.appendSpace();
    this.Visit(join.table, true); // Visita a fonte do join como subquery source
    this.builder.append(" ON ");
    this.Visit(join.joinPredicate); // Visita a condição do join
  }

  /**
   * Visita e gera SQL para uma subconsulta escalar formatada como JSON.
   * @protected
   * @param {SqlScalarSubqueryAsJsonExpression} expression A expressão a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitScalarSubqueryAsJson(
    expression: SqlScalarSubqueryAsJsonExpression
  ): void {
    const needsCoalesceWrapper = !expression.withoutArrayWrapper;

    if (needsCoalesceWrapper) {
      this.builder.append("JSON_QUERY(COALESCE(");
    }

    this.builder.append("(");
    this.builder.indent();
    this.builder.appendLine();
    this.VisitSelect(expression.selectExpression, false); // Visita o SELECT interno
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

  /**
   * Visita e gera SQL para um predicado EXISTS.
   * @protected
   * @param {SqlExistsExpression} expression A expressão EXISTS a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitExists(expression: SqlExistsExpression): void {
    this.builder.append("EXISTS").appendSpace().append("(");
    this.builder.indent().appendLine();
    this.VisitSelect(expression.selectExpression, false);
    this.builder.dedent().appendLine().append(")");
  }

  /**
   * Visita e gera SQL para uma operação LIKE.
   * Não adiciona parênteses externos por padrão.
   * @protected
   * @param {SqlLikeExpression} expression A expressão LIKE a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitLike(expression: SqlLikeExpression): void {
    this.Visit(expression.sourceExpression);
    this.builder.append(" LIKE ");
    this.Visit(expression.patternExpression);
  }

  /**
   * Visita e gera SQL para uma chamada de função.
   * **CORRIGIDO:** Trata DATEPART especialmente.
   * @protected
   * @param {SqlFunctionCallExpression} expression A expressão de chamada de função.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitFunctionCall(expression: SqlFunctionCallExpression): void {
    const functionNameUpper = expression.functionName.toUpperCase();

    // Tratamento especial para DATEPART
    if (functionNameUpper === "DATEPART" && expression.args.length === 2) {
      const datePartArg = expression.args[0];
      const dateSourceArg = expression.args[1];

      // O primeiro argumento (datepart) deve ser uma constante string
      if (
        datePartArg instanceof SqlConstantExpression &&
        typeof datePartArg.value === "string"
      ) {
        this.builder.append(expression.functionName); // DATEPART
        this.builder.append("(");
        this.builder.append(datePartArg.value); // Adiciona o identificador SEM aspas
        this.builder.append(", ");
        this.Visit(dateSourceArg); // Visita a expressão da data
        this.builder.append(")");
        return; // Sai da função após tratar DATEPART
      } else {
        // Lança erro se o primeiro argumento não for o esperado
        console.error("Invalid DATEPART argument:", datePartArg);
        throw new Error(
          "DATEPART SQL function expects the date part identifier (e.g., 'hour', 'minute') as the first argument."
        );
      }
    }

    // Lógica padrão para outras funções
    this.builder.append(expression.functionName);
    this.builder.append("(");
    expression.args.forEach((arg, index) => {
      this.Visit(arg); // Visita cada argumento normalmente
      if (index < expression.args.length - 1) {
        this.builder.append(", ");
      }
    });
    this.builder.append(")");
  }

  /**
   * Visita e gera SQL para uma subconsulta escalar.
   * @protected
   * @param {SqlScalarSubqueryExpression} expression A expressão de subconsulta escalar.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitScalarSubquery(expression: SqlScalarSubqueryExpression): void {
    this.builder.append("(");
    this.builder.indent();
    this.builder.appendLine();
    this.VisitSelect(expression.selectExpression, false);
    this.builder.dedent();
    this.builder.appendLine().append(")");
  }

  /**
   * Visita e gera SQL para uma operação UNION ou UNION ALL.
   * @protected
   * @param {CompositeUnionExpression} expression A expressão de união a ser visitada.
   * @param {boolean} isSubquerySource Indica se é fonte em FROM/JOIN.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitUnion(
    expression: CompositeUnionExpression,
    isSubquerySource: boolean
  ): void {
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
      this.VisitSelect(sourceSelect, false); // Visita cada SELECT interno
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
}
// --- END OF FILE src/query/generation/SqlServerQuerySqlGenerator.ts ---
