import { BinaryExpression as LinqBinaryExpression, OperatorType as LinqOperatorType } from "../../../../expressions";
import { SqlBinaryExpression, SqlConstantExpression, ColumnExpression } from "../../../../sql-expressions";
import { OperatorType as SqlOperatorType } from "../../../generation/utils/sqlUtils";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";

/**
 * Traduz uma BinaryExpression LINQ para uma SqlBinaryExpression correspondente.
 */
export class BinaryVisitor extends BaseExpressionVisitor<LinqBinaryExpression, SqlBinaryExpression> {
  /** Traduz a BinaryExpression. */
  translate(expression: LinqBinaryExpression): SqlBinaryExpression {
    const leftLinq = expression.left;
    const rightLinq = expression.right;
    const operator = this.mapLinqOpToSqlOp(expression.operator as LinqOperatorType);

    const leftSql = this.visitSubexpression(leftLinq, this.context);
    const rightSql = this.visitSubexpression(rightLinq, this.context);

    if (!leftSql || !rightSql) {
      throw new Error(
        `Falha na tradução dos operandos da expressão binária para o operador ${operator}. Esquerda: ${leftLinq?.toString()}, Direita: ${rightLinq?.toString()}`
      );
    }

    if (leftSql instanceof SqlConstantExpression && rightSql instanceof ColumnExpression) {
      let flippedOp = operator;
      if (operator === SqlOperatorType.LessThan) flippedOp = SqlOperatorType.GreaterThan;
      else if (operator === SqlOperatorType.LessThanOrEqual) flippedOp = SqlOperatorType.GreaterThanOrEqual;
      else if (operator === SqlOperatorType.GreaterThan) flippedOp = SqlOperatorType.LessThan;
      else if (operator === SqlOperatorType.GreaterThanOrEqual) flippedOp = SqlOperatorType.LessThanOrEqual;

      if (flippedOp !== operator) {
        return new SqlBinaryExpression(rightSql, flippedOp, leftSql);
      }
    }
    return new SqlBinaryExpression(leftSql, operator, rightSql);
  }

  /** Mapeia operadores LINQ para operadores SQL. */
  private mapLinqOpToSqlOp(linqOp: LinqOperatorType): SqlOperatorType {
    switch (linqOp) {
      case LinqOperatorType.Add:
        return SqlOperatorType.Add;
      case LinqOperatorType.Subtract:
        return SqlOperatorType.Subtract;
      case LinqOperatorType.Multiply:
        return SqlOperatorType.Multiply;
      case LinqOperatorType.Divide:
        return SqlOperatorType.Divide;
      case LinqOperatorType.Modulo:
        return SqlOperatorType.Modulo;
      case LinqOperatorType.Equal:
        return SqlOperatorType.Equal;
      case LinqOperatorType.NotEqual:
        return SqlOperatorType.NotEqual;
      case LinqOperatorType.GreaterThan:
        return SqlOperatorType.GreaterThan;
      case LinqOperatorType.GreaterThanOrEqual:
        return SqlOperatorType.GreaterThanOrEqual;
      case LinqOperatorType.LessThan:
        return SqlOperatorType.LessThan;
      case LinqOperatorType.LessThanOrEqual:
        return SqlOperatorType.LessThanOrEqual;
      case LinqOperatorType.And:
        return SqlOperatorType.And;
      case LinqOperatorType.Or:
        return SqlOperatorType.Or;
      default: {
        const exhaustiveCheck: never = linqOp;
        throw new Error(`Operador LINQ não mapeado para SQL: ${exhaustiveCheck}`);
      }
    }
  }
}
