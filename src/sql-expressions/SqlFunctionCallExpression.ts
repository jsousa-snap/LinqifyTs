import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
import { SqlExpressionType } from "./SqlExpressionType";

export interface SqlFunctionCallExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.FunctionCall;
  functionName: string;
  args: SqlExpressionMetadata[];
}

/**
 * Representa uma chamada de função SQL (ex: COUNT(*), UPPER(column), DATEPART(year, date_col)).
 */
export class SqlFunctionCallExpression extends SqlExpression {
  public readonly type = SqlExpressionType.FunctionCall;

  constructor(
    public readonly functionName: string,
    public readonly args: ReadonlyArray<SqlExpression>
  ) {
    super();
    if (!functionName) throw new Error("Function name cannot be empty.");
    if (!args) throw new Error("Function arguments array cannot be null.");
  }

  toString(): string {
    const argsStr = this.args.map((arg) => arg.toString()).join(", ");
    return `${this.functionName}(${argsStr})`;
  }

  toMetadata(): SqlFunctionCallExpressionMetadata {
    return {
      $type: SqlExpressionType.FunctionCall,
      functionName: this.functionName,
      args: this.args.map((arg) => arg.toMetadata()),
    };
  }
}
