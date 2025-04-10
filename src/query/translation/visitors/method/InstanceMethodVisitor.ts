import { MethodCallExpression as LinqMethodCallExpression } from "../../../../expressions";
import {
  SqlExpression,
  SqlFunctionCallExpression,
  SqlConstantExpression,
  SqlLikeExpression,
  SqlBinaryExpression,
} from "../../../../sql-expressions";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";
import { OperatorType } from "../../../generation/utils/sqlUtils";

/**
 * Traduz chamadas de método de instância comuns (string, data) para funções SQL.
 */
export class InstanceMethodVisitor extends BaseExpressionVisitor<LinqMethodCallExpression, SqlExpression> {
  /** Traduz a chamada de método de instância. */
  translate(expression: LinqMethodCallExpression): SqlExpression {
    if (expression.methodName === "includes") {
      throw new Error("InstanceMethodVisitor não deve ser chamado para 'includes'. Use IncludesVisitor.");
    }
    if (!expression.source) {
      throw new Error(`Método de instância '${expression.methodName}' requer uma fonte.`);
    }

    const sourceSql = this.visitSubexpression(expression.source, this.context);
    if (!sourceSql) {
      throw new Error(
        `Não foi possível traduzir a fonte para '${expression.methodName}'. Fonte: ${expression.source.toString()}`
      );
    }

    switch (expression.methodName) {
      // --- Métodos de String ---
      case "toUpperCase": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("UPPER", [sourceSql]);
      }
      case "toLowerCase": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("LOWER", [sourceSql]);
      }
      case "trim": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("TRIM", [sourceSql]);
      }
      case "startsWith":
      case "endsWith": {
        this.validateArgumentCount(expression, 1);
        const patternArgSql = this.visitSubexpression(expression.args[0], this.context);
        if (!(patternArgSql instanceof SqlConstantExpression) || typeof patternArgSql.value !== "string") {
          throw new Error(`'${expression.methodName}' atualmente suporta apenas argumentos string constantes.`);
        }
        const patternValue = patternArgSql.value;
        const escapedPattern = patternValue.replace(/\[/g, "[[]").replace(/%/g, "[%]").replace(/_/g, "[_]");
        const likePattern = expression.methodName === "startsWith" ? `${escapedPattern}%` : `%${escapedPattern}`;
        return new SqlLikeExpression(sourceSql, new SqlConstantExpression(likePattern));
      }
      case "substring": {
        if (expression.args.length < 1 || expression.args.length > 2) {
          throw new Error("'substring' requer 1 ou 2 argumentos (startIndex, [length]).");
        }
        const startArgSql = this.visitSubexpression(expression.args[0], this.context);
        if (
          !(startArgSql instanceof SqlConstantExpression) ||
          typeof startArgSql.value !== "number" ||
          !Number.isInteger(startArgSql.value) ||
          startArgSql.value < 0
        ) {
          throw new Error("'substring' startIndex deve ser um número inteiro constante não negativo.");
        }
        const sqlStart = new SqlConstantExpression(startArgSql.value + 1); // JS 0-based -> SQL 1-based

        let lengthArgSql: SqlExpression;
        if (expression.args.length === 2) {
          const lenArg = this.visitSubexpression(expression.args[1], this.context);
          if (
            !(lenArg instanceof SqlConstantExpression) ||
            typeof lenArg.value !== "number" ||
            !Number.isInteger(lenArg.value) ||
            lenArg.value < 0
          ) {
            throw new Error(
              "'substring' length (segundo argumento) deve ser um número inteiro constante não negativo."
            );
          }
          lengthArgSql = lenArg;
        } else {
          lengthArgSql = new SqlConstantExpression(8000); // Aproximação para "até o fim"
        }
        return new SqlFunctionCallExpression("SUBSTRING", [sourceSql, sqlStart, lengthArgSql]);
      }

      // --- Métodos de Data/Hora ---
      case "getFullYear": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("YEAR", [sourceSql]);
      }
      case "getMonth": {
        this.validateArgumentCount(expression, 0);
        const monthSql = new SqlFunctionCallExpression("MONTH", [sourceSql]);
        // Ajusta de 1-based (SQL) para 0-based (JS)
        return new SqlBinaryExpression(monthSql, OperatorType.Subtract, new SqlConstantExpression(1));
      }
      case "getDate": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("DAY", [sourceSql]);
      }
      case "getHours": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("DATEPART", [new SqlConstantExpression("hour"), sourceSql]);
      }
      case "getMinutes": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("DATEPART", [new SqlConstantExpression("minute"), sourceSql]);
      }
      case "getSeconds": {
        this.validateArgumentCount(expression, 0);
        return new SqlFunctionCallExpression("DATEPART", [new SqlConstantExpression("second"), sourceSql]);
      }

      default: {
        throw new Error(`Método de instância não suportado ou não reconhecido: ${expression.methodName}`);
      }
    }
  }

  /** Valida o número esperado de argumentos. */
  private validateArgumentCount(expression: LinqMethodCallExpression, expectedCount: number): void {
    if (expression.args.length !== expectedCount) {
      throw new Error(
        `Método '${expression.methodName}' esperava ${expectedCount} argumento(s), mas recebeu ${expression.args.length}.`
      );
    }
  }
}
