// --- START OF FILE src/query/Query.ts ---

// src/query/Query.ts

import { Expression } from "../expressions";
import {
  IQueryable,
  IOrderedQueryable,
  IQueryProvider,
  ElementType,
  TInnerJoin,
  TKeyJoin,
  TResultJoin,
  TResultSelect,
  TKey,
  IGrouping,
} from "../interfaces";

/**
 * Implementação base da interface IOrderedQueryable<T>.
 * Representa uma consulta construída que pode ser posteriormente modificada
 * ou executada pelo IQueryProvider.
 *
 * @export
 * @class Query
 * @template T O tipo dos elementos retornados pela consulta.
 * @implements {IOrderedQueryable<T>}
 */
export class Query<T> implements IOrderedQueryable<T> {
  // Já implementa a interface correta
  constructor(
    public readonly expression: Expression,
    public readonly provider: IQueryProvider,
    public readonly elementType: ElementType
  ) {
    if (!expression) throw new Error("Expression cannot be null.");
    if (!provider) throw new Error("Provider cannot be null.");
    if (!elementType) throw new Error("ElementType cannot be null.");
  }

  /**
   * Obtém a representação textual (ex: SQL) da consulta atual.
   * Delega a chamada para o IQueryProvider.
   *
   * @returns {string} A string da consulta gerada.
   * @memberof Query
   */
  toQueryString(): string {
    return this.provider.getQueryText(this.expression);
  }

  // --- Declarações Placeholder (Implementadas em QueryableExtensions) ---

  select<TResultSelect>(
    selector: (entity: T) => TResultSelect
  ): IQueryable<TResultSelect> {
    console.error("Base Query.select declaration should not be executed.");
    throw new Error("Base Query.select declaration should not be executed.");
  }
  where(predicate: (entity: T) => boolean): IQueryable<T> {
    console.error("Base Query.where declaration should not be executed.");
    throw new Error("Base Query.where declaration should not be executed.");
  }
  join<TInnerJoin, TKeyJoin, TResultJoin>(
    inner: IQueryable<TInnerJoin>,
    outerKeySelector: (outer: T) => TKeyJoin,
    innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
    resultSelector: (outer: T, inner: TInnerJoin) => TResultJoin
  ): IQueryable<TResultJoin> {
    console.error("Base Query.join declaration should not be executed.");
    throw new Error("Base Query.join declaration should not be executed.");
  }
  leftJoin<TInnerJoin, TKeyJoin, TResultJoin>(
    inner: IQueryable<TInnerJoin>,
    outerKeySelector: (outer: T) => TKeyJoin,
    innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
    resultSelector: (outer: T, inner: TInnerJoin | null) => TResultJoin
  ): IQueryable<TResultJoin> {
    console.error("Base Query.leftJoin declaration should not be executed.");
    throw new Error("Base Query.leftJoin declaration should not be executed.");
  }
  provideScope(scope: { [key: string]: IQueryable<any> | any }): IQueryable<T> {
    console.error(
      "Base Query.provideScope declaration should not be executed."
    );
    throw new Error(
      "Base Query.provideScope declaration should not be executed."
    );
  }
  any(predicate?: (entity: T) => boolean): boolean {
    console.error("Base Query.any declaration should not be executed.");
    throw new Error("Base Query.any declaration should not be executed.");
  }
  async anyAsync(predicate?: (entity: T) => boolean): Promise<boolean> {
    console.error("Base Query.anyAsync declaration should not be executed.");
    throw new Error("Base Query.anyAsync declaration should not be executed.");
  }
  orderBy<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T> {
    console.error("Base Query.orderBy declaration should not be executed.");
    throw new Error("Base Query.orderBy declaration should not be executed.");
  }
  orderByDescending<TKey>(
    keySelector: (entity: T) => TKey
  ): IOrderedQueryable<T> {
    console.error(
      "Base Query.orderByDescending declaration should not be executed."
    );
    throw new Error(
      "Base Query.orderByDescending declaration should not be executed."
    );
  }
  thenBy<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T> {
    console.error("Base Query.thenBy declaration should not be executed.");
    throw new Error("Base Query.thenBy declaration should not be executed.");
  }
  thenByDescending<TKey>(
    keySelector: (entity: T) => TKey
  ): IOrderedQueryable<T> {
    console.error(
      "Base Query.thenByDescending declaration should not be executed."
    );
    throw new Error(
      "Base Query.thenByDescending declaration should not be executed."
    );
  }
  count(predicate?: (entity: T) => boolean): number {
    console.error("Base Query.count declaration should not be executed.");
    throw new Error("Base Query.count declaration should not be executed.");
  }
  async countAsync(predicate?: (entity: T) => boolean): Promise<number> {
    console.error("Base Query.countAsync declaration should not be executed.");
    throw new Error(
      "Base Query.countAsync declaration should not be executed."
    );
  }
  skip(count: number): IQueryable<T> {
    console.error("Base Query.skip declaration should not be executed.");
    throw new Error("Base Query.skip declaration should not be executed.");
  }
  take(count: number): IQueryable<T> {
    console.error("Base Query.take declaration should not be executed.");
    throw new Error("Base Query.take declaration should not be executed.");
  }
  avg(selector: (entity: T) => number): number | null {
    console.error("Base Query.avg declaration should not be executed.");
    throw new Error("Base Query.avg declaration should not be executed.");
  }
  async avgAsync(selector: (entity: T) => number): Promise<number | null> {
    console.error("Base Query.avgAsync declaration should not be executed.");
    throw new Error("Base Query.avgAsync declaration should not be executed.");
  }
  sum(selector: (entity: T) => number): number | null {
    console.error("Base Query.sum declaration should not be executed.");
    throw new Error("Base Query.sum declaration should not be executed.");
  }
  async sumAsync(selector: (entity: T) => number): Promise<number | null> {
    console.error("Base Query.sumAsync declaration should not be executed.");
    throw new Error("Base Query.sumAsync declaration should not be executed.");
  }
  min<TResult extends number | string | Date>(
    selector: (entity: T) => TResult
  ): TResult | null {
    console.error("Base Query.min declaration should not be executed.");
    throw new Error("Base Query.min declaration should not be executed.");
  }
  async minAsync<TResult extends number | string | Date>(
    selector: (entity: T) => TResult
  ): Promise<TResult | null> {
    console.error("Base Query.minAsync declaration should not be executed.");
    throw new Error("Base Query.minAsync declaration should not be executed.");
  }
  max<TResult extends number | string | Date>(
    selector: (entity: T) => TResult
  ): TResult | null {
    console.error("Base Query.max declaration should not be executed.");
    throw new Error("Base Query.max declaration should not be executed.");
  }
  async maxAsync<TResult extends number | string | Date>(
    selector: (entity: T) => TResult
  ): Promise<TResult | null> {
    console.error("Base Query.maxAsync declaration should not be executed.");
    throw new Error("Base Query.maxAsync declaration should not be executed.");
  }
  groupBy<TKey, TResult>(
    keySelector: (entity: T) => TKey,
    resultSelector: (key: TKey, group: IQueryable<T>) => TResult
  ): IQueryable<TResult> {
    console.error("Base Query.groupBy declaration should not be executed.");
    throw new Error("Base Query.groupBy declaration should not be executed.");
  }
  union(second: IQueryable<T>): IQueryable<T> {
    console.error("Base Query.union declaration should not be executed.");
    throw new Error("Base Query.union declaration should not be executed.");
  }
  concat(second: IQueryable<T>): IQueryable<T> {
    console.error("Base Query.concat declaration should not be executed.");
    throw new Error("Base Query.concat declaration should not be executed.");
  }

  async toListAsync(): Promise<T[]> {
    console.error("Base Query.toListAsync declaration should not be executed.");
    throw new Error(
      "Base Query.toListAsync declaration should not be executed."
    );
  }
  first(predicate?: (entity: T) => boolean): T {
    console.error("Base Query.first declaration should not be executed.");
    throw new Error("Base Query.first declaration should not be executed.");
  }
  async firstAsync(predicate?: (entity: T) => boolean): Promise<T> {
    console.error("Base Query.firstAsync declaration should not be executed.");
    throw new Error(
      "Base Query.firstAsync declaration should not be executed."
    );
  }
  firstOrDefault(predicate?: (entity: T) => boolean): T | null {
    console.error(
      "Base Query.firstOrDefault declaration should not be executed."
    );
    throw new Error(
      "Base Query.firstOrDefault declaration should not be executed."
    );
  }
  async firstOrDefaultAsync(
    predicate?: (entity: T) => boolean
  ): Promise<T | null> {
    console.error(
      "Base Query.firstOrDefaultAsync declaration should not be executed."
    );
    throw new Error(
      "Base Query.firstOrDefaultAsync declaration should not be executed."
    );
  }
  single(predicate?: (entity: T) => boolean): T {
    console.error("Base Query.single declaration should not be executed.");
    throw new Error("Base Query.single declaration should not be executed.");
  }
  async singleAsync(predicate?: (entity: T) => boolean): Promise<T> {
    console.error("Base Query.singleAsync declaration should not be executed.");
    throw new Error(
      "Base Query.singleAsync declaration should not be executed."
    );
  }
  singleOrDefault(predicate?: (entity: T) => boolean): T | null {
    console.error(
      "Base Query.singleOrDefault declaration should not be executed."
    );
    throw new Error(
      "Base Query.singleOrDefault declaration should not be executed."
    );
  }
  async singleOrDefaultAsync(
    predicate?: (entity: T) => boolean
  ): Promise<T | null> {
    console.error(
      "Base Query.singleOrDefaultAsync declaration should not be executed."
    );
    throw new Error(
      "Base Query.singleOrDefaultAsync declaration should not be executed."
    );
  }
}
// --- END OF FILE src/query/Query.ts ---
