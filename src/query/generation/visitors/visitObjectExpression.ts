// --- START OF FILE src/query/generation/visitors/visitObjectExpression.ts ---

import {
  NewObjectExpression,
  LiteralExpression,
  ConstantExpression,
  ExpressionType,
  ParameterExpression,
  Expression,
  MethodCallExpression,
} from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
import { VisitFn } from "../types";
import { generateSqlLiteral } from "../utils/sqlUtils";

// ** FUNÇÃO SIMPLIFICADA **
// Retorna { properties: [...] } onde cada valor DEVE ser um SQL resolvido.
// Lança erro se a visita de uma propriedade não resultar em SQL.
export function visitObjectExpression(
  expression: NewObjectExpression,
  context: QueryBuilderContext,
  visitFn: VisitFn
): { properties: { name: string; valueSql: string }[] } {
  const propertiesResult: { name: string; valueSql: string }[] = [];

  for (const [name, valueExpr] of expression.properties.entries()) {
    // Visita a expressão do valor para obter o SQL correspondente
    const valueResult = visitFn(valueExpr, context);

    // Verifica SE o resultado tem SQL
    if (valueResult?.sql) {
      propertiesResult.push({ name, valueSql: valueResult.sql });
    }
    // Permite literais que podem não ter sido visitados para {sql: ...}
    else if (valueExpr?.type === ExpressionType.Literal) {
      propertiesResult.push({
        name,
        valueSql: generateSqlLiteral((valueExpr as LiteralExpression).value),
      });
    } else if (valueExpr?.type === ExpressionType.Constant && !(valueExpr as ConstantExpression).value?.type) {
      propertiesResult.push({
        name,
        valueSql: generateSqlLiteral((valueExpr as ConstantExpression).value),
      });
    } else {
      // Se a visita não retornou SQL, é um erro neste contexto.
      // A lógica para subqueries (CallExpression) ou expansão de parâmetros
      // deve ser tratada ANTES de chamar este visitor, ou no processamento
      // do seu resultado (como feito em processProjection).
      console.error(
        `visitObjectExpression: Failed to resolve property '${name}' to SQL. Result:`,
        valueResult,
        "Original Expr:",
        valueExpr
      );
      throw new Error(
        `Could not resolve property '${name}' in Object Expression to a SQL value. Expression: ${valueExpr.toString()}`
      );
    }
  }

  return { properties: propertiesResult };
}
// --- END OF FILE src/query/generation/visitors/visitObjectExpression.ts ---
