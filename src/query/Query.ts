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
  // Estes métodos lançam erro se chamados diretamente, pois a implementação
  // real é adicionada ao protótipo por QueryableExtensions.

  select<TResultSelect>(
    selector: (entity: T) => TResultSelect
  ): IQueryable<TResultSelect> {
    console.error(
      "Error: Calling Query.select base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.select declaration should not be executed.");
  }
  where(predicate: (entity: T) => boolean): IQueryable<T> {
    console.error(
      "Error: Calling Query.where base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.where declaration should not be executed.");
  }
  join<TInnerJoin, TKeyJoin, TResultJoin>(
    inner: IQueryable<TInnerJoin>,
    outerKeySelector: (outer: T) => TKeyJoin,
    innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
    resultSelector: (outer: T, inner: TInnerJoin) => TResultJoin
  ): IQueryable<TResultJoin> {
    console.error(
      "Error: Calling Query.join base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.join declaration should not be executed.");
  }
  // **** NOVO Placeholder: leftJoin ****
  leftJoin<TInnerJoin, TKeyJoin, TResultJoin>(
    inner: IQueryable<TInnerJoin>,
    outerKeySelector: (outer: T) => TKeyJoin,
    innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
    resultSelector: (outer: T, inner: TInnerJoin | null) => TResultJoin
  ): IQueryable<TResultJoin> {
    console.error(
      "Error: Calling Query.leftJoin base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.leftJoin declaration should not be executed.");
  }
  // **** FIM Placeholder ****
  provideScope(scope: { [key: string]: IQueryable<any> | any }): IQueryable<T> {
    console.error(
      "Error: Calling Query.provideScope base declaration. Check QueryableExtensions."
    );
    throw new Error(
      "Base Query.provideScope declaration should not be executed."
    );
  }
  exists(predicate?: (entity: T) => boolean): boolean {
    console.error(
      "Error: Calling Query.exists base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.exists declaration should not be executed.");
  }
  orderBy<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T> {
    console.error(
      "Error: Calling Query.orderBy base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.orderBy declaration should not be executed.");
  }
  orderByDescending<TKey>(
    keySelector: (entity: T) => TKey
  ): IOrderedQueryable<T> {
    console.error(
      "Error: Calling Query.orderByDescending base declaration. Check QueryableExtensions."
    );
    throw new Error(
      "Base Query.orderByDescending declaration should not be executed."
    );
  }
  thenBy<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T> {
    console.error(
      "Error: Calling Query.thenBy base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.thenBy declaration should not be executed.");
  }
  thenByDescending<TKey>(
    keySelector: (entity: T) => TKey
  ): IOrderedQueryable<T> {
    console.error(
      "Error: Calling Query.thenByDescending base declaration. Check QueryableExtensions."
    );
    throw new Error(
      "Base Query.thenByDescending declaration should not be executed."
    );
  }
  count(predicate?: (entity: T) => boolean): number {
    console.error(
      "Error: Calling Query.count base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.count declaration should not be executed.");
  }
  skip(count: number): IQueryable<T> {
    console.error(
      "Error: Calling Query.skip base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.skip declaration should not be executed.");
  }
  take(count: number): IQueryable<T> {
    console.error(
      "Error: Calling Query.take base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.take declaration should not be executed.");
  }
  avg(selector: (entity: T) => number): number | null {
    console.error(
      "Error: Calling Query.avg base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.avg declaration should not be executed.");
  }
  sum(selector: (entity: T) => number): number | null {
    console.error(
      "Error: Calling Query.sum base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.sum declaration should not be executed.");
  }
  min<TResult extends number | string | Date>(
    selector: (entity: T) => TResult
  ): TResult | null {
    console.error(
      "Error: Calling Query.min base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.min declaration should not be executed.");
  }
  max<TResult extends number | string | Date>(
    selector: (entity: T) => TResult
  ): TResult | null {
    console.error(
      "Error: Calling Query.max base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.max declaration should not be executed.");
  }
  groupBy<TKey, TResult>(
    keySelector: (entity: T) => TKey,
    resultSelector: (key: TKey, group: IQueryable<T>) => TResult
  ): IQueryable<TResult> {
    console.error(
      "Error: Calling Query.groupBy base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.groupBy declaration should not be executed.");
  }

  // **** NOVAS DECLARAÇÕES PLACEHOLDER UNION / CONCAT ****
  union(second: IQueryable<T>): IQueryable<T> {
    console.error(
      "Error: Calling Query.union base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.union declaration should not be executed.");
  }
  concat(second: IQueryable<T>): IQueryable<T> {
    console.error(
      "Error: Calling Query.concat base declaration. Check QueryableExtensions."
    );
    throw new Error("Base Query.concat declaration should not be executed.");
  }
  // **** FIM NOVAS DECLARAÇÕES ****
}
// --- END OF FILE src/query/Query.ts ---
