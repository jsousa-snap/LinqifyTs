// --- START OF FILE src/query/generation/visitors/visitBinaryExpression.ts ---

import { BinaryExpression, ExpressionType, MemberExpression } from "../../../expressions";
import { QueryBuilderContext } from "../QueryBuilderContext";
import { VisitFn, SqlResult } from "../types";
import { generateSqlLiteral, mapOperatorToSql } from "../utils/sqlUtils";
// Importar visitMember explicitamente se necessário resolver aqui (idealmente não)
// import { visitMember } from "./visitMember"; // Evitar se possível, depender do visitFn

export function visitBinaryExpression(
  expression: BinaryExpression,
  context: QueryBuilderContext,
  visitFn: VisitFn // Passa a função principal para recursão
): SqlResult {
  const leftResult = visitFn(expression.left, context);
  const rightResult = visitFn(expression.right, context);
  const opSql = mapOperatorToSql(expression.operator);

  // Refatorado getSql para usar generateSqlLiteral diretamente
  const getSql = (r: any, originalExpr: Expression): string | null => {
    if (r?.sql) return r.sql;
    if (originalExpr?.type === ExpressionType.Literal)
      return generateSqlLiteral((originalExpr as LiteralExpression).value);
    if (originalExpr?.type === ExpressionType.Constant) {
      const cVal = (originalExpr as ConstantExpression).value;
      if (!(cVal && typeof cVal === "object" && (cVal.type === "Table" || cVal.type === "External"))) {
        return generateSqlLiteral(cVal);
      }
    }
    // A lógica original tentava resolver MemberExpression aqui,
    // mas é melhor que o visitFn já tenha resolvido ou retornado {sql: ...}
    // Se r for uma MemberExpression não resolvida, o visitFn falhou em resolvê-la.
    if (r?.type === ExpressionType.MemberAccess) {
      // Tentar resolver de novo pode causar loops ou esconder erros.
      // Se chegou aqui como MemberExpression, provavelmente é um erro anterior.
      console.warn(
        `visitBinaryExpression: Received unresolved MemberExpression: ${r.toString()}. This might indicate an issue.`
      );
      // Poderia tentar chamar visitMember aqui, mas é arriscado:
      // const resolvedMember = visitMember(r as MemberExpression, context, visitFn);
      // if (resolvedMember?.sql) return resolvedMember.sql;
    }

    return null;
  };

  // Passar a expressão original para getSql
  const leftSql = getSql(leftResult, expression.left);
  const rightSql = getSql(rightResult, expression.right);

  if (leftSql !== null && rightSql !== null) {
    const finalSql = `(${leftSql} ${opSql} ${rightSql})`;
    return { sql: finalSql };
  } else {
    console.error("Binary Op Details:");
    console.error(" Left Expr:", expression.left.toString(), "-> Result:", leftResult, "-> SQL:", leftSql);
    console.error(" Right Expr:", expression.right.toString(), "-> Result:", rightResult, "-> SQL:", rightSql);
    console.error(" Operator:", opSql);
    throw new Error(
      `Failed to generate SQL for one or both operands of the binary expression: ${expression.toString()}.`
    );
  }
}

// Importações necessárias para tipos usados no getSql
import { LiteralExpression, ConstantExpression, Expression } from "../../../expressions";

// --- END OF FILE src/query/generation/visitors/visitBinaryExpression.ts ---
