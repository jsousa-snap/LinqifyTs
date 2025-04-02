// --- START OF FILE src/query/QueryProvider.ts ---

// src/query/QueryProvider.ts

import {
  Expression as LinqExpression,
  MethodCallExpression as LinqMethodCallExpression,
} from "../expressions";
import { IQueryable, IQueryProvider, ElementType } from "../interfaces";
import { Query } from "./Query";
import { QueryExpressionVisitor } from "./translation/QueryExpressionVisitor";
import {
  SqlExpression,
  SelectExpression,
  SqlExistsExpression,
  SqlExpressionType,
  SqlFunctionCallExpression,
} from "../sql-expressions";
import { SqlServerQuerySqlGenerator } from "./generation/SqlServerQuerySqlGenerator";

export class QueryProvider implements IQueryProvider {
  constructor() {}

  createQuery<TElement>(
    expression: LinqExpression,
    elementType: ElementType
  ): IQueryable<TElement> {
    return new Query<TElement>(expression, this, elementType);
  }

  // **** EXECUTE PODE SER SYNC OU ASYNC ****
  execute<TResult>(expression: LinqExpression): Promise<TResult> | TResult {
    const translator = new QueryExpressionVisitor();
    const sqlGenerator = new SqlServerQuerySqlGenerator();

    const finalSqlExpression = translator.translate(expression);
    const sql = sqlGenerator.Generate(finalSqlExpression);

    console.log("--- Executing SQL (Simulation) ---");
    console.log(sql);
    console.log("----------------------------------");

    // Determina se a chamada original foi Async
    const isAsyncCall =
      expression instanceof LinqMethodCallExpression &&
      expression.methodName.endsWith("Async");
    // Obtém o nome base do método (sem Async)
    const baseMethodName =
      expression instanceof LinqMethodCallExpression
        ? expression.methodName.replace(/Async$/, "")
        : "unknown";

    // ---- Simulação ----

    // Tratamento especial para 'any' (SEMPRE SÍNCRONO)
    if (baseMethodName === "any") {
      console.warn(
        "Simulating DB execution for ANY (synchronous): Returning TRUE."
      );
      return true as TResult;
    }

    // Tratamento para 'toListAsync' (SEMPRE ASSÍNCRONO)
    if (baseMethodName === "toList") {
      // Note: a expressão LINQ pode ser só 'toList'
      console.warn(
        "Simulating DB execution for toListAsync: Returning mocked array."
      );
      return Promise.resolve([
        { id: 1, name: "Mock 1" },
        { id: 2, name: "Mock 2" },
      ] as unknown as TResult);
    }

    // Simulação para outros métodos terminais
    if (finalSqlExpression.type === SqlExpressionType.Exists) {
      // Deve ser tratado pelo 'any' acima
      console.error("Execution reached SqlExistsExpression unexpectedly.");
      if (isAsyncCall) return Promise.resolve(true as TResult);
      else return true as TResult; // Inconsistente, mas segue o fluxo
    } else if (finalSqlExpression.type === SqlExpressionType.Select) {
      const selectExpr = finalSqlExpression as SelectExpression;

      // Simulação para agregações e seleções de item único/primeiro
      let simulatedResult: any = null; // Valor padrão

      // Verifica se o SQL indica conjunto vazio (simplificação)
      const isSimulatedEmpty =
        sql.includes("WHERE 1 = 0") || sql.includes("WHERE 0");

      switch (baseMethodName) {
        case "count":
          simulatedResult = 10;
          break;
        case "avg":
          simulatedResult = isSimulatedEmpty ? null : 42.5;
          break;
        case "sum":
          simulatedResult = 1234; // Ou null se vazio? Depende da definição
          break;
        case "min":
          simulatedResult = isSimulatedEmpty ? null : 1; // Exemplo para número
          break;
        case "max":
          simulatedResult = isSimulatedEmpty ? null : 99; // Exemplo para número
          break;
        case "first":
          if (isSimulatedEmpty)
            throw new Error(
              "Simulation: Sequence contains no elements (for First)."
            );
          simulatedResult = { id: 1, name: "Mock First" };
          break;
        case "firstOrDefault":
          simulatedResult = isSimulatedEmpty
            ? null
            : { id: 1, name: "Mock FirstOrDefault" };
          break;
        case "single":
          // Simulação simplificada, não verifica unicidade
          if (isSimulatedEmpty)
            throw new Error(
              "Simulation: Sequence contains no elements (for Single)."
            );
          simulatedResult = { id: 5, name: "Mock Single" };
          break;
        case "singleOrDefault":
          // Simulação simplificada, não verifica unicidade > 1
          simulatedResult = isSimulatedEmpty
            ? null
            : { id: 5, name: "Mock SingleOrDefault" };
          break;
        default:
          // Se não for um método terminal conhecido que retorna valor único
          const originalMethod =
            (expression as LinqMethodCallExpression)?.methodName ?? "unknown";
          console.error(
            `Simulation not handled for method '${originalMethod}' resulting in standard SELECT.`
          );
          // Retorna erro para async, ou lança para sync
          const error = new Error(
            `Simulation not handled for method '${originalMethod}'.`
          );
          if (isAsyncCall) return Promise.reject(error);
          else throw error;
      }

      // Retorna Promise para chamadas Async, valor direto para síncronas
      if (isAsyncCall) {
        console.warn(
          `Simulating DB execution for ${baseMethodName.toUpperCase()} (async): Returning ${JSON.stringify(
            simulatedResult
          )}.`
        );
        return Promise.resolve(simulatedResult as TResult);
      } else {
        // Não deveria chegar aqui para métodos que só têm versão Async (toList)
        console.warn(
          `Simulating DB execution for ${baseMethodName.toUpperCase()} (sync): Returning ${JSON.stringify(
            simulatedResult
          )}.`
        );
        return simulatedResult as TResult;
      }
    } else {
      // Tipo SQL final inesperado
      const error = new Error(
        `Execution simulation not supported for SQL expression type ${finalSqlExpression.type}`
      );
      if (isAsyncCall) return Promise.reject(error);
      else throw error;
    }
  }

  // getQueryText (Inalterado)
  getQueryText(expression: LinqExpression): string {
    try {
      const translator = new QueryExpressionVisitor();
      const sqlExpression = translator.translate(expression);
      const sqlGenerator = new SqlServerQuerySqlGenerator();
      return sqlGenerator.Generate(sqlExpression);
    } catch (e: any) {
      console.error("Error during query translation/generation:", e.message);
      if (e.stack) console.error("Stack:", e.stack);
      console.error("Original LINQ Expression Tree:", expression.toString());
      const error = new Error(`Query Processing Failed: ${e.message}`);
      error.stack = e.stack;
      throw error;
    }
  }
}
// --- END OF FILE src/query/QueryProvider.ts ---
