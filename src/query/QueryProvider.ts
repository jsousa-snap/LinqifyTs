// src/query/QueryProvider.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Expression as LinqExpression, MethodCallExpression as LinqMethodCallExpression } from "../expressions";
import { IQueryable, IQueryProvider, ElementType } from "../interfaces";
import { Query } from "./Query";
import { QueryExpressionVisitor } from "./translation/QueryExpressionVisitor";
import { SqlExpressionType } from "../sql-expressions";
import { SqlServerQuerySqlGenerator } from "./generation/SqlServerQuerySqlGenerator";
import { isProjectionExplicit } from "./utils/expressionUtils";

/**
 * Provedor de consulta que traduz expressões LINQ para SQL e simula a execução.
 * Inclui verificação de projeção explícita antes da execução/tradução
 * para métodos terminais que retornam dados de entidade(s).
 *
 * @export
 * @class QueryProvider
 * @implements {IQueryProvider}
 */
export class QueryProvider implements IQueryProvider {
  constructor() {}

  /**
   * Cria um novo objeto IQueryable para uma dada expressão LINQ.
   * @template TElement O tipo dos elementos da consulta.
   * @param {LinqExpression} expression A árvore de expressão LINQ.
   * @param {ElementType} elementType O tipo dos elementos resultantes.
   * @returns {IQueryable<TElement>} O novo objeto IQueryable.
   */
  createQuery<TElement>(expression: LinqExpression, elementType: ElementType): IQueryable<TElement> {
    return new Query<TElement>(expression, this, elementType);
  }

  /**
   * Verifica se a projeção final da consulta é explícita.
   * Lança um erro se a projeção for implícita e o método exigir uma explícita.
   * Ignora a verificação para métodos agregados (count, sum, etc.) e 'any'.
   *
   * @private
   * @param {LinqExpression} expression A expressão LINQ final.
   * @param {string} terminalMethodName O nome do método terminal sendo chamado (ex: 'toListAsync', 'first').
   * @throws {Error} Se a projeção for implícita e o método a exigir explícita.
   */
  private checkExplicitProjection(expression: LinqExpression, terminalMethodName: string): void {
    const skipCheckMethods = new Set([
      "count",
      "sum",
      "avg",
      "min",
      "max", // Agregados
      "any", // Existência
      "countAsync",
      "sumAsync",
      "avgAsync",
      "minAsync",
      "maxAsync",
      "anyAsync", // Versões Async
    ]);

    let baseMethodName = terminalMethodName.replace(/Async$/, "");
    if (
      terminalMethodName === "execute" ||
      terminalMethodName === "getQueryText" ||
      terminalMethodName === "toQueryString"
    ) {
      if (expression instanceof LinqMethodCallExpression) {
        baseMethodName = expression.methodName.replace(/Async$/, "");
      } else {
        return;
      }
    }

    if (!skipCheckMethods.has(baseMethodName) && !isProjectionExplicit(expression)) {
      throw new Error(
        `A operação '${terminalMethodName}' não pode ser executada porque a projeção final da consulta não foi definida explicitamente. ` +
          `Use '.select()' para especificar as colunas desejadas.`
      );
    }
  }

  /**
   * Executa a consulta representada pela árvore de expressão LINQ.
   * Pode retornar um valor diretamente (para `any`) ou uma Promise.
   * Realiza a verificação de projeção explícita antes da tradução/execução.
   *
   * @template TResult O tipo do resultado esperado.
   * @param {LinqExpression} expression A árvore de expressão LINQ.
   * @returns {(Promise<TResult> | TResult)} O resultado da execução.
   */
  execute<TResult>(expression: LinqExpression): Promise<TResult> | TResult {
    const terminalMethodName = (expression as LinqMethodCallExpression)?.methodName ?? "execute";
    this.checkExplicitProjection(expression, terminalMethodName);

    const translator = new QueryExpressionVisitor();
    const sqlGenerator = new SqlServerQuerySqlGenerator();

    const finalSqlExpression = translator.translate(expression);
    const sql = sqlGenerator.Generate(finalSqlExpression);

    // Simulação da execução
    console.log("--- Executing SQL (Simulation) ---");
    console.log(sql);
    console.log("----------------------------------");

    const isAsyncCall = expression instanceof LinqMethodCallExpression && expression.methodName.endsWith("Async");
    const baseMethodName =
      expression instanceof LinqMethodCallExpression ? expression.methodName.replace(/Async$/, "") : "unknown";

    if (baseMethodName === "any") {
      console.warn("Simulating DB execution for ANY (synchronous): Returning TRUE.");
      return true as TResult;
    }

    if (baseMethodName === "toList") {
      console.warn("Simulating DB execution for toListAsync: Returning mocked array.");
      return Promise.resolve([
        { id: 1, name: "Mock 1" },
        { id: 2, name: "Mock 2" },
      ] as unknown as TResult);
    }

    if (finalSqlExpression.type === SqlExpressionType.Exists) {
      console.error("Execution reached SqlExistsExpression unexpectedly.");
      if (isAsyncCall) return Promise.resolve(true as TResult);
      else return true as TResult;
    } else if (finalSqlExpression.type === SqlExpressionType.Select) {
      let simulatedResult: any = null;
      const isSimulatedEmpty = sql.includes("WHERE 1 = 0") || sql.includes("WHERE 0");

      switch (baseMethodName) {
        case "count":
          simulatedResult = 10;
          break;
        case "avg":
          simulatedResult = isSimulatedEmpty ? null : 42.5;
          break;
        case "sum":
          simulatedResult = 1234;
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
          const errorMsg = `Simulation not handled for method '${terminalMethodName}' resulting in standard SELECT.`;
          console.error(errorMsg);
          const error = new Error(errorMsg);
          if (isAsyncCall) return Promise.reject(error);
          else throw error;
        }
      }

      if (isAsyncCall) {
        console.warn(
          `Simulating DB execution for ${baseMethodName.toUpperCase()} (async): Returning ${JSON.stringify(simulatedResult)}.`
        );
        return Promise.resolve(simulatedResult as TResult);
      } else {
        console.warn(
          `Simulating DB execution for ${baseMethodName.toUpperCase()} (sync): Returning ${JSON.stringify(simulatedResult)}.`
        );
        return simulatedResult as TResult;
      }
    } else {
      const errorMsg = `Execution simulation not supported for SQL expression type ${finalSqlExpression.type}`;
      const error = new Error(errorMsg);
      if (isAsyncCall) return Promise.reject(error);
      else throw error;
    }
  }

  /**
   * Obtém a representação textual (SQL) da consulta.
   * Realiza a verificação de projeção explícita antes da tradução.
   *
   * @param {LinqExpression} expression A árvore de expressão LINQ.
   * @returns {string} A string SQL gerada.
   * @throws {Error} Se a projeção for implícita ou ocorrer erro na tradução/geração.
   */
  getQueryText(expression: LinqExpression): string {
    this.checkExplicitProjection(expression, "getQueryText");

    try {
      const translator = new QueryExpressionVisitor();
      const sqlExpression = translator.translate(expression);
      const sqlGenerator = new SqlServerQuerySqlGenerator();
      return sqlGenerator.Generate(sqlExpression);
    } catch (e: any) {
      console.error("Error during query translation/generation:", e.message);
      if (e.stack) console.error("Stack:", e.stack);
      console.error("Original LINQ Expression Tree:", expression.toString());
      const error = new Error(`Query Processing Failed during getQueryText: ${e.message}`);
      error.stack = e.stack;
      throw error;
    }
  }
}
