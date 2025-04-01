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
import { getTableName, OperatorType } from "../generation/utils/sqlUtils"; // Import OperatorType from sqlUtils
// *** NOVO: Importa AliasGenerator ***
import { AliasGenerator } from "../generation/AliasGenerator";

// Importa visitors de métodos
import {
  visitWhereCall,
  visitSelectCall,
  visitJoinCall,
  visitIncludesCall, // Usaremos este como base para outros métodos de string
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

    // Se o resultado for uma tabela base ou união, envolve em um SELECT *
    if (
      result instanceof TableExpression ||
      result instanceof CompositeUnionExpression
    ) {
      finalResult = this.createDefaultSelect(result);
    }

    // Valida o tipo do resultado final antes de retornar
    if (
      finalResult instanceof SelectExpression ||
      finalResult instanceof SqlExistsExpression
    ) {
      // Permite agregações sem GROUP BY como resultado final
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

    // Se não for Select ou Exists (ou agregação), lança erro
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

    // Cria uma referência de tabela temporária para a coluna '*'
    const tableRefForColumn = new TableExpression(
      source.type === SqlExpressionType.Table
        ? (source as TableExpression).name
        : "(<derived>)", // Placeholder para fontes não-tabela
      sourceAlias // Usa o alias garantido
    );
    const placeholderProjection = new ProjectionExpression(
      new ColumnExpression("*", tableRefForColumn), // Coluna '*' referenciando o alias da fonte
      "*" // Alias da projeção também é '*'
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
    // (Lógica do dispatcher inalterada, mas precisa saber que visitMethodCall agora pode retornar SqlExpression)
    if (!expression) return null;

    // Tratamento especial para chamadas de método que *não* são extensões LINQ
    // e que podem retornar expressões SQL simples (não SelectExpression).
    if (expression.type === LinqExpressionType.Call) {
      const callExpr = expression as LinqMethodCallExpression;
      switch (callExpr.methodName) {
        case "exists":
          return this.translateExistsExpression(callExpr);
        // Métodos de string/data que retornam um valor (não uma queryable)
        case "toUpperCase":
        case "toLowerCase":
        case "trim":
        case "startsWith":
        case "endsWith":
        case "includes": // includes já era tratado por visitIncludesCall
        case "substring": // Adicionar substring
        // Métodos de data
        case "getFullYear":
        case "getMonth":
        case "getDate":
        case "getHours":
        case "getMinutes":
        case "getSeconds":
          return this.visitInstanceMethodCall(callExpr);
      }
      // Se não for um método de instância conhecido nem 'exists', continua para o switch abaixo
    }

    // Switch principal para tipos de expressão LINQ
    switch (expression.type) {
      case LinqExpressionType.Constant:
        return this.visitConstant(expression as LinqConstantExpression);
      case LinqExpressionType.Parameter:
        return this.visitParameter(expression as LinqParameterExpression);
      case LinqExpressionType.MemberAccess:
        return this.visitMember(expression as LinqMemberExpression);
      case LinqExpressionType.Call:
        // Chega aqui apenas para métodos de extensão LINQ (where, select, join, etc.)
        // ou métodos não tratados no bloco 'if' acima.
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
        // Não deve ser visitado diretamente, mas sim dentro de projeções.
        // Retornar null ou lançar erro pode ser apropriado.
        // Lançar erro é mais seguro para detectar problemas de lógica.
        throw new Error(
          "Internal Error: Cannot directly visit NewObjectExpression. It should be handled by projection logic."
        );
      case LinqExpressionType.Scope:
        // Visita a expressão fonte, ignorando o escopo aqui (usado pelo parser)
        return this.visit((expression as ScopeExpression).sourceExpression);
      default:
        // Garante que todos os tipos sejam tratados (se ExpressionType fosse um enum completo)
        const exhaustiveCheck: never = expression.type;
        throw new Error(`Unsupported LINQ expression type: ${exhaustiveCheck}`);
    }
  }

  /**
   * Visita ConstantExpression (Tabela). Usa AliasGenerator.
   */
  protected visitConstant(expression: LinqConstantExpression): SqlExpression {
    const value = expression.value;
    // Se for uma definição de tabela
    if (value && typeof value === "object" && value.type === "Table") {
      const tableName = getTableName(expression);
      if (!tableName)
        throw new Error("Could not get table name from ConstantExpression.");
      // *** NOVO: Usa aliasGenerator ***
      const alias = this.aliasGenerator.generateAlias(tableName);
      return new TableExpression(tableName, alias);
    } else {
      // Se for outro tipo de constante (literal, etc.)
      return new SqlConstantExpression(value);
    }
  }

  /**
   * Visita LiteralExpression.
   */
  protected visitLiteral(expression: LinqLiteralExpression): SqlExpression {
    return new SqlConstantExpression(expression.value);
  }

  /**
   * Visita ParameterExpression. Retorna a fonte de dados SQL associada.
   */
  protected visitParameter(expression: LinqParameterExpression): SqlExpression {
    // Procura a fonte de dados (Tabela, Select, Union) associada a este parâmetro no contexto
    return this.context.getDataSourceForParameterStrict(expression);
  }

  /**
   * Visita MemberExpression (acesso a propriedade ou `.length`).
   * **ATUALIZADO:** Adiciona tratamento para `.length`.
   */
  protected visitMember(expression: LinqMemberExpression): SqlExpression {
    const memberName = expression.memberName;
    const sourceSqlBase = this.visit(expression.objectExpression); // Visita a expressão do objeto (ex: 'u' ou 'p')

    if (!sourceSqlBase)
      throw new Error(`Could not resolve source for member '${memberName}'.`);

    // Tratamento para acesso a chave de GroupBy (inalterado)
    if ((sourceSqlBase as any).isGroupKeyPlaceholder) {
      const keySql = (sourceSqlBase as any).getSqlForKeyAccess(memberName);
      if (keySql) return keySql;
      else
        throw new Error(
          `Could not resolve key member '${memberName}' in groupBy resultSelector.`
        );
    }
    if (sourceSqlBase && (sourceSqlBase as any).isGroupKeyPlaceholder) {
      // Caso simplificado para chave não-objeto
      const keySql = (sourceSqlBase as any).getSqlForKeyAccess();
      if (keySql) return keySql;
    }

    // Se a fonte for uma tabela base, seleção ou união (algo que tem alias)
    if (sourceSqlBase instanceof TableExpressionBase) {
      const sourceAlias = sourceSqlBase.alias;
      if (!sourceAlias) {
        throw new Error(
          `Source for member '${memberName}' is missing an alias. Source type: ${sourceSqlBase.constructor.name}`
        );
      }

      // Se a fonte for uma Tabela física
      if (sourceSqlBase instanceof TableExpression) {
        return new ColumnExpression(memberName, sourceSqlBase);
      }
      // Se a fonte for uma Seleção (subquery ou projeção anterior)
      else if (sourceSqlBase instanceof SelectExpression) {
        // Tenta encontrar uma projeção explícita com esse nome
        const projection = sourceSqlBase.projection.find(
          (p) => p.alias === memberName
        );
        if (projection) {
          // Retorna a expressão SQL da projeção encontrada
          // (pode ser uma coluna, constante, função, etc.)
          return projection.expression;
        }

        // Verifica se há uma projeção '*' que poderia conter a coluna
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
          // Aviso: Acessar via '*' pode ser ambíguo se houver joins
          console.warn(
            `Accessing member '${memberName}' via '*' projection on SelectExpression [${sourceAlias}]. This might be ambiguous.`
          );
          // Assume que a coluna existe na tabela referenciada pela projeção '*'
          return new ColumnExpression(
            memberName,
            starProjection.expression.table
          );
        }

        // Verifica se há uma projeção de tabela inteira (alias_all)
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
          // Se encontrou uma projeção como { user: u }, retorna a TableExpression de 'u'
          return tableProjection.expression.table;
        }

        // Se não encontrou projeção explícita, assume que é uma coluna da fonte SELECT
        // Cria uma referência de Tabela temporária representando a SelectExpression
        const tempTableForSelect = new TableExpression(
          `(<select>)`, // Nome placeholder
          sourceAlias
        );
        return new ColumnExpression(memberName, tempTableForSelect);
      }
      // Se a fonte for uma União
      else if (sourceSqlBase instanceof CompositeUnionExpression) {
        // Assume que a coluna existe no resultado da UNION
        const tempTableForUnion = new TableExpression(`(<union>)`, sourceAlias);
        return new ColumnExpression(memberName, tempTableForUnion);
      }
      // Caso inesperado
      else {
        throw new Error(
          `Unexpected type derived from TableExpressionBase: ${sourceSqlBase.constructor.name}`
        );
      }
    }
    // **NOVO: Tratamento para .length em expressões SQL que resultam em string**
    else if (memberName === "length") {
      // Assume que sourceSqlBase é uma expressão que resulta em string (Column, Function, etc.)
      // Mapeia para a função SQL LEN (SQL Server) ou LENGTH (padrão)
      return new SqlFunctionCallExpression("LEN", [sourceSqlBase]);
    }
    // Se a fonte for uma Coluna (acesso a membro em coluna? Ex: dateCol.Year - Mapear para função SQL)
    // (Este caso pode ser tratado em visitInstanceMethodCall ou aqui)
    else if (sourceSqlBase instanceof ColumnExpression) {
      // Se for Year, Month, Day em uma coluna de data, mapeia para função
      const funcName = mapPropertyToSqlFunction(memberName);
      if (funcName) {
        // Trata placeholders para DATEPART
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
    }
    // Erro se tentar acessar membro de constante, etc.
    else if (sourceSqlBase instanceof SqlConstantExpression) {
      throw new Error(
        `Accessing member '${memberName}' on a ConstantExpression is not supported.`
      );
    }
    // Erro genérico para outros tipos de SQL base
    else {
      throw new Error(
        `Cannot access member '${memberName}' on SQL type: ${sourceSqlBase.constructor.name}`
      );
    }
  }

  /**
   * Visita BinaryExpression.
   */
  protected visitBinary(expression: LinqBinaryExpression): SqlExpression {
    const leftLinq = expression.left;
    const rightLinq = expression.right;
    // Usa o OperatorType do sqlUtils importado
    const operator = expression.operator as OperatorType;

    // Visita os operandos esquerdo e direito
    const leftSql = this.visit(leftLinq);
    const rightSql = this.visit(rightLinq);

    // Valida se a tradução dos operandos foi bem-sucedida
    if (!leftSql || !rightSql) {
      throw new Error(
        `Binary operands translation failed for operator ${operator}. Left: ${leftLinq?.toString()}, Right: ${rightLinq?.toString()}`
      );
    }

    // Otimização: Inverte a ordem se for constante à esquerda e coluna à direita
    // Ex: 5 > u.age => u.age < 5
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

      // Se o operador foi invertido, retorna a expressão com operandos trocados
      if (flippedOp !== operator) {
        return new SqlBinaryExpression(rightSql, flippedOp, leftSql);
      }
    }

    // Cria a expressão binária SQL
    return new SqlBinaryExpression(leftSql, operator, rightSql);
  }

  /**
   * Visita chamadas de método de extensão LINQ (where, select, join, orderBy, etc.).
   * Retorna SelectExpression ou CompositeUnionExpression.
   */
  protected visitLinqExtensionMethodCall(
    expression: LinqMethodCallExpression
  ): SelectExpression | CompositeUnionExpression {
    const methodName = expression.methodName;
    const sourceLinqExpr = expression.source;

    if (!sourceLinqExpr) {
      throw new Error(
        `Translation Error: LINQ extension method call '${methodName}' requires a source expression.`
      );
    }

    // Tratamento especial para union/concat (retorna CompositeUnionExpression)
    if (methodName === "union" || methodName === "concat") {
      // (Lógica do union/concat inalterada...)
      if (expression.args.length !== 1) {
        throw new Error(`Invalid arguments for '${methodName}'.`);
      }
      const isDistinct = methodName === "union";
      const secondLinqExpr = expression.args[0];

      // Visita a primeira e a segunda fontes
      const firstVisited = this.visit(sourceLinqExpr);
      const secondVisited = this.visit(secondLinqExpr);

      // Garante que a segunda fonte seja um SelectExpression (ou converte)
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

      // Otimização: Se a primeira fonte já for uma Union compatível, adiciona a segunda
      if (
        firstVisited instanceof CompositeUnionExpression &&
        firstVisited.distinct === isDistinct
      ) {
        const existingSources = firstVisited.sources;
        const newSources = [...existingSources, secondSelect];
        // Gera um novo alias para a união expandida
        const unionAlias = this.aliasGenerator.generateAlias("union");
        return new CompositeUnionExpression(newSources, unionAlias, isDistinct);
      } else {
        // Caso contrário, cria uma nova Union a partir da primeira e segunda fontes
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
        // Gera alias para a nova união
        const unionAlias = this.aliasGenerator.generateAlias("union");
        return new CompositeUnionExpression(
          [firstSelect, secondSelect],
          unionAlias,
          isDistinct
        );
      }
    } // Fim tratamento union/concat

    // Para outros métodos LINQ, visita a fonte e garante que seja SelectExpression
    const baseSql = this.visit(sourceLinqExpr);
    if (!baseSql) {
      throw new Error(
        `Translation Error: Visiting the source expression for method '${methodName}' failed. Source: ${sourceLinqExpr.toString()}`
      );
    }

    // Converte a fonte base (Tabela, União) para uma SelectExpression se necessário
    let currentSelect: SelectExpression;
    let sourceForLambda: SqlDataSource; // Fonte a ser usada no contexto das lambdas
    if (baseSql instanceof TableExpression) {
      currentSelect = this.createDefaultSelect(baseSql);
      sourceForLambda = baseSql; // Lambda opera sobre a tabela base
    } else if (baseSql instanceof SelectExpression) {
      currentSelect = baseSql;
      sourceForLambda = currentSelect; // Lambda opera sobre o resultado do select anterior
    } else if (baseSql instanceof CompositeUnionExpression) {
      currentSelect = this.createDefaultSelect(baseSql);
      sourceForLambda = currentSelect; // Lambda opera sobre o resultado da união
    } else {
      throw new Error(
        `Translation Error: Cannot apply LINQ method '${methodName}' to SQL source of type '${baseSql.constructor.name}'. Expected Table, Select, or Union.`
      );
    }

    // Prepara a função de visita no contexto (para passar aos visitors de método)
    const boundVisitInContext: VisitInContextFn =
      this.visitInContext.bind(this);

    // Tratamento de Where vs Having (baseado se a fonte é GroupBy)
    if (methodName === "where") {
      let isSourceGroupBy = false;
      // Verifica se a expressão LINQ *fonte* foi uma chamada a groupBy
      if (
        sourceLinqExpr.type === LinqExpressionType.Call &&
        (sourceLinqExpr as LinqMethodCallExpression).methodName === "groupBy"
      ) {
        isSourceGroupBy = true;
      }

      // Se for where após groupBy, traduz como HAVING
      if (isSourceGroupBy) {
        return visitHavingCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext
        );
      } else {
        // Caso contrário, traduz como WHERE normal
        return visitWhereCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          boundVisitInContext
        );
      }
    }

    // Dispatch para visitors específicos de cada método LINQ
    switch (methodName) {
      case "select":
        return visitSelectCall(
          expression,
          currentSelect,
          sourceForLambda,
          this.context,
          this.createProjections.bind(this), // Passa a função para criar projeções
          this.aliasGenerator
        );
      case "join":
        return visitJoinCall(
          expression,
          currentSelect,
          sourceForLambda, // sourceForOuterLambda renomeada
          this.context,
          this.visit.bind(this), // Passa a função de visita principal
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
        // *** CORREÇÃO AQUI ***
        return visitGroupByCall(
          expression,
          currentSelect,
          sourceForLambda, // <<<< Corrigido de sourceForOuterLambda
          this.context,
          boundVisitInContext,
          this, // Passa o próprio visitor raiz
          this.aliasGenerator
        );
      // Adicionar outros métodos LINQ aqui (distinct, etc.)
      default:
        throw new Error(
          `Unsupported LINQ extension method call during translation: ${methodName}`
        );
    }
  }

  /**
   * **NOVO:** Visita chamadas de método de *instância* (string, data, etc.).
   * Retorna uma SqlExpression simples (não SelectExpression).
   */
  protected visitInstanceMethodCall(
    expression: LinqMethodCallExpression
  ): SqlExpression {
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

    // Mapeia métodos JS para funções/operações SQL
    switch (expression.methodName) {
      // --- Métodos de String (sem alterações) ---
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
      case "startsWith":
      case "endsWith":
      case "includes":
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
        } else if (expression.methodName === "endsWith") {
          likePattern = `%${escapedPattern}`;
        } else {
          likePattern = `%${escapedPattern}%`;
        }
        return new SqlLikeExpression(
          sourceSql,
          new SqlConstantExpression(likePattern)
        );
      case "substring":
        // Lógica do substring permanece a mesma (ajusta o start + 1, usa 8000 para length omitido)
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
        const sqlStart = new SqlConstantExpression(startArgSql.value + 1); // JS 0-based to SQL 1-based
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
          lengthArgSql = new SqlConstantExpression(8000); // To end of string
        }
        return new SqlFunctionCallExpression("SUBSTRING", [
          sourceSql,
          sqlStart,
          lengthArgSql,
        ]);

      // --- Métodos de Data ---
      case "getFullYear":
        if (expression.args.length !== 0)
          throw new Error("'getFullYear' takes no arguments.");
        return new SqlFunctionCallExpression("YEAR", [sourceSql]);

      // ***** A ÚNICA SOLUÇÃO DENTRO DESTE MÉTODO *****
      case "getMonth": // JS retorna 0-11, SQL MONTH retorna 1-12
        if (expression.args.length !== 0)
          throw new Error("'getMonth' takes no arguments.");
        // Para que o VALOR retornado seja 0-11, precisamos gerar MONTH(...) - 1
        // Isso garante que comparações posteriores com 0, 1, etc., funcionem diretamente.
        console.log("Translating getMonth() to SQL: MONTH(...) - 1");
        const monthSql = new SqlFunctionCallExpression("MONTH", [sourceSql]);
        // Retorna a expressão aritmética. O SQL final terá a subtração.
        return new SqlBinaryExpression(
          monthSql,
          OperatorType.Subtract, // Certifique-se que OperatorType.Subtract está definido e mapeado para '-'
          new SqlConstantExpression(1)
        );
      // ***** FIM DA SOLUÇÃO PARA getMonth() *****

      case "getDate": // Dia do mês
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
  /**
   * Traduz uma chamada ao método 'exists'.
   */
  private translateExistsExpression(
    expression: LinqMethodCallExpression
  ): SqlExistsExpression {
    if (!expression.source) throw new Error("'exists' requires a source.");

    // Visita a expressão fonte do 'exists'
    let sourceSql = this.visit(expression.source);
    if (!sourceSql) throw new Error("Could not translate 'exists' source.");

    // Garante que a fonte seja uma SelectExpression (ou converte)
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

    // Se houver um predicado (exists(predicate))
    if (expression.args.length > 0) {
      if (
        expression.args.length !== 1 ||
        expression.args[0].type !== LinqExpressionType.Lambda
      ) {
        throw new Error("Invalid 'exists' predicate arguments.");
      }
      const lambda = expression.args[0] as LinqLambdaExpression;
      const param = lambda.parameters[0];

      // Define a fonte para resolver a lambda do predicado.
      // Se a projeção for '*', usa a fonte FROM original, caso contrário usa o próprio SELECT.
      const sourceForPredicate: SqlDataSource =
        selectForExists.from instanceof TableExpressionBase &&
        selectForExists.projection.length === 1 &&
        selectForExists.projection[0].expression instanceof ColumnExpression &&
        selectForExists.projection[0].expression.name === "*"
          ? selectForExists.from // Usa a tabela/união original se for SELECT *
          : selectForExists; // Usa o próprio SELECT se houver projeção específica

      // Cria contexto filho para visitar o corpo da lambda
      const predicateContext = this.context.createChildContext(
        [param],
        [sourceForPredicate]
      );
      const predicateSql = this.visitInContext(lambda.body, predicateContext);
      if (!predicateSql)
        throw new Error("Could not translate 'exists' predicate.");

      // Combina o novo predicado com o predicado WHERE existente no SELECT
      const newPredicate = selectForExists.predicate
        ? new SqlBinaryExpression(
            selectForExists.predicate,
            OperatorType.And, // Usa o OperatorType importado de sqlUtils
            predicateSql
          )
        : predicateSql;

      // Atualiza o SelectExpression com o novo predicado combinado
      // Mantendo o mesmo alias e outras cláusulas
      selectForExists = new SelectExpression(
        selectForExists.alias,
        selectForExists.projection,
        selectForExists.from,
        newPredicate, // Atualizado
        selectForExists.having,
        selectForExists.joins,
        selectForExists.orderBy,
        selectForExists.offset,
        selectForExists.limit,
        selectForExists.groupBy
      );
    }

    // Cria a projeção para a subconsulta EXISTS (SELECT 1)
    const existsProjection = new ProjectionExpression(
      new SqlConstantExpression(1), // Projeta a constante 1
      "exists_val" // Alias interno (opcional, não usado no SQL final do EXISTS)
    );
    const existsAlias = ""; // Alias vazio para a subconsulta EXISTS

    // Cria a SelectExpression final para dentro do EXISTS
    const finalSelectForExists = new SelectExpression(
      existsAlias, // Alias vazio
      [existsProjection], // Projeção (SELECT 1)
      selectForExists.from, // FROM original
      selectForExists.predicate, // Predicado WHERE (original ou combinado)
      selectForExists.having, // HAVING (se houver)
      selectForExists.joins, // Joins (originais)
      [], // Remove ORDER BY dentro do EXISTS
      null, // Remove OFFSET dentro do EXISTS
      null, // Remove LIMIT dentro do EXISTS
      selectForExists.groupBy // Preserva GROUP BY dentro do EXISTS
    );

    // Retorna a expressão SQL EXISTS envolvendo o SELECT final
    return new SqlExistsExpression(finalSelectForExists);
  }

  /**
   * Visita uma expressão LINQ dentro de um contexto específico (geralmente para lambdas).
   */
  private visitInContext(
    expression: LinqExpression,
    context: TranslationContext
  ): SqlExpression | null {
    const originalContext = this.context; // Salva o contexto atual
    this.context = context; // Define o contexto para a visita
    let result: SqlExpression | null = null;
    try {
      result = this.visit(expression); // Visita a expressão no novo contexto
    } finally {
      this.context = originalContext; // Restaura o contexto original
    }
    return result;
  }

  /**
   * Cria as projeções SQL (colunas do SELECT) a partir do corpo de uma lambda LINQ (select ou join).
   */
  public createProjections(
    body: LinqExpression,
    context: TranslationContext
  ): ProjectionExpression[] {
    const projections: ProjectionExpression[] = [];
    // Função helper para visitar expressões dentro deste contexto de projeção
    const visit = (expr: LinqExpression) => this.visitInContext(expr, context);

    // Caso 1: Projeção é um objeto anônimo (NewObjectExpression)
    if (body.type === LinqExpressionType.NewObject) {
      const newObject = body as LinqNewObjectExpression;
      // Itera sobre as propriedades do objeto { alias: expression }
      for (const [alias, expr] of newObject.properties.entries()) {
        let sqlExpr = visit(expr); // Visita a expressão que define o valor da propriedade

        if (!sqlExpr)
          throw new Error(`Projection failed for alias '${alias}'.`);

        // Se a expressão resultar em uma tabela (ex: { user: u }), projeta todas as colunas dessa tabela
        if (sqlExpr instanceof TableExpression) {
          projections.push(
            new ProjectionExpression(
              new ColumnExpression("*", sqlExpr), // Cria SELECT alias.*
              alias + "_all" // Adiciona sufixo para indicar projeção de tabela inteira
            )
          );
        }
        // Se a expressão resultar em uma subconsulta SELECT (ex: { Posts: posts.where(...) })
        else if (sqlExpr instanceof SelectExpression) {
          // Verifica se é uma agregação conhecida (COUNT, SUM, etc.) sem paginação/joins/grouping complexos
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

          // Condições para usar subconsulta escalar simples (SELECT (SELECT AGG(...) ...))
          const useScalarSubquery =
            isKnownAggregate && // É uma agregação conhecida
            !sqlExpr.offset && // Sem OFFSET
            !sqlExpr.limit && // Sem LIMIT
            sqlExpr.joins.length === 0 && // Sem JOINs
            sqlExpr.groupBy.length === 0 && // Sem GROUP BY
            !sqlExpr.having; // Sem HAVING

          let subqueryExpression: SqlExpression;
          if (useScalarSubquery) {
            // Cria uma subconsulta escalar simples (SELECT (subquery))
            subqueryExpression = new SqlScalarSubqueryExpression(sqlExpr);
          } else {
            // Caso contrário, usa subconsulta formatada como JSON (FOR JSON)
            // Verifica se deve usar WITHOUT_ARRAY_WRAPPER (para take(1))
            const useWithoutArrayWrapper =
              sqlExpr.limit instanceof SqlConstantExpression &&
              sqlExpr.limit.value === 1;

            // Garante que o SELECT interno tenha um alias se não for escalar
            if (!sqlExpr.alias && !useScalarSubquery) {
              console.warn(
                `SelectExpression for JSON projection '${alias}' was missing alias. Generating one.`
              );
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
            // Cria a expressão para gerar JSON
            subqueryExpression = new SqlScalarSubqueryAsJsonExpression(
              sqlExpr as SelectExpression,
              undefined, // mode (default PATH)
              undefined, // includeNullValues (default true)
              useWithoutArrayWrapper // withoutArrayWrapper (baseado no take(1))
            );
          }
          // Adiciona a projeção da subconsulta com o alias da propriedade
          projections.push(new ProjectionExpression(subqueryExpression, alias));
        }
        // Se a expressão resultar em Coluna, Constante, Função, Binária ou Like
        else if (
          sqlExpr instanceof ColumnExpression ||
          sqlExpr instanceof SqlConstantExpression ||
          sqlExpr instanceof SqlFunctionCallExpression ||
          sqlExpr instanceof SqlBinaryExpression ||
          sqlExpr instanceof SqlLikeExpression
        ) {
          // Adiciona a projeção simples com o alias da propriedade
          projections.push(new ProjectionExpression(sqlExpr, alias));
        }
        // Tipo de expressão SQL inesperado na projeção
        else {
          throw new Error(
            `Unexpected SQL expression type (${sqlExpr.constructor.name}) encountered during projection creation for alias '${alias}'.`
          );
        }
      }
    }
    // Caso 2: Projeção é um parâmetro direto (ex: select(u => u))
    else if (body.type === LinqExpressionType.Parameter) {
      const param = body as LinqParameterExpression;
      const source = visit(param); // Obtém a fonte SQL para o parâmetro

      let tableOrUnionSource: TableExpressionBase | null = null;
      // Verifica se a fonte é Tabela, Select ou União
      if (source instanceof TableExpression) {
        tableOrUnionSource = source;
      } else if (
        source instanceof SelectExpression &&
        source.from instanceof TableExpressionBase
      ) {
        // Se for um Select, pega a fonte FROM dele
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

      // Cria uma referência de tabela temporária para projetar todas as colunas
      const tempTable = new TableExpression(
        tableOrUnionSource.type === SqlExpressionType.Union
          ? "(<union>)" // Nome placeholder para união
          : "(<table>)", // Nome placeholder para tabela/select
        tableOrUnionSource.alias // Usa o alias da fonte original
      );
      // Adiciona a projeção SELECT alias.*
      projections.push(
        new ProjectionExpression(new ColumnExpression("*", tempTable), "*")
      );
    }
    // Caso 3: Projeção é uma expressão simples (ex: select(u => u.Name), select(u => u.Age + 1))
    else {
      const sqlExpr = visit(body); // Visita a expressão da projeção
      if (!sqlExpr)
        throw new Error(
          `Simple projection translation failed for: ${body.toString()}`
        );

      // Verifica se o resultado é um tipo SQL simples (coluna, constante, função, etc.)
      if (
        sqlExpr instanceof ColumnExpression ||
        sqlExpr instanceof SqlConstantExpression ||
        sqlExpr instanceof SqlFunctionCallExpression ||
        sqlExpr instanceof SqlBinaryExpression ||
        sqlExpr instanceof SqlLikeExpression
      ) {
        // Determina o alias: nome do membro se for MemberAccess, ou 'exprN'
        const alias =
          body.type === LinqExpressionType.MemberAccess
            ? (body as LinqMemberExpression).memberName
            : `expr${projections.length}`; // Gera um alias padrão
        projections.push(new ProjectionExpression(sqlExpr, alias));
      }
      // Erro se a projeção simples resultar em Tabela/Select/União (inesperado)
      else if (
        sqlExpr instanceof TableExpression ||
        sqlExpr instanceof SelectExpression ||
        sqlExpr instanceof CompositeUnionExpression
      ) {
        throw new Error(
          `Simple projection resolved to a Table/Select/Union expression unexpectedly: ${body.toString()}`
        );
      }
      // Erro para outros tipos SQL inesperados
      else {
        throw new Error(
          `Simple projection did not resolve to a simple column/value/aggregate/known SQL type. Result type: ${
            sqlExpr.constructor.name
          }, Original LINQ: ${body.toString()}`
        );
      }
    }

    // Validação final: garante que pelo menos uma projeção foi criada
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
  switch (propertyName.toLowerCase()) {
    case "year":
      return "YEAR";
    case "month":
      // Poderia ajustar para MONTH()-1 aqui se necessário, mas mantemos direto
      return "MONTH";
    case "day": // Mapeia 'day' (ou 'date') para DAY
    case "date":
      return "DAY";
    case "hour": // Mapeia 'hour' ou 'hours' para DATEPART(hour,...)
    case "hours":
      return "DATEPART(hour,...)"; // Placeholder - será tratado no visitMember
    case "minute": // Mapeia 'minute' ou 'minutes' para DATEPART(minute,...)
    case "minutes":
      return "DATEPART(minute,...)"; // Placeholder
    case "second": // Mapeia 'second' ou 'seconds' para DATEPART(second,...)
    case "seconds":
      return "DATEPART(second,...)"; // Placeholder
    // Adicionar outros mapeamentos se necessário (ex: DayOfWeek -> DATEPART(weekday,...))
    default:
      return null; // Propriedade não mapeada
  }
}

// --- END OF FILE src/query/translation/QueryExpressionVisitor.ts ---
