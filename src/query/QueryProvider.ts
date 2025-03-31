// --- START OF FILE src/query/QueryProvider.ts ---

// src/query/QueryProvider.ts

import { Expression as LinqExpression } from "../expressions";
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

  // execute (Atualizado para simular mais agregações)
  execute<TResult>(expression: LinqExpression): TResult {
    const translator = new QueryExpressionVisitor();
    const sqlGenerator = new SqlServerQuerySqlGenerator();

    // Traduz LINQ para SQL
    const finalSqlExpression = translator.translate(expression);
    const sql = sqlGenerator.Generate(finalSqlExpression);

    console.log("--- Executing SQL (Simulation) ---");
    console.log(sql);
    console.log("----------------------------------");

    // Simula a execução baseada no tipo de expressão SQL final
    if (finalSqlExpression.type === SqlExpressionType.Exists) {
      console.warn("Simulating DB execution for EXISTS: Returning TRUE.");
      return true as TResult;
    } else if (finalSqlExpression.type === SqlExpressionType.Select) {
      const selectExpr = finalSqlExpression as SelectExpression;

      // Verifica se é uma projeção de agregação (COUNT, AVG, SUM, MIN, MAX)
      if (
        selectExpr.projection.length === 1 &&
        selectExpr.projection[0].expression.type ===
          SqlExpressionType.FunctionCall
      ) {
        const funcCall = selectExpr.projection[0]
          .expression as SqlFunctionCallExpression;
        const funcName = funcCall.functionName.toUpperCase();

        switch (funcName) {
          case "COUNT_BIG":
          case "COUNT":
            console.warn("Simulating DB execution for COUNT: Returning 10.");
            return 10 as TResult; // Simula retorno para Count
          case "AVG":
            console.warn("Simulating DB execution for AVG: Returning 42.5.");
            return 42.5 as TResult; // Simula retorno para Avg
          case "SUM":
            console.warn("Simulating DB execution for SUM: Returning 1234.");
            return 1234 as TResult; // Simula retorno para Sum
          case "MIN":
            console.warn("Simulating DB execution for MIN: Returning 1.");
            // Poderia retornar string ou Date dependendo do selector, mas simplificamos
            return 1 as TResult; // Simula retorno para Min
          case "MAX":
            console.warn("Simulating DB execution for MAX: Returning 99.");
            return 99 as TResult; // Simula retorno para Max
          default:
            // Se for outra função não reconhecida como agregação terminal
            console.error(
              `Database execution simulation not implemented for SELECT with function: ${funcName}`
            );
            throw new Error(
              `Query execution simulation for SELECT with function ${funcName} not implemented.`
            );
        }
      } else {
        // Se for um SELECT normal (não agregação terminal)
        console.error(
          `Database execution simulation not implemented for non-aggregate SELECT.`
        );
        throw new Error(
          "Query execution simulation for result sets or single objects not implemented yet."
        );
      }
    } else {
      // Tipo de expressão SQL não suportado para execução direta
      console.error(
        `Cannot simulate execution for SQL expression type: ${finalSqlExpression.type}`
      );
      throw new Error(
        `Execution simulation not supported for SQL expression type ${finalSqlExpression.type}`
      );
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
