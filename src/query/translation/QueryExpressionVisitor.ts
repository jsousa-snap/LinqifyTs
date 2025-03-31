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
  OperatorType as LinqOperatorType, // Usar este consistentemente
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
import { getTableName } from "../generation/utils/sqlUtils"; // Não importar OperatorType daqui

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
} from "./method-visitors";

// Lista de nomes de funções de agregação SQL comuns
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
 * Percorre a árvore LINQ e constrói a representação SQL correspondente.
 *
 * @export
 * @class QueryExpressionVisitor
 */
export class QueryExpressionVisitor {
  private context: TranslationContext;

  constructor() {
    this.context = new TranslationContext();
  }

  /**
   * Ponto de entrada principal para a tradução.
   * Visita a expressão LINQ raiz e retorna a expressão SQL correspondente.
   * Garante que o resultado final seja um tipo SQL executável (Select, Exists).
   * Envolve fontes raiz `TableExpression` ou `CompositeUnionExpression` em `SELECT *`.
   *
   * @param {LinqExpression} expression A expressão LINQ raiz.
   * @returns {SqlExpression} A expressão SQL traduzida (geralmente SelectExpression ou SqlExistsExpression).
   * @throws {Error} Se a tradução falhar ou resultar em um tipo inesperado.
   * @memberof QueryExpressionVisitor
   */
  public translate(expression: LinqExpression): SqlExpression {
    const result = this.visit(expression);
    if (!result) throw new Error("Translation resulted in a null expression.");

    let finalResult = result;

    // Garante que fontes Table ou Union sejam encapsuladas em SELECT * no nível raiz
    if (
      result instanceof TableExpression ||
      result instanceof CompositeUnionExpression
    ) {
      finalResult = this.createDefaultSelect(result);
    }

    // Verifica se o resultado final é um tipo executável esperado
    if (
      finalResult instanceof SelectExpression ||
      finalResult instanceof SqlExistsExpression
      // Union já foi encapsulada acima, então não precisa verificar aqui
    ) {
      // Tratamento especial para agregações globais (fora de GroupBy)
      if (
        finalResult instanceof SelectExpression &&
        finalResult.projection.length === 1
      ) {
        const projExpr = finalResult.projection[0].expression;
        if (
          projExpr instanceof SqlFunctionCallExpression &&
          AGGREGATE_FUNCTION_NAMES.has(projExpr.functionName.toUpperCase()) &&
          finalResult.groupBy.length === 0 // Confirma que não é resultado de groupBy
        ) {
          return finalResult; // É uma agregação global (COUNT, SUM, etc.)
        }
      }
      return finalResult; // Retorna Select ou Exists
    }

    // Se chegou aqui, o tipo resultante não é esperado no nível raiz
    console.error("Unexpected final translation result type:", finalResult);
    throw new Error(
      `Unexpected translation result type at root: ${finalResult.constructor.name}. Expected SelectExpression or SqlExistsExpression.`
    );
  }

  /**
   * Cria uma SelectExpression padrão (SELECT [alias].*) para uma fonte TableExpressionBase (Table ou Union).
   * @param source A TableExpression ou CompositeUnionExpression fonte.
   * @returns A SelectExpression correspondente.
   */
  private createDefaultSelect(source: TableExpressionBase): SelectExpression {
    // Cria uma TableExpression temporária APENAS para referenciar o alias na ColumnExpression.
    // O nome aqui é irrelevante, pois o gerador SQL usará source.alias.
    const tableRefForColumn = new TableExpression(
      source.type === SqlExpressionType.Table
        ? (source as TableExpression).name
        : "(<derived>)",
      source.alias
    );
    // A projeção é 'alias.*'
    const placeholderProjection = new ProjectionExpression(
      new ColumnExpression("*", tableRefForColumn), // Coluna '*' referenciando o alias correto
      "*" // Alias da projeção é '*'
    );
    // A cláusula FROM da nova SelectExpression usa a fonte original (Table ou Union)
    return new SelectExpression([placeholderProjection], source);
  }

  /**
   * Método dispatcher principal para visitar nós da árvore LINQ.
   * Chama o método 'visit' específico com base no tipo do nó.
   *
   * @protected
   * @param {(LinqExpression | null)} expression O nó da expressão LINQ a ser visitado.
   * @returns {(SqlExpression | null)} A expressão SQL resultante ou null.
   * @memberof QueryExpressionVisitor
   */
  protected visit(expression: LinqExpression | null): SqlExpression | null {
    if (!expression) return null;

    // Tratamento antecipado de métodos que retornam tipos SQL específicos
    // ou não seguem o padrão SelectExpression (como exists, includes)
    if (expression.type === LinqExpressionType.Call) {
      const callExpr = expression as LinqMethodCallExpression;
      switch (callExpr.methodName) {
        case "exists":
          // 'exists' retorna SqlExistsExpression, não SelectExpression
          return this.translateExistsExpression(callExpr);
        case "includes":
          // 'includes' é traduzido para SqlLikeExpression dentro de um predicado
          return visitIncludesCall(
            callExpr,
            this.context,
            this.visit.bind(this)
          );
        // union e concat serão tratados no visitMethodCall principal
      }
    }

    // Visita principal baseada no tipo de expressão LINQ
    switch (expression.type) {
      case LinqExpressionType.Constant:
        return this.visitConstant(expression as LinqConstantExpression);
      case LinqExpressionType.Parameter:
        return this.visitParameter(expression as LinqParameterExpression);
      case LinqExpressionType.MemberAccess:
        return this.visitMember(expression as LinqMemberExpression);
      case LinqExpressionType.Call:
        // A maioria das chamadas de método LINQ retornam SelectExpression ou Union
        return this.visitMethodCall(expression as LinqMethodCallExpression);
      case LinqExpressionType.Binary:
        return this.visitBinary(expression as LinqBinaryExpression);
      case LinqExpressionType.Literal:
        return this.visitLiteral(expression as LinqLiteralExpression);
      case LinqExpressionType.Lambda:
        // Lambdas são visitadas indiretamente (seus corpos são visitados)
        throw new Error(
          "Internal Error: Cannot directly visit LambdaExpression."
        );
      case LinqExpressionType.NewObject:
        // NewObject é tratado dentro da lógica de projeção (select, join)
        throw new Error(
          "Internal Error: Cannot directly visit NewObjectExpression. It should be handled by projection logic."
        );
      case LinqExpressionType.Scope:
        // Scope apenas passa a visita para a expressão fonte
        return this.visit((expression as ScopeExpression).sourceExpression);
      default:
        // Garante que todos os tipos de expressão sejam tratados
        const exhaustiveCheck: never = expression.type;
        throw new Error(`Unsupported LINQ expression type: ${exhaustiveCheck}`);
    }
  }

  // visitConstant (Inalterado)
  protected visitConstant(expression: LinqConstantExpression): SqlExpression {
    const value = expression.value;
    // Se for uma constante representando uma tabela
    if (value && typeof value === "object" && value.type === "Table") {
      const tableName = getTableName(expression);
      if (!tableName)
        throw new Error("Could not get table name from ConstantExpression.");
      // Gera um alias único para esta tabela no contexto atual
      const alias = this.context.generateTableAlias();
      return new TableExpression(tableName, alias);
    } else {
      // Se for qualquer outro valor constante (número, string, etc.)
      return new SqlConstantExpression(value);
    }
  }

  // visitLiteral (Inalterado)
  protected visitLiteral(expression: LinqLiteralExpression): SqlExpression {
    return new SqlConstantExpression(expression.value);
  }

  // visitParameter (Inalterado)
  protected visitParameter(expression: LinqParameterExpression): SqlExpression {
    // Retorna a fonte de dados SQL (Tabela, Select ou Union) associada a este
    // parâmetro LINQ no contexto atual.
    return this.context.getDataSourceForParameterStrict(expression);
  }

  // visitMember (Inalterado)
  protected visitMember(expression: LinqMemberExpression): SqlExpression {
    const memberName = expression.memberName;
    const sourceSql = this.visit(expression.objectExpression); // Visita o objeto base
    if (!sourceSql)
      throw new Error(`Could not resolve source for member '${memberName}'.`);

    // Tratamento especial para acesso à chave do GroupBy ('key.Department')
    if ((sourceSql as any).isGroupKeyPlaceholder) {
      const keySql = (sourceSql as any).getSqlForKeyAccess(memberName);
      if (keySql) return keySql;
      else
        throw new Error(
          `Could not resolve key member '${memberName}' in groupBy resultSelector.`
        );
    }
    // Acesso à chave simples ('key')
    if (sourceSql && (sourceSql as any).isGroupKeyPlaceholder) {
      const keySql = (sourceSql as any).getSqlForKeyAccess(); // Sem memberName
      if (keySql) return keySql;
    }

    // Acesso a membro de uma Tabela ('tableAlias.ColumnName')
    if (sourceSql instanceof TableExpression) {
      return new ColumnExpression(memberName, sourceSql);
    }
    // Acesso a membro de um Select (resultado de projeção anterior ou Union)
    else if (sourceSql instanceof SelectExpression) {
      // Tenta encontrar a projeção com o alias correspondente
      const projection = sourceSql.projection.find(
        (p) => p.alias === memberName
      );
      if (projection) {
        // Retorna a expressão SQL da projeção encontrada
        return projection.expression;
      }

      // Se não encontrou alias exato, verifica se há projeção '*' (SELECT *)
      // ou projeção de objeto inteiro (ex: { user: u } -> user_all)
      const starProjection = sourceSql.projection.find(
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
        // Se for SELECT *, acessa a coluna na tabela original referenciada
        return new ColumnExpression(
          memberName,
          starProjection.expression.table
        );
      }

      // Verifica projeção de objeto inteiro com alias especial (ex: 'user_all')
      const tablePlaceholderAlias = memberName + "_all";
      const tableProjection = sourceSql.projection.find(
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
        // Se encontrou, retorna a TableExpression referenciada. O próximo visitMember acessará a coluna real.
        return tableProjection.expression.table;
      }

      // Caso especial: A fonte do SELECT é uma UNION.
      // Tentamos acessar a coluna diretamente no alias da UNION.
      if (sourceSql.from instanceof CompositeUnionExpression) {
        // Cria uma TableExpression temporária para a ColumnExpression
        const tempTableForUnion = new TableExpression(
          `(<union>)`,
          sourceSql.from.alias
        );
        return new ColumnExpression(memberName, tempTableForUnion);
      }

      // Se não encontrou de nenhuma forma, lança erro
      throw new Error(
        `Member '${memberName}' not found in projections of source '${
          sourceSql.from.alias
        }'. Available: ${sourceSql.projection
          .map((p) => p.alias ?? p.expression.toString())
          .join(", ")}`
      );
    }
    // Acesso a membro de uma Coluna (ex: string.Length)
    else if (sourceSql instanceof ColumnExpression) {
      throw new Error(
        `Accessing member '${memberName}' on a ColumnExpression ('${sourceSql.name}') is not yet supported (requires SQL function mapping like LEN, etc.).`
      );
    }
    // Acesso a membro de Constante
    else if (sourceSql instanceof SqlConstantExpression) {
      throw new Error(
        `Accessing member '${memberName}' on a ConstantExpression is not yet supported.`
      );
    } else {
      throw new Error(
        `Cannot access member '${memberName}' on SQL type: ${sourceSql.constructor.name}`
      );
    }
  }

  // visitBinary (Inalterado)
  protected visitBinary(expression: LinqBinaryExpression): SqlExpression {
    const leftLinq = expression.left;
    const rightLinq = expression.right;
    const operator = expression.operator as LinqOperatorType;
    const leftSql = this.visit(leftLinq);
    const rightSql = this.visit(rightLinq);

    if (!leftSql || !rightSql) {
      throw new Error("Binary operands translation failed.");
    }

    // Otimização: Inverte a operação se for constante à esquerda e coluna à direita
    if (
      leftSql instanceof SqlConstantExpression &&
      rightSql instanceof ColumnExpression
    ) {
      let flippedOp = operator;
      // Apenas inverte operadores relacionais. Mantém outros como estão.
      if (operator === LinqOperatorType.LessThan) {
        flippedOp = LinqOperatorType.GreaterThan;
      } else if (operator === LinqOperatorType.LessThanOrEqual) {
        flippedOp = LinqOperatorType.GreaterThanOrEqual;
      } else if (operator === LinqOperatorType.GreaterThan) {
        flippedOp = LinqOperatorType.LessThan;
      } else if (operator === LinqOperatorType.GreaterThanOrEqual) {
        flippedOp = LinqOperatorType.LessThanOrEqual;
      }
      // Se o operador foi invertido (ou seja, era um dos relacionais acima)
      if (flippedOp !== operator) {
        return new SqlBinaryExpression(rightSql, flippedOp, leftSql);
      }
    }
    // Caso padrão (ou otimização não aplicada/necessária)
    return new SqlBinaryExpression(leftSql, operator, rightSql);
  }

  // visitMethodCall (Modificado para tratar Union como fonte em union/concat)
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

    // --- TRATAMENTO UNION/CONCAT COM FLATTENING ---
    if (methodName === "union" || methodName === "concat") {
      if (expression.args.length !== 1) {
        throw new Error(`Invalid arguments for '${methodName}'.`);
      }
      const isDistinct = methodName === "union";
      const secondLinqExpr = expression.args[0];

      // Visita ambas as fontes
      const firstVisited = this.visit(sourceLinqExpr); // Visita a primeira fonte (pode ser Table, Select, Union)
      const secondVisited = this.visit(secondLinqExpr); // Visita a segunda fonte (pode ser Table, Select, Union)

      // Garante que a SEGUNDA fonte seja SelectExpression (a primeira será tratada abaixo)
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

      // Verifica se a PRIMEIRA fonte já é uma Union compatível
      if (
        firstVisited instanceof CompositeUnionExpression &&
        firstVisited.distinct === isDistinct
      ) {
        // Merge: Adiciona a segunda SELECT às fontes existentes da primeira Union
        const existingSources = firstVisited.sources;
        const newSources = [...existingSources, secondSelect];
        const unionAlias = this.context.generateTableAlias(); // Novo alias para a union combinada
        return new CompositeUnionExpression(newSources, unionAlias, isDistinct);
      } else {
        // Cria nova Union: Garante que a PRIMEIRA fonte também seja SelectExpression
        let firstSelect: SelectExpression;
        if (
          firstVisited instanceof TableExpression ||
          firstVisited instanceof CompositeUnionExpression // Trata caso onde a primeira é uma Union de tipo diferente
        ) {
          firstSelect = this.createDefaultSelect(firstVisited);
        } else if (firstVisited instanceof SelectExpression) {
          firstSelect = firstVisited;
        } else {
          throw new Error(
            `First argument for '${methodName}' did not translate to Table, Select, or Union.`
          );
        }

        const unionAlias = this.context.generateTableAlias();
        return new CompositeUnionExpression(
          [firstSelect, secondSelect], // Cria nova union com as duas fontes (como Selects)
          unionAlias,
          isDistinct
        );
      }
    }
    // --- FIM TRATAMENTO UNION/CONCAT ---

    // --- Lógica existente para outros métodos ---
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
      currentSelect = this.createDefaultSelect(baseSql); // Cria SELECT * FROM (Union)
      sourceForLambda = currentSelect; // Lambda opera sobre o resultado da união
    } else {
      throw new Error(
        `Translation Error: Cannot apply method '${methodName}' to SQL source of type '${baseSql.constructor.name}'. Expected Table, Select, or Union.`
      );
    }

    // Delega para visitors específicos de cada método
    switch (methodName) {
      case "where":
        return visitWhereCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this)
        );
      case "select":
        return visitSelectCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.createProjections.bind(this)
        );
      case "join":
        return visitJoinCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visit.bind(this),
          this.visitInContext.bind(this),
          this.createProjections.bind(this)
        );
      case "orderBy":
        return visitOrderByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this),
          "ASC"
        );
      case "orderByDescending":
        return visitOrderByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this),
          "DESC"
        );
      case "thenBy":
        return visitThenByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this),
          "ASC"
        );
      case "thenByDescending":
        return visitThenByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this),
          "DESC"
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
          this.visitInContext.bind(this)
        );
      case "avg":
        return visitAvgCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this)
        );
      case "sum":
        return visitSumCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this)
        );
      case "min":
        return visitMinCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this)
        );
      case "max":
        return visitMaxCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this)
        );
      case "groupBy":
        return visitGroupByCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.visitInContext.bind(this),
          this // Passa a instância do visitor principal
        );
      default:
        throw new Error(
          `Unsupported LINQ method call during translation: ${methodName}`
        );
    }
  }

  // translateExistsExpression (Inalterado)
  private translateExistsExpression(
    expression: LinqMethodCallExpression
  ): SqlExistsExpression {
    if (!expression.source) throw new Error("'exists' requires a source.");
    let sourceSql = this.visit(expression.source);
    if (!sourceSql) throw new Error("Could not translate 'exists' source.");

    let selectForExists: SelectExpression;

    // Garante que a fonte seja um SelectExpression
    if (sourceSql instanceof TableExpression) {
      selectForExists = this.createDefaultSelect(sourceSql);
    } else if (sourceSql instanceof SelectExpression) {
      selectForExists = sourceSql;
    } else if (sourceSql instanceof CompositeUnionExpression) {
      selectForExists = this.createDefaultSelect(sourceSql);
    } else {
      throw new Error(
        `'exists' requires Table, Select or Union source. Found: ${sourceSql.constructor.name}`
      );
    }

    // Aplica o predicado do exists, se houver
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
        (selectForExists.from instanceof TableExpression ||
          selectForExists.from instanceof CompositeUnionExpression) && // Check if FROM is Table or Union
        selectForExists.projection.length === 1 &&
        selectForExists.projection[0].expression instanceof ColumnExpression &&
        selectForExists.projection[0].expression.name === "*"
          ? selectForExists.from // Use the original Table or Union
          : selectForExists; // Use the Select wrapping the Union or the original complex Select

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
            LinqOperatorType.And, // Usar LinqOperatorType
            predicateSql
          )
        : predicateSql;

      selectForExists = new SelectExpression(
        selectForExists.projection,
        selectForExists.from,
        newPredicate,
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

    const finalSelectForExists = new SelectExpression(
      [existsProjection],
      selectForExists.from,
      selectForExists.predicate,
      selectForExists.joins,
      [],
      null,
      null,
      []
    );

    return new SqlExistsExpression(finalSelectForExists);
  }

  // visitInContext (Inalterado)
  private visitInContext(
    expression: LinqExpression,
    context: TranslationContext
  ): SqlExpression | null {
    const originalContext = this.context; // Salva o contexto atual
    this.context = context; // Define o contexto filho temporariamente
    let result: SqlExpression | null = null;
    try {
      result = this.visit(expression); // Visita a expressão no contexto filho
    } finally {
      // Restaura o contexto original e atualiza o contador de alias
      this.context = originalContext;
      if (this.context !== context) {
        // Garante que o contador de alias seja atualizado no pai
        this.context.updateAliasCounterFromChild(context);
      }
    }
    return result;
  }

  // createProjections (Inalterado)
  public createProjections(
    body: LinqExpression,
    context: TranslationContext
  ): ProjectionExpression[] {
    const projections: ProjectionExpression[] = [];
    const visit = (expr: LinqExpression) => this.visitInContext(expr, context);

    // Caso 1: u => new { Name = u.name, Data = posts.where(...) }
    if (body.type === LinqExpressionType.NewObject) {
      const newObject = body as LinqNewObjectExpression;
      for (const [alias, expr] of newObject.properties.entries()) {
        const sqlExpr = visit(expr);
        if (!sqlExpr)
          throw new Error(`Projection failed for alias '${alias}'.`);

        // Subcaso: Valor é Tabela -> Projeta '*' com alias especial
        if (sqlExpr instanceof TableExpression) {
          projections.push(
            new ProjectionExpression(
              new ColumnExpression("*", sqlExpr),
              alias + "_all" // Alias especial para indicar objeto completo
            )
          );
        }
        // Subcaso: Valor é Select (Subquery)
        else if (sqlExpr instanceof SelectExpression) {
          let isKnownAggregate = false;
          // Verifica se é uma agregação conhecida
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

          // Determina se pode usar subconsulta escalar ou precisa de FOR JSON
          const useScalarSubquery =
            isKnownAggregate &&
            !sqlExpr.offset &&
            !sqlExpr.limit &&
            sqlExpr.joins.length === 0 &&
            sqlExpr.groupBy.length === 0; // Agregação sem paginação/join/group

          let subqueryExpression: SqlExpression;
          if (useScalarSubquery) {
            // Usa subconsulta escalar simples (sem FOR JSON)
            subqueryExpression = new SqlScalarSubqueryExpression(sqlExpr);
          } else {
            // Usa FOR JSON, decidindo sobre WITHOUT_ARRAY_WRAPPER
            const useWithoutArrayWrapper =
              sqlExpr.limit instanceof SqlConstantExpression &&
              sqlExpr.limit.value === 1; // take(1)
            subqueryExpression = new SqlScalarSubqueryAsJsonExpression(
              sqlExpr,
              undefined, // mode (default PATH)
              undefined, // includeNullValues (default true)
              useWithoutArrayWrapper
            );
          }
          projections.push(new ProjectionExpression(subqueryExpression, alias));
        }
        // Subcaso: Valor é Coluna, Constante, Função, Binário, Like
        else if (
          sqlExpr instanceof ColumnExpression ||
          sqlExpr instanceof SqlConstantExpression ||
          sqlExpr instanceof SqlFunctionCallExpression ||
          sqlExpr instanceof SqlBinaryExpression ||
          sqlExpr instanceof SqlLikeExpression
        ) {
          projections.push(new ProjectionExpression(sqlExpr, alias));
        }
        // Outros tipos SQL não esperados diretamente aqui
        else {
          throw new Error(
            `Unexpected SQL expression type (${sqlExpr.constructor.name}) encountered during projection creation for alias '${alias}'.`
          );
        }
      }
    }
    // Caso 2: u => u (Projeção de identidade)
    else if (body.type === LinqExpressionType.Parameter) {
      const param = body as LinqParameterExpression;
      const source = visit(param); // Obtém a fonte SQL para o parâmetro
      let tableOrUnionSource: TableExpressionBase | null = null;

      if (source instanceof TableExpression) {
        tableOrUnionSource = source;
      } else if (
        source instanceof SelectExpression &&
        source.from instanceof TableExpressionBase // Pode ser Table ou Union
      ) {
        tableOrUnionSource = source.from; // Usa a fonte base (Table ou Union)
        console.warn(
          `Identity projection on a SelectExpression [${tableOrUnionSource.alias}]. Projecting underlying source columns.`
        );
      } else if (source instanceof CompositeUnionExpression) {
        tableOrUnionSource = source;
        console.warn(
          `Identity projection on a Union source [${tableOrUnionSource.alias}]. Projecting union result columns.`
        );
      }

      if (!tableOrUnionSource)
        throw new Error(
          `Identity projection did not resolve to a base table or union source. Found: ${source?.constructor.name}`
        );

      // Cria a TableExpression temporária para a coluna '*'
      // O nome da "tabela" é irrelevante, só precisamos do alias correto
      const tempTable = new TableExpression(
        tableOrUnionSource.type === SqlExpressionType.Union
          ? "(<union>)"
          : "(<table>)", // Nome placeholder
        tableOrUnionSource.alias
      );

      // Cria a projeção SELECT *
      projections.push(
        new ProjectionExpression(
          new ColumnExpression("*", tempTable), // Coluna '*' referenciando a tabela/união via alias
          "*" // Alias especial '*'
        )
      );
    }
    // Caso 3: u => u.name (Projeção simples de membro/expressão)
    else {
      const sqlExpr = visit(body); // Visita a expressão do corpo da lambda
      if (!sqlExpr)
        throw new Error(
          `Simple projection translation failed for: ${body.toString()}`
        );

      // Verifica se é um tipo SQL simples (coluna, constante, etc.)
      if (
        sqlExpr instanceof ColumnExpression ||
        sqlExpr instanceof SqlConstantExpression ||
        sqlExpr instanceof SqlFunctionCallExpression ||
        sqlExpr instanceof SqlBinaryExpression ||
        sqlExpr instanceof SqlLikeExpression
      ) {
        // Tenta usar o nome do membro como alias, ou gera um padrão
        const alias =
          body.type === LinqExpressionType.MemberAccess
            ? (body as LinqMemberExpression).memberName
            : `expr${projections.length}`;
        projections.push(new ProjectionExpression(sqlExpr, alias));
      }
      // Não deveria resultar em Tabela ou Select ou Union aqui
      else if (
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
}
// --- END OF FILE src/query/translation/QueryExpressionVisitor.ts ---
