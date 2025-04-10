/* eslint-disable @typescript-eslint/no-explicit-any */
import { Expression } from "./expressions";

/**
 * Define o tipo base para elementos em um IQueryable.
 * Pode ser uma função construtora (classe) ou um objeto genérico.
 * @typedef {Function | Object} ElementType
 */
export type ElementType = ((...args: any[]) => any) | object;

// Tipos genéricos usados nas assinaturas de métodos IQueryable.
// São placeholders para tipos específicos usados em cada chamada.
export declare type TInner = any;
export declare type TKey = any;
export declare type TResult = any;
export declare type TResultSelect = any;
export declare type TInnerJoin = any;
export declare type TKeyJoin = any;
export declare type TResultJoin = any;

/**
 * Representa conceitualmente um grupo resultante de uma operação GroupBy.
 * Embora não seja uma classe real instanciável diretamente pelo usuário final,
 * ela estende IQueryable para permitir chamadas de agregação (Count, Sum, etc.)
 * no segundo parâmetro do resultSelector do GroupBy. O tradutor LINQ
 * interpreta chamadas nesta interface de forma especial.
 *
 * @export
 * @interface IGrouping
 * @template TKey O tipo da chave do grupo.
 * @template TElement O tipo dos elementos dentro do grupo.
 * @extends {IQueryable<TElement>}
 */
export interface IGrouping<TKey, TElement> extends IQueryable<TElement> {
  /**
   * A chave associada a este grupo.
   *
   * @type {TKey}
   * @memberof IGrouping
   */
  readonly key: TKey;
}

/**
 * Interface principal que define a funcionalidade de uma coleção consultável.
 * Permite a construção de árvores de expressão LINQ que podem ser traduzidas
 * para outras linguagens de consulta (como SQL).
 *
 * @export
 * @interface IQueryable
 * @template T O tipo dos elementos na coleção.
 */
export interface IQueryable<T> {
  /**
   * A árvore de expressão LINQ que representa a consulta construída até o momento.
   *
   * @type {Expression}
   * @memberof IQueryable
   */
  readonly expression: Expression;
  /**
   * O provedor de consulta responsável por traduzir e executar a expressão.
   *
   * @type {IQueryProvider}
   * @memberof IQueryable
   */
  readonly provider: IQueryProvider;
  /**
   * O tipo dos elementos que esta consulta retorna.
   *
   * @type {ElementType}
   * @memberof IQueryable
   */
  readonly elementType: ElementType;

  /**
   * Traduz a expressão LINQ atual para a linguagem de consulta do provedor (ex: SQL).
   *
   * @returns {string} A consulta gerada.
   * @memberof IQueryable
   */
  toQueryString(): string;

  /**
   * Projeta cada elemento de uma sequência em um novo formulário.
   *
   * @template TResultSelect O tipo do valor retornado por `selector`.
   * @param {(entity: T) => TResultSelect} selector Uma função de transformação a aplicar a cada elemento.
   * @returns {IQueryable<TResultSelect>} Um IQueryable cujos elementos são o resultado da invocação da função de transformação em cada elemento da origem.
   * @memberof IQueryable
   */
  select<TResultSelect>(selector: (entity: T) => TResultSelect): IQueryable<TResultSelect>;

  /**
   * Filtra uma sequência de valores com base em um predicado.
   *
   * @param {(entity: T) => boolean} predicate Uma função para testar cada elemento quanto a uma condição.
   * @returns {IQueryable<T>} Um IQueryable que contém elementos da sequência de entrada que satisfazem a condição.
   * @memberof IQueryable
   */
  where(predicate: (entity: T) => boolean): IQueryable<T>;

  /**
   * Correlaciona os elementos de duas sequências com base em chaves correspondentes (INNER JOIN).
   *
   * @template TInnerJoin O tipo dos elementos da sequência interna.
   * @template TKeyJoin O tipo das chaves retornadas pelas funções de seletor de chave.
   * @template TResultJoin O tipo dos elementos de resultado.
   * @param {IQueryable<TInnerJoin>} inner A sequência para juntar à primeira sequência.
   * @param {(outer: T) => TKeyJoin} outerKeySelector Uma função para extrair a chave de junção de cada elemento da primeira sequência.
   * @param {(inner: TInnerJoin) => TKeyJoin} innerKeySelector Uma função para extrair a chave de junção de cada elemento da segunda sequência.
   * @param {(outer: T, inner: TInnerJoin) => TResultJoin} resultSelector Uma função para criar um elemento de resultado a partir de dois elementos correspondentes.
   * @returns {IQueryable<TResultJoin>} Um IQueryable que tem elementos de TResultJoin obtidos através da execução de uma junção interna em duas sequências.
   * @memberof IQueryable
   */
  join<TInnerJoin, TKeyJoin, TResultJoin>(
    inner: IQueryable<TInnerJoin>,
    outerKeySelector: (outer: T) => TKeyJoin,
    innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
    resultSelector: (outer: T, inner: TInnerJoin) => TResultJoin
  ): IQueryable<TResultJoin>;

  /**
   * Correlaciona os elementos de duas sequências com base em chaves correspondentes usando LEFT JOIN.
   * Inclui todos os elementos da sequência externa e os elementos correspondentes da sequência interna.
   * Se não houver correspondência na sequência interna, o parâmetro 'inner' no resultSelector será `null`.
   *
   * @template TInnerJoin O tipo dos elementos da sequência interna.
   * @template TKeyJoin O tipo das chaves retornadas pelas funções de seletor de chave.
   * @template TResultJoin O tipo dos elementos de resultado.
   * @param {IQueryable<TInnerJoin>} inner A sequência para juntar à primeira sequência.
   * @param {(outer: T) => TKeyJoin} outerKeySelector Uma função para extrair a chave de junção de cada elemento da primeira sequência.
   * @param {(inner: TInnerJoin) => TKeyJoin} innerKeySelector Uma função para extrair a chave de junção de cada elemento da segunda sequência.
   * @param {(outer: T, inner: TInnerJoin | null) => TResultJoin} resultSelector Uma função para criar um elemento de resultado a partir de um elemento externo e seu elemento interno correspondente (ou null se não houver correspondência).
   * @returns {IQueryable<TResultJoin>} Um IQueryable que tem elementos de TResultJoin obtidos através da execução de uma junção externa esquerda (left outer join) em duas sequências.
   * @memberof IQueryable
   */
  leftJoin<TInnerJoin, TKeyJoin, TResultJoin>(
    inner: IQueryable<TInnerJoin>,
    outerKeySelector: (outer: T) => TKeyJoin,
    innerKeySelector: (inner: TInnerJoin) => TKeyJoin,
    resultSelector: (outer: T, inner: TInnerJoin | null) => TResultJoin // <<< INNER PODE SER NULL
  ): IQueryable<TResultJoin>;

  /**
   * Fornece variáveis externas (outros IQueryables ou valores escalares)
   * para serem usadas dentro de lambdas subsequentes (where, select, etc.).
   * Útil para subconsultas correlacionadas ou uso de parâmetros externos.
   *
   * @param {{ [key: string]: IQueryable<any> | any }} scope Um objeto onde as chaves são os nomes das variáveis como usadas na lambda, e os valores são os IQueryables ou valores escalares.
   * @returns {IQueryable<T>} O IQueryable original, mas com o escopo adicionado à sua expressão.
   * @memberof IQueryable
   */
  provideScope(scope: { [key: string]: IQueryable<any> | any }): IQueryable<T>;

  // **** PARES Síncrono/Assíncrono ****
  any(): boolean; // Síncrono
  any(predicate: (entity: T) => boolean): boolean; // Síncrono
  anyAsync(): Promise<boolean>; // Assíncrono
  anyAsync(predicate: (entity: T) => boolean): Promise<boolean>; // Assíncrono

  count(): number; // Síncrono
  count(predicate: (entity: T) => boolean): number; // Síncrono
  countAsync(): Promise<number>; // Assíncrono
  countAsync(predicate: (entity: T) => boolean): Promise<number>; // Assíncrono

  avg(selector: (entity: T) => number): number | null; // Síncrono
  avgAsync(selector: (entity: T) => number): Promise<number | null>; // Assíncrono

  sum(selector: (entity: T) => number): number | null; // Síncrono
  sumAsync(selector: (entity: T) => number): Promise<number | null>; // Assíncrono

  min<TResult extends number | string | Date>(selector: (entity: T) => TResult): TResult | null; // Síncrono
  minAsync<TResult extends number | string | Date>(selector: (entity: T) => TResult): Promise<TResult | null>; // Assíncrono

  max<TResult extends number | string | Date>(selector: (entity: T) => TResult): TResult | null; // Síncrono
  maxAsync<TResult extends number | string | Date>(selector: (entity: T) => TResult): Promise<TResult | null>; // Assíncrono

  first(): T; // Síncrono
  first(predicate?: (entity: T) => boolean): T; // Síncrono
  firstAsync(): Promise<T>; // Assíncrono
  firstAsync(predicate?: (entity: T) => boolean): Promise<T>; // Assíncrono

  firstOrDefault(): T | null; // Síncrono
  firstOrDefault(predicate?: (entity: T) => boolean): T | null; // Síncrono
  firstOrDefaultAsync(): Promise<T | null>; // Assíncrono
  firstOrDefaultAsync(predicate?: (entity: T) => boolean): Promise<T | null>; // Assíncrono

  single(): T; // Síncrono
  single(predicate?: (entity: T) => boolean): T; // Síncrono
  singleAsync(): Promise<T>; // Assíncrono
  singleAsync(predicate?: (entity: T) => boolean): Promise<T>; // Assíncrono

  singleOrDefault(): T | null; // Síncrono
  singleOrDefault(predicate?: (entity: T) => boolean): T | null; // Síncrono
  singleOrDefaultAsync(): Promise<T | null>; // Assíncrono
  singleOrDefaultAsync(predicate?: (entity: T) => boolean): Promise<T | null>; // Assíncrono

  // toList permanece apenas Async
  toListAsync(): Promise<T[]>;
  // **** FIM PARES ****

  /**
   * Classifica os elementos de uma sequência em ordem crescente de acordo com uma chave.
   *
   * @template TKey O tipo da chave retornada por `keySelector`.
   * @param {(entity: T) => TKey} keySelector Uma função para extrair uma chave de um elemento.
   * @returns {IOrderedQueryable<T>} Um IOrderedQueryable cujos elementos são classificados de acordo com uma chave.
   * @memberof IQueryable
   */
  orderBy<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T>;
  /**
   * Classifica os elementos de uma sequência em ordem decrescente de acordo com uma chave.
   *
   * @template TKey O tipo da chave retornada por `keySelector`.
   * @param {(entity: T) => TKey} keySelector Uma função para extrair uma chave de um elemento.
   * @returns {IOrderedQueryable<T>} Um IOrderedQueryable cujos elementos são classificados em ordem decrescente de acordo com uma chave.
   * @memberof IQueryable
   */
  orderByDescending<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T>;

  /**
   * Ignora um número especificado de elementos em uma sequência e retorna os elementos restantes.
   * Requer que a consulta seja ordenada (`orderBy` ou `orderByDescending`) para garantir resultados consistentes.
   *
   * @param {number} count O número de elementos a ignorar. Deve ser um inteiro não negativo.
   * @returns {IQueryable<T>} Um IQueryable que contém os elementos que ocorrem após o índice especificado na sequência de entrada.
   * @memberof IQueryable
   */
  skip(count: number): IQueryable<T>;

  /**
   * Retorna um número especificado de elementos contíguos do início de uma sequência.
   * Requer que a consulta seja ordenada (`orderBy` ou `orderByDescending`) para garantir resultados consistentes.
   *
   * @param {number} count O número de elementos a retornar. Deve ser um inteiro não negativo.
   * @returns {IQueryable<T>} Um IQueryable que contém o número especificado de elementos do início da sequência de entrada.
   * @memberof IQueryable
   */
  take(count: number): IQueryable<T>;

  /**
   * Agrupa os elementos de uma sequência de acordo com uma função de seletor de chave especificada
   * e cria um valor de resultado para cada grupo e sua chave.
   *
   * @template TKey O tipo da chave retornada por `keySelector`.
   * @template TResult O tipo do valor de resultado criado por `resultSelector`.
   * @param {(entity: T) => TKey} keySelector Uma função para extrair a chave de cada elemento.
   * @param {(key: TKey, group: IQueryable<T>) => TResult} resultSelector Uma função para criar um valor de resultado a partir de cada grupo. O segundo parâmetro (`group`) representa o grupo e permite chamadas de agregação (ex: `group.countAsync()`, `group.sumAsync(g => g.salary)`).
   * @returns {IQueryable<TResult>} Um IQueryable onde cada elemento representa uma projeção sobre um grupo, conforme definido por `resultSelector`.
   * @throws {Error} Se os seletores forem nulos ou a tradução falhar.
   * @memberof IQueryable
   */
  groupBy<TKey, TResult>(
    keySelector: (entity: T) => TKey,
    resultSelector: (key: TKey, group: IQueryable<T>) => TResult
  ): IQueryable<TResult>;

  /**
   * Produz a união de conjuntos de duas sequências usando o comparador de igualdade padrão.
   * Remove elementos duplicados. Corresponde ao operador SQL UNION.
   * As duas sequências devem ter projeções compatíveis (mesmo número de colunas e tipos).
   *
   * @param {IQueryable<T>} second A sequência cujos elementos distintos formam a segunda entrada para a união de conjuntos.
   * @returns {IQueryable<T>} Um IQueryable que contém os elementos de ambas as sequências de entrada, excluindo duplicatas.
   * @memberof IQueryable
   */
  union(second: IQueryable<T>): IQueryable<T>;

  /**
   * Produz a concatenação de conjuntos de duas sequências.
   * Mantém elementos duplicados. Corresponde ao operador SQL UNION ALL.
   * As duas sequências devem ter projeções compatíveis (mesmo número de colunas e tipos).
   *
   * @param {IQueryable<T>} second A sequência a ser concatenada à primeira sequência.
   * @returns {IQueryable<T>} Um IQueryable que contém os elementos das duas sequências de entrada, incluindo duplicatas.
   * @memberof IQueryable
   */
  concat(second: IQueryable<T>): IQueryable<T>;
}

/**
 * Estende IQueryable para fornecer funcionalidade adicional necessária
 * para consultas ordenadas (após orderBy ou orderByDescending).
 *
 * @export
 * @interface IOrderedQueryable
 * @template T O tipo dos elementos na coleção.
 * @extends {IQueryable<T>}
 */
export interface IOrderedQueryable<T> extends IQueryable<T> {
  /**
   * Realiza uma classificação subsequente dos elementos em uma sequência em ordem crescente de acordo com uma chave.
   *
   * @template TKey O tipo da chave retornada por `keySelector`.
   * @param {(entity: T) => TKey} keySelector Uma função para extrair uma chave de cada elemento.
   * @returns {IOrderedQueryable<T>} Um IOrderedQueryable cujos elementos são classificados de acordo com uma chave.
   * @memberof IOrderedQueryable
   */
  thenBy<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T>;
  /**
   * Realiza uma classificação subsequente dos elementos em uma sequência em ordem decrescente de acordo com uma chave.
   *
   * @template TKey O tipo da chave retornada por `keySelector`.
   * @param {(entity: T) => TKey} keySelector Uma função para extrair uma chave de cada elemento.
   * @returns {IOrderedQueryable<T>} Um IOrderedQueryable cujos elementos são classificados em ordem decrescente de acordo com uma chave.
   * @memberof IOrderedQueryable
   */
  thenByDescending<TKey>(keySelector: (entity: T) => TKey): IOrderedQueryable<T>;
}

/**
 * Define métodos para criar e executar consultas que são descritas
 * por uma árvore de expressão LINQ.
 *
 * @export
 * @interface IQueryProvider
 */
export interface IQueryProvider {
  /**
   * Constrói um objeto IQueryable<TElement> que pode avaliar a consulta representada
   * por uma árvore de expressão especificada.
   *
   * @template TElement O tipo dos elementos do IQueryable retornado.
   * @param {Expression} expression Uma árvore de expressão que representa uma consulta LINQ.
   * @param {ElementType} elementType O tipo dos elementos resultantes da consulta.
   * @returns {IQueryable<TElement>} Um IQueryable que pode avaliar a consulta representada pela árvore de expressão especificada.
   * @memberof IQueryProvider
   */
  createQuery<TElement>(expression: Expression, elementType: ElementType): IQueryable<TElement>;

  /**
   * Executa (assincronamente ou sincronicamente para 'any') a consulta representada
   * por uma árvore de expressão especificada.
   *
   * @template TResultExecute O tipo do valor ou coleção que resulta da execução da consulta.
   * @param {Expression} expression Uma árvore de expressão que representa uma consulta LINQ.
   * @returns {Promise<TResultExecute> | TResultExecute} O valor/coleção resultante ou uma Promise para ele.
   * @memberof IQueryProvider
   */
  execute<TResultExecute>(expression: Expression): Promise<TResultExecute> | TResultExecute; // Pode ser sync (any) ou async

  /**
   * Obtém a representação textual (ex: SQL) da consulta representada pela árvore de expressão.
   *
   * @param {Expression} expression A árvore de expressão da consulta LINQ.
   * @returns {string} A representação textual da consulta.
   * @memberof IQueryProvider
   */
  getQueryText(expression: Expression): string;
}
