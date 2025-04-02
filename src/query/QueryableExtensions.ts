// --- START OF FILE src/query/QueryableExtensions.ts ---

// src/query/QueryableExtensions.ts

import {
  Expression,
  ExpressionType,
  LambdaExpression,
  MethodCallExpression,
  ScopeExpression,
  ParameterExpression,
  ConstantExpression,
} from "../expressions";
import {
  IQueryable,
  IOrderedQueryable,
  ElementType,
  TInnerJoin,
  TKeyJoin,
  TResultJoin,
  TKey,
  IGrouping,
} from "../interfaces";
import { LambdaParser } from "../parsing";
import { Query } from "./Query";

// --- Declaração de Módulo (Com pares Sync/Async) ---
declare module "../interfaces" {
  interface IQueryable<T> {
    // **** PARES Síncrono/Assíncrono ****
    any(): boolean;
    any(predicate: (entity: T) => boolean): boolean;
    anyAsync(): Promise<boolean>;
    anyAsync(predicate: (entity: T) => boolean): Promise<boolean>;

    count(): number;
    count(predicate: (entity: T) => boolean): number;
    countAsync(): Promise<number>;
    countAsync(predicate: (entity: T) => boolean): Promise<number>;

    avg(selector: (entity: T) => number): number | null;
    avgAsync(selector: (entity: T) => number): Promise<number | null>;

    sum(selector: (entity: T) => number): number | null;
    sumAsync(selector: (entity: T) => number): Promise<number | null>;

    min<TResult extends number | string | Date>(
      selector: (entity: T) => TResult
    ): TResult | null;
    minAsync<TResult extends number | string | Date>(
      selector: (entity: T) => TResult
    ): Promise<TResult | null>;

    max<TResult extends number | string | Date>(
      selector: (entity: T) => TResult
    ): TResult | null;
    maxAsync<TResult extends number | string | Date>(
      selector: (entity: T) => TResult
    ): Promise<TResult | null>;

    first(): T;
    first(predicate?: (entity: T) => boolean): T;
    firstAsync(): Promise<T>;
    firstAsync(predicate?: (entity: T) => boolean): Promise<T>;

    firstOrDefault(): T | null;
    firstOrDefault(predicate?: (entity: T) => boolean): T | null;
    firstOrDefaultAsync(): Promise<T | null>;
    firstOrDefaultAsync(predicate?: (entity: T) => boolean): Promise<T | null>;

    single(): T;
    single(predicate?: (entity: T) => boolean): T;
    singleAsync(): Promise<T>;
    singleAsync(predicate?: (entity: T) => boolean): Promise<T>;

    singleOrDefault(): T | null;
    singleOrDefault(predicate?: (entity: T) => boolean): T | null;
    singleOrDefaultAsync(): Promise<T | null>;
    singleOrDefaultAsync(predicate?: (entity: T) => boolean): Promise<T | null>;

    // toList permanece apenas Async
    toListAsync(): Promise<T[]>;
    // **** FIM PARES ****

    // Métodos não-terminais (inalterados)
    leftJoin<TInnerJoin, TKeyJoin, TResultJoin>(
      inner: IQueryable<TInnerJoin>,
      outerKeySelector: (outer: T) => TKeyJoin,
      innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
      resultSelector: (outer: T, inner: TInnerJoin | null) => TResultJoin
    ): IQueryable<TResultJoin>;
    groupBy<TKey, TResult>(
      keySelector: (entity: T) => TKey,
      resultSelector: (key: TKey, group: IQueryable<T>) => TResult
    ): IQueryable<TResult>;
    union(second: IQueryable<T>): IQueryable<T>;
    concat(second: IQueryable<T>): IQueryable<T>;
    // ... outros métodos não-terminais ...
  }
}
// --- Fim Declaração ---

// Helper findScopeMap (inalterado)
function findScopeMap(
  expression: Expression
): ReadonlyMap<string, Expression> | undefined {
  let current: Expression | null = expression;
  let combinedScope: Map<string, Expression> | null = null;

  while (current) {
    if (current.type === ExpressionType.Scope) {
      const scopeExpr = current as ScopeExpression;
      if (!combinedScope) {
        combinedScope = new Map(scopeExpr.scopeMap);
      } else {
        scopeExpr.scopeMap.forEach((value, key) =>
          combinedScope!.set(key, value)
        );
      }
      current = scopeExpr.sourceExpression;
    } else if (current.type === ExpressionType.Call) {
      current = (current as MethodCallExpression).source;
    } else {
      current = null;
    }
  }
  return combinedScope ?? undefined;
}

// Instância única do parser de lambda
const lambdaParser = new LambdaParser();

// Helper para lidar com resultado síncrono/assíncrono do provider
function handleSyncExecution<TResult>(
  methodName: string,
  result: Promise<TResult> | TResult
): TResult {
  if (result instanceof Promise) {
    console.error(
      `Error: IQueryProvider.execute returned a Promise for synchronous method '${methodName}'. A sync provider or specific handling is required for truly synchronous execution.`
    );
    // Lançar erro é a opção mais segura para indicar a inconsistência.
    throw new Error(
      `Internal Error: Unexpected Promise returned for '${methodName}'.`
    );
  }
  return result;
}

// Implementação de provideScope (inalterada)
Query.prototype.provideScope = function <T>(
  this: IQueryable<T>,
  scope: { [key: string]: IQueryable<any> | any }
): IQueryable<T> {
  const scopeMap = new Map<string, Expression>();
  for (const key in scope) {
    if (Object.prototype.hasOwnProperty.call(scope, key)) {
      const value = scope[key];
      if (
        value &&
        typeof value === "object" &&
        "expression" in value &&
        "provider" in value &&
        value.expression instanceof Expression
      ) {
        const queryable = value as IQueryable<any>;
        if (!queryable.expression)
          throw new Error(`Invalid IQueryable for scope key '${key}'.`);
        scopeMap.set(key, queryable.expression);
      } else {
        scopeMap.set(key, new ConstantExpression(value));
      }
    }
  }
  const scopeExpr = new ScopeExpression(this.expression, scopeMap);
  return this.provider.createQuery<T>(scopeExpr, this.elementType);
};

// Implementação de select (inalterada)
Query.prototype.select = function <T, TResult>(
  this: IQueryable<T>,
  selector: (entity: T) => TResult
): IQueryable<TResult> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  const callExpr = new MethodCallExpression("select", this.expression, [
    lambdaExpr,
  ]);
  const resultElementType = Object as ElementType;
  return this.provider.createQuery<TResult>(callExpr, resultElementType);
};

// Implementação de where (inalterada)
Query.prototype.where = function <T>(
  this: IQueryable<T>,
  predicate: (entity: T) => boolean
): IQueryable<T> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    predicate,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("'where' lambda needs 1 parameter.");
  const callExpr = new MethodCallExpression("where", this.expression, [
    lambdaExpr,
  ]);
  return this.provider.createQuery<T>(callExpr, this.elementType);
};

// Implementação de join (inalterada)
Query.prototype.join = function <TOuter, TInnerJoin, TKeyJoin, TResultJoin>(
  this: IQueryable<TOuter>,
  innerSource: IQueryable<TInnerJoin>,
  outerKeySelector: (outer: TOuter) => TKeyJoin,
  innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
  resultSelector: (outer: TOuter, inner: TInnerJoin) => TResultJoin
): IQueryable<TResultJoin> {
  const currentScopeMap = findScopeMap(this.expression);
  const outerKeyLambda: LambdaExpression = lambdaParser.parse(
    outerKeySelector,
    [],
    currentScopeMap
  );
  const innerKeyLambda: LambdaExpression = lambdaParser.parse(
    innerKeySelector,
    [],
    currentScopeMap
  );
  const resultLambda: LambdaExpression = lambdaParser.parse(
    resultSelector,
    [],
    currentScopeMap
  );
  if (resultLambda.parameters.length !== 2)
    throw new Error("Join result selector lambda needs 2 parameters.");
  const callExpr = new MethodCallExpression("join", this.expression, [
    innerSource.expression,
    outerKeyLambda,
    innerKeyLambda,
    resultLambda,
  ]);
  const resultElementType = Object as ElementType;
  return this.provider.createQuery<TResultJoin>(callExpr, resultElementType);
};

// Implementação de leftJoin (inalterada)
Query.prototype.leftJoin = function <TOuter, TInnerJoin, TKeyJoin, TResultJoin>(
  this: IQueryable<TOuter>,
  innerSource: IQueryable<TInnerJoin>,
  outerKeySelector: (outer: TOuter) => TKeyJoin,
  innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
  resultSelector: (outer: TOuter, inner: TInnerJoin | null) => TResultJoin
): IQueryable<TResultJoin> {
  const currentScopeMap = findScopeMap(this.expression);
  const outerKeyLambda: LambdaExpression = lambdaParser.parse(
    outerKeySelector,
    [],
    currentScopeMap
  );
  const innerKeyLambda: LambdaExpression = lambdaParser.parse(
    innerKeySelector,
    [],
    currentScopeMap
  );
  const resultLambda: LambdaExpression = lambdaParser.parse(
    resultSelector,
    [],
    currentScopeMap
  );
  if (resultLambda.parameters.length !== 2)
    throw new Error("LeftJoin result selector lambda needs 2 parameters.");
  const callExpr = new MethodCallExpression("leftJoin", this.expression, [
    innerSource.expression,
    outerKeyLambda,
    innerKeyLambda,
    resultLambda,
  ]);
  const resultElementType = Object as ElementType;
  return this.provider.createQuery<TResultJoin>(callExpr, resultElementType);
};

// **** Implementação de any (SÍNCRONO) ****
Query.prototype.any = function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): boolean {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    if (lambdaExpr.parameters.length !== 1)
      throw new Error("Any lambda predicate needs 1 parameter.");
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression("any", this.expression, args);
  // Chama execute e lida com o resultado (que deve ser síncrono para any)
  return handleSyncExecution("any", this.provider.execute<boolean>(callExpr));
};

// **** Implementação de anyAsync ****
Query.prototype.anyAsync = async function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): Promise<boolean> {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    if (lambdaExpr.parameters.length !== 1)
      throw new Error("AnyAsync lambda predicate needs 1 parameter.");
    args.push(lambdaExpr);
  }
  // Usa o nome 'any' na expressão, o provider diferencia pelo contexto async
  const callExpr = new MethodCallExpression("any", this.expression, args);
  // Executa assincronamente
  return await this.provider.execute<boolean>(callExpr);
};

// Implementação de orderBy (inalterada)
Query.prototype.orderBy = function <T, TKey>(
  this: IQueryable<T>,
  keySelector: (entity: T) => TKey
): IOrderedQueryable<T> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    keySelector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("'orderBy' lambda needs 1 parameter.");
  const callExpr = new MethodCallExpression("orderBy", this.expression, [
    lambdaExpr,
  ]);
  return this.provider.createQuery<T>(
    callExpr,
    this.elementType
  ) as IOrderedQueryable<T>;
};

// Implementação de orderByDescending (inalterada)
Query.prototype.orderByDescending = function <T, TKey>(
  this: IQueryable<T>,
  keySelector: (entity: T) => TKey
): IOrderedQueryable<T> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    keySelector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("'orderByDescending' lambda needs 1 parameter.");
  const callExpr = new MethodCallExpression(
    "orderByDescending",
    this.expression,
    [lambdaExpr]
  );
  return this.provider.createQuery<T>(
    callExpr,
    this.elementType
  ) as IOrderedQueryable<T>;
};

// Implementação de thenBy (inalterada)
Query.prototype.thenBy = function <T, TKey>(
  this: IOrderedQueryable<T>,
  keySelector: (entity: T) => TKey
): IOrderedQueryable<T> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    keySelector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("'thenBy' lambda needs 1 parameter.");
  const callExpr = new MethodCallExpression("thenBy", this.expression, [
    lambdaExpr,
  ]);
  return this.provider.createQuery<T>(
    callExpr,
    this.elementType
  ) as IOrderedQueryable<T>;
};

// Implementação de thenByDescending (inalterada)
Query.prototype.thenByDescending = function <T, TKey>(
  this: IOrderedQueryable<T>,
  keySelector: (entity: T) => TKey
): IOrderedQueryable<T> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    keySelector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("'thenByDescending' lambda needs 1 parameter.");
  const callExpr = new MethodCallExpression(
    "thenByDescending",
    this.expression,
    [lambdaExpr]
  );
  return this.provider.createQuery<T>(
    callExpr,
    this.elementType
  ) as IOrderedQueryable<T>;
};

// **** Implementação de count (SÍNCRONO) ****
Query.prototype.count = function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): number {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    if (lambdaExpr.parameters.length !== 1)
      throw new Error("Count lambda predicate needs 1 parameter.");
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression("count", this.expression, args);
  return handleSyncExecution("count", this.provider.execute<number>(callExpr));
};

// **** Implementação de countAsync ****
Query.prototype.countAsync = async function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): Promise<number> {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    if (lambdaExpr.parameters.length !== 1)
      throw new Error("CountAsync lambda predicate needs 1 parameter.");
    args.push(lambdaExpr);
  }
  // Usa o nome 'count' na expressão
  const callExpr = new MethodCallExpression("count", this.expression, args);
  return await this.provider.execute<number>(callExpr);
};

// Implementação de skip (inalterada)
Query.prototype.skip = function <T>(
  this: IQueryable<T>,
  count: number
): IQueryable<T> {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error(
      "Argument 'count' for 'skip' must be a non-negative integer."
    );
  }
  const countExpression = new ConstantExpression(count);
  const callExpr = new MethodCallExpression("skip", this.expression, [
    countExpression,
  ]);
  return this.provider.createQuery<T>(callExpr, this.elementType);
};

// Implementação de take (inalterada)
Query.prototype.take = function <T>(
  this: IQueryable<T>,
  count: number
): IQueryable<T> {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error(
      "Argument 'count' for 'take' must be a non-negative integer."
    );
  }
  const countExpression = new ConstantExpression(count);
  const callExpr = new MethodCallExpression("take", this.expression, [
    countExpression,
  ]);
  return this.provider.createQuery<T>(callExpr, this.elementType);
};

// **** Implementação de avg (SÍNCRONO) ****
Query.prototype.avg = function <T>(
  this: IQueryable<T>,
  selector: (entity: T) => number
): number | null {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("Avg lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("avg", this.expression, [
    lambdaExpr,
  ]);
  return handleSyncExecution(
    "avg",
    this.provider.execute<number | null>(callExpr)
  );
};

// **** Implementação de avgAsync ****
Query.prototype.avgAsync = async function <T>(
  this: IQueryable<T>,
  selector: (entity: T) => number
): Promise<number | null> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("AvgAsync lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("avg", this.expression, [
    lambdaExpr,
  ]);
  return await this.provider.execute<number | null>(callExpr);
};

// **** Implementação de sum (SÍNCRONO) ****
Query.prototype.sum = function <T>(
  this: IQueryable<T>,
  selector: (entity: T) => number
): number | null {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("Sum lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("sum", this.expression, [
    lambdaExpr,
  ]);
  return handleSyncExecution(
    "sum",
    this.provider.execute<number | null>(callExpr)
  );
};

// **** Implementação de sumAsync ****
Query.prototype.sumAsync = async function <T>(
  this: IQueryable<T>,
  selector: (entity: T) => number
): Promise<number | null> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("SumAsync lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("sum", this.expression, [
    lambdaExpr,
  ]);
  return await this.provider.execute<number | null>(callExpr);
};

// **** Implementação de min (SÍNCRONO) ****
Query.prototype.min = function <T, TResult extends number | string | Date>(
  this: IQueryable<T>,
  selector: (entity: T) => TResult
): TResult | null {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("Min lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("min", this.expression, [
    lambdaExpr,
  ]);
  return handleSyncExecution(
    "min",
    this.provider.execute<TResult | null>(callExpr)
  );
};

// **** Implementação de minAsync ****
Query.prototype.minAsync = async function <
  T,
  TResult extends number | string | Date
>(
  this: IQueryable<T>,
  selector: (entity: T) => TResult
): Promise<TResult | null> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("MinAsync lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("min", this.expression, [
    lambdaExpr,
  ]);
  return await this.provider.execute<TResult | null>(callExpr);
};

// **** Implementação de max (SÍNCRONO) ****
Query.prototype.max = function <T, TResult extends number | string | Date>(
  this: IQueryable<T>,
  selector: (entity: T) => TResult
): TResult | null {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("Max lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("max", this.expression, [
    lambdaExpr,
  ]);
  return handleSyncExecution(
    "max",
    this.provider.execute<TResult | null>(callExpr)
  );
};

// **** Implementação de maxAsync ****
Query.prototype.maxAsync = async function <
  T,
  TResult extends number | string | Date
>(
  this: IQueryable<T>,
  selector: (entity: T) => TResult
): Promise<TResult | null> {
  const scopeMap = findScopeMap(this.expression);
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [],
    scopeMap
  );
  if (lambdaExpr.parameters.length !== 1)
    throw new Error("MaxAsync lambda selector needs 1 parameter.");
  const callExpr = new MethodCallExpression("max", this.expression, [
    lambdaExpr,
  ]);
  return await this.provider.execute<TResult | null>(callExpr);
};

// Implementação de groupBy (inalterada)
Query.prototype.groupBy = function <T, TKey, TResult>(
  this: IQueryable<T>,
  keySelector: (entity: T) => TKey,
  resultSelector: (key: TKey, group: IQueryable<T>) => TResult
): IQueryable<TResult> {
  const scopeMap = findScopeMap(this.expression);
  const keyLambda: LambdaExpression = lambdaParser.parse(
    keySelector,
    [],
    scopeMap
  );
  if (keyLambda.parameters.length !== 1) {
    throw new Error(
      "'groupBy' keySelector lambda must have exactly one parameter."
    );
  }
  const resultLambda: LambdaExpression = lambdaParser.parse(
    resultSelector,
    [],
    scopeMap
  );
  if (resultLambda.parameters.length !== 2) {
    throw new Error(
      "'groupBy' resultSelector lambda must have exactly two parameters (key, group)."
    );
  }
  const callExpr = new MethodCallExpression("groupBy", this.expression, [
    keyLambda,
    resultLambda,
  ]);
  const resultElementType = Object as ElementType;
  return this.provider.createQuery<TResult>(callExpr, resultElementType);
};

// Implementação de union (inalterada)
Query.prototype.union = function <T>(
  this: IQueryable<T>,
  second: IQueryable<T>
): IQueryable<T> {
  if (!second || !second.expression || !second.provider) {
    throw new Error("Invalid second IQueryable provided for 'union'.");
  }
  const callExpr = new MethodCallExpression("union", this.expression, [
    second.expression,
  ]);
  return this.provider.createQuery<T>(callExpr, this.elementType);
};

// Implementação de concat (inalterada)
Query.prototype.concat = function <T>(
  this: IQueryable<T>,
  second: IQueryable<T>
): IQueryable<T> {
  if (!second || !second.expression || !second.provider) {
    throw new Error("Invalid second IQueryable provided for 'concat'.");
  }
  const callExpr = new MethodCallExpression("concat", this.expression, [
    second.expression,
  ]);
  return this.provider.createQuery<T>(callExpr, this.elementType);
};

// **** IMPLEMENTAÇÕES DE EXECUÇÃO (Sync e Async) ****

// Síncronas
Query.prototype.first = function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): T {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression("first", this.expression, args);
  return handleSyncExecution("first", this.provider.execute<T>(callExpr));
};

Query.prototype.firstOrDefault = function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): T | null {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression(
    "firstOrDefault",
    this.expression,
    args
  );
  return handleSyncExecution(
    "firstOrDefault",
    this.provider.execute<T | null>(callExpr)
  );
};

Query.prototype.single = function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): T {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression("single", this.expression, args);
  return handleSyncExecution("single", this.provider.execute<T>(callExpr));
};

Query.prototype.singleOrDefault = function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): T | null {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression(
    "singleOrDefault",
    this.expression,
    args
  );
  return handleSyncExecution(
    "singleOrDefault",
    this.provider.execute<T | null>(callExpr)
  );
};

// Assíncronas
Query.prototype.toListAsync = async function <T>(
  this: IQueryable<T>
): Promise<T[]> {
  const callExpr = new MethodCallExpression("toList", this.expression, []); // Nome interno pode ser toList
  return await this.provider.execute<T[]>(callExpr);
};

Query.prototype.firstAsync = async function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): Promise<T> {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression("first", this.expression, args); // Nome interno pode ser first
  return await this.provider.execute<T>(callExpr);
};

Query.prototype.firstOrDefaultAsync = async function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): Promise<T | null> {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression(
    "firstOrDefault", // Nome interno
    this.expression,
    args
  );
  return await this.provider.execute<T | null>(callExpr);
};

Query.prototype.singleAsync = async function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): Promise<T> {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression("single", this.expression, args); // Nome interno
  return await this.provider.execute<T>(callExpr);
};

Query.prototype.singleOrDefaultAsync = async function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): Promise<T | null> {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    args.push(lambdaExpr);
  }
  const callExpr = new MethodCallExpression(
    "singleOrDefault", // Nome interno
    this.expression,
    args
  );
  return await this.provider.execute<T | null>(callExpr);
};

// --- END OF FILE src/query/QueryableExtensions.ts ---
