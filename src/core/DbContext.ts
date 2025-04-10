// --- START OF FILE core/DbContext.ts ---

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
  // **** REGISTRO REMOVIDO DAQUI ****
  // private readonly dbSetRegistry: Map<string, DbSet<any>> = new Map();

  constructor() {
    // **** QueryProvider NÃO recebe mais o registro ****
    this.queryProvider = new QueryProvider();
  }

  registerEntity<T>(name: string, type: { new (...args: any[]): T } | Function): void {
    this.entityRegistry.set(name.toLowerCase(), {
      name: name,
      type: type as ElementType,
    });
  }

  // **** Set NÃO precisa mais registrar ****
  set<T>(entityName: string): DbSet<T> {
    const entityInfo = this.entityRegistry.get(entityName.toLowerCase());
    const elementType = entityInfo ? entityInfo.type : (Object as ElementType);

    const newDbSet = new DbSet<T>(entityName, this.queryProvider, elementType);
    // Não há mais registro central aqui
    return newDbSet;
  }
}
// --- END OF FILE core/DbContext.ts ---
