// --- START OF FILE core/DbSet.ts ---

import { Expression, ConstantExpression } from "../expressions";
import { IQueryable, IQueryProvider, ElementType } from "../interfaces";
import { Query } from "../query/Query";

// **** REMOVER implements IQueryable<T> TEMPORARIAMENTE ****
export class DbSet<T> extends Query<T> /* implements IQueryable<T> */ {
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

  // Herda os métodos select, where, join, provideScope de Query<T>
}
// --- END OF FILE core/DbSet.ts ---
