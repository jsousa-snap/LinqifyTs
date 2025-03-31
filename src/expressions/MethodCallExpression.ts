import { Expression, ExpressionType } from "./Expression";

export class MethodCallExpression extends Expression {
  readonly type = ExpressionType.Call;
  constructor(
    // Opcional: Poderia referenciar o método exato (ex: MethodInfo)
    // Por simplicidade, vamos usar o nome e assumir que o provider sabe o que fazer
    public readonly methodName: string,
    public readonly source: Expression | null, // A expressão fonte (ex: a expression do IQueryable anterior), null para métodos estáticos
    public readonly args: ReadonlyArray<Expression> // Argumentos (ex: a LambdaExpression para select/where)
  ) {
    super();
  }
  toString(): string {
    const argsStr = this.args.map((a) => a.toString()).join(", ");
    if (this.source) {
      return `${this.source.toString()}.${this.methodName}(${argsStr})`;
    }
    return `${this.methodName}(${argsStr})`; // Para chamadas estáticas (menos comum em LINQ to Entities)
  }
}
