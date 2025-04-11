// src/query/QueryProvider.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Expression as LinqExpression,
  MethodCallExpression as LinqMethodCallExpression,
  // Outros imports de LinqExpression não são mais necessários para a verificação
} from "../expressions";
import { IQueryable, IQueryProvider, ElementType } from "../interfaces";
import { Query } from "./Query";
import { QueryExpressionVisitor } from "./translation/QueryExpressionVisitor";
import {
  SqlExpression, // Importar SqlExpression
  SqlExpressionType,
  SelectExpression, // Importar SelectExpression
  ColumnExpression, // Manter para lógica de execução
} from "../sql-expressions";
import { SqlServerQuerySqlGenerator } from "./generation/SqlServerQuerySqlGenerator";

/**
 * Provedor de consulta que traduz expressões LINQ para SQL e simula a execução.
 * Inclui verificação de projeção explícita antes da execução/tradução
 * para métodos terminais que retornam dados de entidade(s),
 * analisando a SelectExpression SQL resultante.
 *
 * @export
 * @class QueryProvider
 * @implements {IQueryProvider}
 */
export class QueryProvider implements IQueryProvider {
  constructor() {}

  createQuery<TElement>(expression: LinqExpression, elementType: ElementType): IQueryable<TElement> {
    return new Query<TElement>(expression, this, elementType);
  }

  /**
   * Verifica se a projeção de uma SelectExpression SQL é explícita.
   * Retorna `false` se encontrar uma projeção `ColumnExpression` com `name === '*'`.
   *
   * @private
   * @param {SelectExpression} selectExpr A SelectExpression SQL a ser analisada.
   * @returns {boolean} `true` se a projeção for explícita, `false` caso contrário.
   */
  private isSqlProjectionExplicit(selectExpr: SelectExpression): boolean {
    if (!selectExpr || !selectExpr.projection || selectExpr.projection.length === 0) {
      // Se não há projeção, não é possível ser implícito nesse sentido (pode ser erro)
      return true;
    }

    for (const proj of selectExpr.projection) {
      if (proj.expression instanceof ColumnExpression && proj.expression.name === "*") {
        // Encontrou SELECT alias.* ou SELECT * -> Implícito
        return false;
      }
      // Poderíamos adicionar outras verificações aqui se a tradução pudesse
      // resultar em TableExpression/CompositeUnionExpression diretamente na projeção,
      // mas idealmente a tradução já evitaria isso. O foco é no ColumnExpression('*').
    }

    // Nenhuma projeção implícita encontrada
    return true;
  }

  /**
   * Traduz a expressão LINQ para SQL e verifica se a projeção é explícita,
   * SE o método terminal exigir.
   * Lança um erro se a projeção for implícita quando não deveria ser.
   *
   * @private
   * @param {LinqExpression} expression A expressão LINQ final.
   * @param {string} terminalMethodName O nome do método terminal sendo chamado.
   * @returns {SqlExpression} A expressão SQL traduzida.
   * @throws {Error} Se a projeção for implícita e o método a exigir explícita, ou se a tradução falhar.
   */
  private translateAndCheckProjection(expression: LinqExpression, terminalMethodName: string): SqlExpression {
    // Métodos que NÃO precisam de projeção explícita
    const skipCheckMethods = new Set(["count", "sum", "avg", "min", "max", "any"]);
    const baseMethodName = terminalMethodName.replace(/Async$/, "");

    // Traduz PRIMEIRO
    let sqlExpression: SqlExpression;
    try {
      const translator = new QueryExpressionVisitor();
      sqlExpression = translator.translate(expression);
    } catch (translationError: any) {
      console.error("Erro durante a tradução LINQ -> SQL:", translationError.message);
      if (translationError.stack) console.error("Stack:", translationError.stack);
      console.error("Original LINQ Expression Tree:", expression.toString());
      // Re-lança o erro de tradução
      throw new Error(`Falha na tradução da consulta: ${translationError.message}`);
    }

    // Se for um método que não precisa de verificação, retorna a expressão traduzida.
    if (skipCheckMethods.has(baseMethodName)) {
      return sqlExpression;
    }

    // Se o método precisa de verificação E a expressão SQL resultante é uma SelectExpression
    if (sqlExpression instanceof SelectExpression) {
      // Verifica a projeção da SelectExpression SQL
      if (!this.isSqlProjectionExplicit(sqlExpression)) {
        // Projeção SQL é implícita (contém '*'), lança erro.
        throw new Error(
          `A operação '${terminalMethodName}' não pode ser executada porque a projeção final da consulta SQL resultante é implícita (contém '*'). ` +
            `Use '.select()' na sua consulta LINQ para especificar explicitamente as colunas ou valores desejados.`
          // `Exemplo LINQ implícito: query.toList(), query.join(..., (u, p) => ({ u, p })).toList()` // Removido exemplo específico
        );
      }
    }
    // Se não for SelectExpression (ex: SqlExistsExpression), a verificação passa.
    // Se a tradução resultou em algo inesperado que não é Select ou Exists,
    // a lógica de execução/geração de SQL provavelmente falhará depois.

    return sqlExpression; // Retorna a expressão SQL traduzida (e validada, se aplicável)
  }

  /**
   * Executa a consulta representada pela árvore de expressão LINQ.
   * Traduz para SQL, verifica a projeção, e então simula a execução.
   *
   * @template TResult O tipo do resultado esperado.
   * @param {LinqExpression} expression A árvore de expressão LINQ.
   * @returns {(Promise<TResult> | TResult)} O resultado da execução.
   */
  execute<TResult>(expression: LinqExpression): Promise<TResult> | TResult {
    const terminalMethodName = expression instanceof LinqMethodCallExpression ? expression.methodName : "execute";

    try {
      // Traduz e verifica a projeção
      const finalSqlExpression = this.translateAndCheckProjection(expression, terminalMethodName);

      // Gera o SQL (se a verificação passou)
      const sqlGenerator = new SqlServerQuerySqlGenerator();
      const sql = sqlGenerator.Generate(finalSqlExpression);

      // Simulação da execução (lógica mantida)
      console.log("--- Executing SQL (Simulation) ---");
      console.log(sql);
      console.log("----------------------------------");

      const isAsyncCall = expression instanceof LinqMethodCallExpression && expression.methodName.endsWith("Async");
      const baseMethodName =
        expression instanceof LinqMethodCallExpression
          ? expression.methodName.replace(/Async$/, "")
          : terminalMethodName === "execute"
            ? "toList" // Assume toList se for execução direta sem método
            : terminalMethodName;

      // --- Lógica de simulação (exatamente como antes) ---
      if (baseMethodName === "any") {
        console.warn("Simulating DB execution for ANY (synchronous): Returning TRUE.");
        return true as TResult;
      }
      if (baseMethodName === "toList") {
        console.warn("Simulating DB execution for toList/toListAsync: Returning mocked array.");
        const mockData = [
          { id: 1, name: "Mock 1", email: "m1@test.com", age: 20 },
          { id: 2, name: "Mock 2", email: "m2@test.com", age: 30 },
        ];
        if (isAsyncCall) return Promise.resolve(mockData as unknown as TResult);
        else return mockData as unknown as TResult;
      }
      if (finalSqlExpression.type === SqlExpressionType.Exists) {
        // AnyAsync é traduzido para Exists
        console.warn("Simulating DB execution for EXISTS (AnyAsync): Returning TRUE.");
        if (isAsyncCall) return Promise.resolve(true as TResult);
        else {
          // Any síncrono já tratado acima
          console.error("Unexpected synchronous execution reaching Exists expression type.");
          return true as TResult;
        }
      } else if (finalSqlExpression.type === SqlExpressionType.Select) {
        let simulatedResult: any = null;
        const isSimulatedEmpty = sql.includes("WHERE 1 = 0") || sql.includes("WHERE 0");
        switch (baseMethodName) {
          case "count":
            simulatedResult = isSimulatedEmpty ? 0 : 10;
            break;
          case "avg":
            simulatedResult = isSimulatedEmpty ? null : 42.5;
            break;
          case "sum":
            simulatedResult = isSimulatedEmpty ? null : 1234;
            break;
          case "min":
            simulatedResult = isSimulatedEmpty ? null : 1;
            break;
          case "max":
            simulatedResult = isSimulatedEmpty ? null : 99;
            break;
          case "first":
            if (isSimulatedEmpty) throw new Error("Simulation: Sequence contains no elements (for First).");
            simulatedResult = { id: 1, name: "Mock First" };
            break;
          case "firstOrDefault":
            simulatedResult = isSimulatedEmpty ? null : { id: 1, name: "Mock FirstOrDefault" };
            break;
          case "single":
            if (isSimulatedEmpty) throw new Error("Simulation: Sequence contains no elements (for Single).");
            simulatedResult = { id: 5, name: "Mock Single" };
            break;
          case "singleOrDefault":
            simulatedResult = isSimulatedEmpty ? null : { id: 5, name: "Mock SingleOrDefault" };
            break;
          default: {
            // Default to array simulation if projection was explicit but method not handled
            console.warn(
              `Simulation: Defaulting to array for unhandled terminal method '${terminalMethodName}' resulting in SELECT.`
            );
            const mockData = isSimulatedEmpty
              ? []
              : [
                  { id: 1, name: "Mock Default 1" },
                  { id: 2, name: "Mock Default 2" },
                ];
            if (isAsyncCall) return Promise.resolve(mockData as unknown as TResult);
            else return mockData as unknown as TResult;
          }
        }
        // Return for simulated cases within the switch
        if (isAsyncCall) {
          console.warn(
            `Simulating DB execution for ${baseMethodName.toUpperCase()} (async): Returning ${JSON.stringify(simulatedResult)}.`
          );
          return Promise.resolve(simulatedResult as TResult);
        } else {
          console.warn(
            `Simulating DB execution for ${baseMethodName.toUpperCase()} (sync): Returning ${JSON.stringify(simulatedResult)}.`
          );
          if (simulatedResult instanceof Promise) {
            throw new Error(`Internal Error: Unexpected Promise during synchronous simulation of ${baseMethodName}`);
          }
          return simulatedResult as TResult;
        }
      } else {
        // Should not happen if translation is correct and simulation handles Exists
        const errorMsg = `Execution simulation not supported for final SQL expression type ${finalSqlExpression.type}`;
        const error = new Error(errorMsg);
        if (isAsyncCall) return Promise.reject(error);
        else throw error;
      }
    } catch (e: any) {
      // Captura erros da verificação de projeção, tradução ou geração SQL
      const errorMessage = `Query Processing Failed during execute for '${terminalMethodName}': ${e.message}`;
      console.error(errorMessage);
      if (e.stack) console.error("Stack:", e.stack);
      const error = new Error(errorMessage);
      error.stack = e.stack;

      // Decide se retorna Promise rejeitada ou lança erro
      const isAsync = expression instanceof LinqMethodCallExpression && expression.methodName.endsWith("Async");
      if (isAsync) return Promise.reject(error);
      else throw error;
    }
  }

  /**
   * Obtém a representação textual (SQL) da consulta.
   * Traduz para SQL e verifica a projeção antes de gerar o texto.
   *
   * @param {LinqExpression} expression A árvore de expressão LINQ.
   * @returns {string} A string SQL gerada.
   * @throws {Error} Se a projeção for implícita ou ocorrer erro na tradução/geração.
   */
  getQueryText(expression: LinqExpression): string {
    try {
      // Traduz e verifica a projeção (usa 'getQueryText' como nome do método terminal para a verificação)
      const sqlExpression = this.translateAndCheckProjection(expression, "getQueryText");

      // Gera o SQL
      const sqlGenerator = new SqlServerQuerySqlGenerator();
      return sqlGenerator.Generate(sqlExpression);
    } catch (e: any) {
      // Captura erros da verificação ou tradução/geração
      const errorMessage = `Query Processing Failed during getQueryText: ${e.message}`;
      console.error(errorMessage);
      if (e.stack) console.error("Stack:", e.stack);
      console.error("Original LINQ Expression Tree:", expression.toString());
      const error = new Error(errorMessage);
      error.stack = e.stack;
      throw error;
    }
  }
}
