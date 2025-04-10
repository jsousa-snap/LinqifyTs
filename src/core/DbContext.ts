/* eslint-disable @typescript-eslint/no-explicit-any */
import { DbSet } from "./DbSet";
import { IQueryProvider, ElementType } from "../interfaces";
import { QueryProvider } from "../query/QueryProvider";

interface EntityInfo {
  name: string;
  type: ElementType;
}

export class DbContext {
  private readonly queryProvider: IQueryProvider;
  private readonly entityRegistry: Map<string, EntityInfo> = new Map();

  constructor() {
    this.queryProvider = new QueryProvider();
  }

  registerEntity<T>(name: string, type: { new (...args: any[]): T } | ((...args: any[]) => any)): void {
    this.entityRegistry.set(name.toLowerCase(), {
      name: name,
      type: type as ElementType,
    });
  }

  set<T>(entityName: string): DbSet<T> {
    const entityInfo = this.entityRegistry.get(entityName.toLowerCase());
    const elementType = entityInfo ? entityInfo.type : (Object as ElementType);

    const newDbSet = new DbSet<T>(entityName, this.queryProvider, elementType);
    return newDbSet;
  }
}
