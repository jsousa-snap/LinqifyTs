// --- START OF FILE src/query/generation/SqlServerQuerySqlGenerator.ts ---

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
   * @memberof SqlServerQuerySqlGenerator
   */
  protected Visit(expression: SqlExpression | null): void {
    if (!expression) {
      this.builder.append("NULL");
      return;
    }
    switch (expression.type) {
      case SqlExpressionType.Select:
        this.VisitSelect(expression as SelectExpression);
        break;
      case SqlExpressionType.Table:
        // A chamada para Table agora usa TableExpressionBase
        this.VisitTable(expression as TableExpression);
        break;
      case SqlExpressionType.Union:
        this.VisitUnion(expression as CompositeUnionExpression);
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
      case SqlExpressionType.Projection: // Projections são visitadas dentro de VisitSelect
        this.VisitProjection(expression as ProjectionExpression);
        break;
      case SqlExpressionType.InnerJoin: // Joins são visitados dentro de VisitSelect
        this.VisitJoin(expression as JoinExpressionBase);
        break;
      default:
        // Garante que todos os tipos sejam tratados em tempo de compilação
        const exCheck: never = expression.type;
        throw new Error(
          `Unsupported SqlExpressionType in generator dispatcher: ${exCheck}`
        );
    }
  }

  /**
   * Visita e gera SQL para uma expressão SELECT.
   * Responsável por montar as cláusulas SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, OFFSET, FETCH.
   *
   * @protected
   * @param {SelectExpression} expression A expressão SELECT a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitSelect(expression: SelectExpression): void {
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
    // A expressão 'from' agora pode ser Table, Union, etc. A chamada Visit fará o dispatch correto.
    this.Visit(expression.from); // <<< Chama o dispatcher Visit
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

    // <<< NOVO: Adiciona cláusula HAVING >>>
    if (expression.having) {
      this.builder.appendLine().indent().append("HAVING ");
      this.Visit(expression.having); // Visita a condição HAVING
      this.builder.dedent();
    }
    // <<< FIM NOVO >>>

    if (expression.orderBy && expression.orderBy.length > 0) {
      this.builder.appendLine().indent().append("ORDER BY ");
      expression.orderBy.forEach((o, i) => {
        this.Visit(o.expression);
        this.builder.appendSpace().append(o.direction);
        if (i < expression.orderBy.length - 1) {
          this.builder.append(", ");
        }
      });
      this.builder.dedent();
    } else if (expression.offset || expression.limit) {
      // Adiciona ORDER BY (SELECT NULL) apenas se não houver GROUP BY ou HAVING
      // (HAVING implica GROUP BY, então verificar groupBy é suficiente)
      if (expression.groupBy.length === 0) {
        console.warn(
          "Warning: SQL generation includes OFFSET or FETCH without a preceding ORDER BY clause. Results may be non-deterministic."
        );
        this.builder.appendLine().indent().append("ORDER BY (SELECT NULL)");
        this.builder.dedent();
      }
    }

    if (expression.offset || expression.limit) {
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
  }

  /**
   * Visita e gera SQL para um item na lista de projeção do SELECT (expressão + alias).
   *
   * @protected
   * @param {ProjectionExpression} projection A expressão de projeção a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitProjection(projection: ProjectionExpression): void {
    this.Visit(projection.expression); // Visita a expressão que calcula o valor

    // Lógica para decidir se o alias é necessário
    let needsAlias = true;
    if (projection.expression instanceof ColumnExpression) {
      // Se o alias for igual ao nome da coluna ou se for SELECT *, não precisa de alias explícito
      if (
        projection.alias === projection.expression.name ||
        projection.expression.name === "*"
      ) {
        needsAlias = false;
      }
    } else if (projection.expression.type === SqlExpressionType.Constant) {
      // Se for uma constante com alias padrão gerado, não precisa
      // (Exceto se for um alias de agregação padrão como count_result)
      if (
        projection.alias.startsWith("expr") &&
        !projection.alias.endsWith("_result") // Mantém alias de agregação
      ) {
        needsAlias = false;
      }
    }
    // Aliases especiais usados internamente não precisam ser adicionados explicitamente
    if (
      projection.alias === "*" ||
      projection.alias === "exists_val" ||
      projection.alias?.endsWith("_all")
    ) {
      needsAlias = false;
    }
    // Funções e subqueries geralmente precisam do alias definido
    if (
      projection.expression.type === SqlExpressionType.FunctionCall ||
      projection.expression.type === SqlExpressionType.ScalarSubqueryAsJson ||
      projection.expression.type === SqlExpressionType.ScalarSubquery
    ) {
      // Mantém o alias se ele foi definido (incluindo os _result de agregações)
      needsAlias = !!projection.alias;
    }

    // Adiciona o alias se necessário e se ele existir
    if (needsAlias && projection.alias) {
      this.builder.append(` AS ${escapeIdentifier(projection.alias)}`);
    }
  }

  /**
   * Visita e gera SQL para uma referência a uma tabela física no FROM.
   *
   * @protected
   * @param {TableExpression} table A expressão da tabela a ser visitada.
   * @param {boolean} [includeAs=true] Se deve incluir "AS [alias]" na saída.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitTable(
    table: TableExpression,
    includeAs: boolean = true
  ): void {
    // A expressão base já tem alias, não precisamos mais de TableExpressionBase aqui
    this.builder.append(escapeIdentifier(table.name));
    if (includeAs && table.alias) {
      this.builder.append(` AS ${escapeIdentifier(table.alias)}`);
    }
  }

  /**
   * Visita e gera SQL para uma referência a uma coluna (alias.coluna).
   *
   * @protected
   * @param {ColumnExpression} column A expressão da coluna a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitColumn(column: ColumnExpression): void {
    // Tenta encontrar a TableExpression correta na árvore para obter o alias
    // (Simplificação: assume que column.table tem o alias correto)
    if (!column.table.alias) {
      // Isso indica um erro interno se o alias não foi propagado corretamente
      throw new Error(
        `Internal Translation Error: Alias missing for table '${column.table.name}' when accessing column '${column.name}'.`
      );
    }
    this.builder.append(
      `${escapeIdentifier(column.table.alias)}.${escapeIdentifier(column.name)}`
    );
  }

  /**
   * Visita e gera SQL para um valor constante (literal).
   *
   * @protected
   * @param {SqlConstantExpression} constant A expressão constante a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitConstant(constant: SqlConstantExpression): void {
    this.builder.append(generateSqlLiteral(constant.value));
  }

  /**
   * Visita e gera SQL para uma operação binária (ex: WHERE coluna = valor, a + b).
   * Adiciona parênteses quando necessário para garantir a precedência correta.
   *
   * @protected
   * @param {SqlBinaryExpression} binary A expressão binária a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitBinary(binary: SqlBinaryExpression): void {
    // Lógica simples para adicionar parênteses: adiciona sempre que não for simples
    // Coluna/Constante/Função em ambos os lados, ou se um dos lados já for binário.
    const isSimpleLeft =
      binary.left.type === SqlExpressionType.Column ||
      binary.left.type === SqlExpressionType.Constant ||
      binary.left.type === SqlExpressionType.FunctionCall;
    const isSimpleRight =
      binary.right.type === SqlExpressionType.Column ||
      binary.right.type === SqlExpressionType.Constant ||
      binary.right.type === SqlExpressionType.FunctionCall;
    const isLeftBinary = binary.left.type === SqlExpressionType.Binary;
    const isRightBinary = binary.right.type === SqlExpressionType.Binary;

    // Adição/Concatenação pode ter precedência diferente, mas colocar parênteses
    // em casos complexos geralmente não prejudica.
    const needsParentheses =
      !(isSimpleLeft && isSimpleRight) || isLeftBinary || isRightBinary;

    if (needsParentheses) this.builder.append("(");
    this.Visit(binary.left); // Visita o lado esquerdo
    // <<< Usa o OperatorType do SqlBinaryExpression >>>
    this.builder.append(` ${mapOperatorToSql(binary.operator)} `);
    this.Visit(binary.right); // Visita o lado direito
    if (needsParentheses) this.builder.append(")");
  }

  /**
   * Visita e gera SQL para uma expressão JOIN. Chama o método específico
   * para o tipo de join (INNER, LEFT, etc.).
   *
   * @protected
   * @param {JoinExpressionBase} join A expressão JOIN a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitJoin(join: JoinExpressionBase): void {
    switch (join.type) {
      case SqlExpressionType.InnerJoin:
        this.VisitInnerJoin(join as InnerJoinExpression);
        break;
      // Adicionar outros tipos de join (LEFT, RIGHT) aqui se implementados
      default:
        throw new Error(`Unsupported join type: ${join.type}`);
    }
  }

  /**
   * Visita e gera SQL para uma expressão INNER JOIN.
   *
   * @protected
   * @param {InnerJoinExpression} join A expressão INNER JOIN a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitInnerJoin(join: InnerJoinExpression): void {
    this.builder.append("INNER JOIN");
    this.builder.appendSpace();
    // Visita a tabela que está sendo juntada
    // A tabela do join pode ser uma tabela base ou uma subconsulta/união
    this.Visit(join.table); // << Chama o dispatcher Visit
    this.builder.append(" ON ");
    // Visita a condição do join
    this.Visit(join.joinPredicate);
  }

  /**
   * Visita e gera SQL para uma subconsulta escalar formatada como JSON (FOR JSON).
   * Inclui lógica para adicionar ou remover o wrapper de array [].
   *
   * @protected
   * @param {SqlScalarSubqueryAsJsonExpression} expression A expressão da subconsulta JSON.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitScalarSubqueryAsJson(
    expression: SqlScalarSubqueryAsJsonExpression
  ): void {
    // Determina se o wrapper COALESCE/JSON_QUERY é necessário
    const needsCoalesceWrapper = !expression.withoutArrayWrapper;

    if (needsCoalesceWrapper) {
      this.builder.append("JSON_QUERY(COALESCE("); // Inicia o wrapper externo
    }

    // Gera a subconsulta interna FOR JSON
    this.builder.append("("); // Início da subconsulta interna
    this.builder.indent();
    this.builder.appendLine();
    this.VisitSelect(expression.selectExpression); // Visita o SELECT interno
    this.builder.appendLine().append(`FOR JSON ${expression.mode}`); // Adiciona FOR JSON
    const options: string[] = [];
    if (expression.includeNullValues) options.push("INCLUDE_NULL_VALUES");
    if (expression.withoutArrayWrapper) options.push("WITHOUT_ARRAY_WRAPPER");
    if (options.length > 0) this.builder.append(`, ${options.join(", ")}`);
    this.builder.dedent();
    this.builder.appendLine().append(")"); // Fim da subconsulta interna

    if (needsCoalesceWrapper) {
      this.builder.append(", '[]'))"); // Fecha COALESCE e JSON_QUERY
    }
  }

  /**
   * Visita e gera SQL para um predicado EXISTS(subquery).
   *
   * @protected
   * @param {SqlExistsExpression} expression A expressão EXISTS a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitExists(expression: SqlExistsExpression): void {
    this.builder.append("EXISTS").appendSpace().append("(");
    this.builder.indent().appendLine();
    // Visita a subconsulta SELECT dentro do EXISTS
    this.VisitSelect(expression.selectExpression);
    this.builder.dedent().appendLine().append(")");
  }

  /**
   * Visita e gera SQL para uma operação LIKE.
   *
   * @protected
   * @param {SqlLikeExpression} expression A expressão LIKE a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitLike(expression: SqlLikeExpression): void {
    this.builder.append("(");
    this.Visit(expression.sourceExpression); // Visita a coluna/expressão fonte
    this.builder.append(" LIKE ");
    this.Visit(expression.patternExpression); // Visita a constante com o padrão
    this.builder.append(")");
  }

  /**
   * Visita e gera SQL para uma chamada de função SQL (ex: COUNT(), MAX(), UPPER()).
   *
   * @protected
   * @param {SqlFunctionCallExpression} expression A expressão de chamada de função.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitFunctionCall(expression: SqlFunctionCallExpression): void {
    this.builder.append(expression.functionName); // Nome da função
    this.builder.append("(");
    // Visita cada argumento da função
    expression.args.forEach((arg, index) => {
      this.Visit(arg);
      if (index < expression.args.length - 1) {
        this.builder.append(", ");
      }
    });
    this.builder.append(")");
  }

  /**
   * Visita e gera SQL para uma subconsulta escalar que retorna um único valor.
   *
   * @protected
   * @param {SqlScalarSubqueryExpression} expression A expressão da subconsulta escalar.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitScalarSubquery(expression: SqlScalarSubqueryExpression): void {
    this.builder.append("(");
    this.builder.indent();
    this.builder.appendLine();
    // Visita a subconsulta SELECT interna
    this.VisitSelect(expression.selectExpression);
    this.builder.dedent();
    this.builder.appendLine().append(")");
  }

  /**
   * Visita e gera SQL para uma expressão de união (UNION / UNION ALL).
   * Geralmente usada como fonte na cláusula FROM.
   *
   * @protected
   * @param {CompositeUnionExpression} expression A expressão de união a ser visitada.
   * @memberof SqlServerQuerySqlGenerator
   */
  protected VisitUnion(expression: CompositeUnionExpression): void {
    this.builder.append("("); // Parêntese externo para a união
    this.builder.indent();

    const unionOperator = expression.distinct ? "UNION" : "UNION ALL";

    expression.sources.forEach((sourceSelect, index) => {
      this.builder.appendLine("("); // Parêntese para cada SELECT interno
      this.builder.indent();
      this.VisitSelect(sourceSelect); // Visita cada SELECT da união
      this.builder.dedent();
      this.builder.appendLine(")"); // Fecha parêntese do SELECT interno

      if (index < expression.sources.length - 1) {
        // Adiciona o operador UNION/UNION ALL entre os SELECTs
        this.builder.appendLine(unionOperator);
      }
    });

    this.builder.dedent();
    // Adiciona o alias da união, necessário quando usada no FROM
    this.builder.appendLine(`) AS ${escapeIdentifier(expression.alias)}`);
  }
}
// --- END OF FILE src/query/generation/SqlServerQuerySqlGenerator.ts ---
