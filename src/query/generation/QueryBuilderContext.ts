// --- START OF FILE src/query/generation/QueryBuilderContext.ts ---

import {
  Expression,
  ParameterExpression,
  ExpressionType,
  MethodCallExpression,
  ScopeExpression,
} from "../../expressions";
import { SourceInfo, SelectClause } from "./types";

export class QueryBuilderContext {
  public sources = new Map<ParameterExpression, SourceInfo>();
  public fromClauseParts: string[] = [];
  public whereClauses: string[] = [];
  public selectClauses: SelectClause[] = [];
  // Correção TS2341: Torna público para acesso no subquery (alternativa seria um método getter/setter)
  public aliasCounter = 0;
  public outerContext?: QueryBuilderContext;

  constructor(outerContext?: QueryBuilderContext, initialAliasCount: number = 0) {
    this.outerContext = outerContext;
    this.aliasCounter = initialAliasCount;
  }

  public getCurrentAliasCount(): number {
    return this.aliasCounter;
  }

  generateNewAlias(): string {
    // A lógica do prefixo pode ser simplificada se não acessarmos mais o counter externo
    const prefix = this.outerContext ? `sub${this.outerContext.getCurrentAliasCount()}_` : ""; // Usa o getter público
    const alias = `${prefix}t${this.aliasCounter++}`;
    return alias;
  }

  getSourceInfo(param: ParameterExpression): SourceInfo | null {
    let currentContext: QueryBuilderContext | undefined = this;
    while (currentContext) {
      const info = currentContext.sources.get(param);
      if (info) {
        return info;
      }
      currentContext = currentContext.outerContext;
    }
    return null; // Não encontrado em nenhum contexto
  }

  getSourceInfoStrict(param: ParameterExpression): SourceInfo {
    const info = this.getSourceInfo(param);
    if (!info) {
      console.error("Context state when error occurred:");
      let ctx: QueryBuilderContext | undefined = this;
      let level = 0;
      while (ctx) {
        console.error(
          `  Context Level ${level} Sources:`,
          Array.from(ctx.sources.keys()).map((p) => p.name)
        );
        ctx = ctx.outerContext;
        level++;
      }
      throw new Error(
        `Internal Error: Could not find source info for parameter '${param.name}'. Ensure it was registered correctly in the current or an outer context.`
      );
    }
    return info;
  }

  registerParameter(parameter: ParameterExpression, sourceInfo: SourceInfo): void {
    if (this.sources.has(parameter)) {
      // Permite re-registrar se for exatamente o mesmo SourceInfo (idempotente)
      if (this.sources.get(parameter) !== sourceInfo) {
        // console.warn(`Context Warn: Parameter '${parameter.name}' is being re-registered with a DIFFERENT SourceInfo in the same context.`);
      }
    }
    this.sources.set(parameter, sourceInfo);
    // Garante que o parâmetro está ligado ao SourceInfo
    if (!sourceInfo.parameters) sourceInfo.parameters = [];
    if (!sourceInfo.parameters.includes(parameter)) {
      sourceInfo.parameters.push(parameter);
    }
  }

  unregisterParameter(parameter: ParameterExpression): void {
    // Apenas remove do mapa do contexto atual. Não afeta outer contexts.
    this.sources.delete(parameter);
    // Nota: Não removemos o parâmetro da lista sourceInfo.parameters aqui,
    // pois o mesmo SourceInfo pode ser referenciado por múltiplos parâmetros
    // em diferentes pontos (embora menos comum). A ligação principal é via mapa.
  }

  // findBaseSourceInfo (Não modificado, mas depende do getSourceInfo correto)
  // findBaseSourceInfo(param: ParameterExpression): SourceInfo | null {
  //   // ... (lógica existente) ...
  //   return null; // Placeholder, a lógica completa não foi mostrada/necessária agora
  // }
}
// --- END OF FILE src/query/generation/QueryBuilderContext.ts ---
