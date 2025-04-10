import { ConstantExpression } from "../expressions";
import { IQueryProvider, ElementType } from "../interfaces";
import { Query } from "../query/Query";

export class DbSet<T> extends Query<T> {
  constructor(
    public readonly entityName: string,
    provider: IQueryProvider,
    elementType: ElementType
  ) {
    const initialExpression = new ConstantExpression({
      type: "Table",
      name: entityName,
    });
    super(initialExpression, provider, elementType);
  }
}
