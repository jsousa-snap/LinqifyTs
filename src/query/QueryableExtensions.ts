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

// --- Declaração de Módulo (Adicionar groupBy, union, concat) ---
declare module "../interfaces" {
  interface IQueryable<T> {
    // Assinaturas existentes...
    avg(selector: (entity: T) => number): number | null;
    sum(selector: (entity: T) => number): number | null;
    min<TResult extends number | string | Date>(
      selector: (entity: T) => TResult
    ): TResult | null;
    max<TResult extends number | string | Date>(
      selector: (entity: T) => TResult
    ): TResult | null;

    // Assinatura groupBy
    groupBy<TKey, TResult>(
      keySelector: (entity: T) => TKey,
      resultSelector: (key: TKey, group: IQueryable<T>) => TResult
    ): IQueryable<TResult>;

    // Assinaturas union e concat
    union(second: IQueryable<T>): IQueryable<T>;
    concat(second: IQueryable<T>): IQueryable<T>;
  }
}
// --- Fim Declaração ---

// Helper findScopeMap (inalterado)
/**
 * Percorre a árvore de expressão para cima a partir da expressão dada,
 * acumulando todos os scopeMaps encontrados em ScopeExpressions.
 * @param expression A expressão inicial para começar a busca.
 * @returns Um ReadonlyMap combinado de todos os escopos encontrados, ou undefined se nenhum for encontrado.
 */
function findScopeMap(
  expression: Expression
): ReadonlyMap<string, Expression> | undefined {
  let current: Expression | null = expression;
  let combinedScope: Map<string, Expression> | null = null;

  // Navega para cima na árvore de expressões
  while (current) {
    if (current.type === ExpressionType.Scope) {
      // Se encontrar uma ScopeExpression, mescla seu scopeMap
      const scopeExpr = current as ScopeExpression;
      if (!combinedScope) {
        // Se for o primeiro, cria o mapa combinado
        combinedScope = new Map(scopeExpr.scopeMap);
      } else {
        // Se já existe, adiciona/sobrescreve as entradas do escopo atual
        scopeExpr.scopeMap.forEach((value, key) =>
          combinedScope!.set(key, value)
        );
      }
      // Continua a busca a partir da expressão fonte da ScopeExpression
      current = scopeExpr.sourceExpression;
    } else if (current.type === ExpressionType.Call) {
      // Se for uma chamada de método, continua a busca a partir da fonte da chamada
      current = (current as MethodCallExpression).source;
    } else {
      // Se não for Scope ou Call, para a busca (ex: ConstantExpression no início)
      current = null;
    }
  }
  // Retorna o mapa combinado ou undefined se nenhum escopo foi encontrado
  return combinedScope ?? undefined;
}

// Instância única do parser de lambda
const lambdaParser = new LambdaParser();

// Implementação de provideScope (inalterada)
Query.prototype.provideScope = function <T>(
  this: IQueryable<T>,
  scope: { [key: string]: IQueryable<any> | any }
): IQueryable<T> {
  const scopeMap = new Map<string, Expression>();
  for (const key in scope) {
    // Verifica se a propriedade pertence ao objeto scope (e não ao protótipo)
    if (Object.prototype.hasOwnProperty.call(scope, key)) {
      const value = scope[key];
      // Verifica se o valor é um objeto IQueryable (possui expression e provider)
      if (
        value &&
        typeof value === "object" &&
        "expression" in value &&
        "provider" in value &&
        value.expression instanceof Expression // Verifica se expression é do tipo correto
      ) {
        const queryable = value as IQueryable<any>;
        if (!queryable.expression)
          throw new Error(`Invalid IQueryable for scope key '${key}'.`);
        // Mapeia o nome da variável para a expressão raiz do IQueryable
        scopeMap.set(key, queryable.expression);
      } else {
        // Se não for IQueryable, trata como valor constante
        scopeMap.set(key, new ConstantExpression(value));
      }
    }
  }
  // Cria a ScopeExpression envolvendo a expressão atual e o mapa de escopo
  const scopeExpr = new ScopeExpression(this.expression, scopeMap);
  // Cria um novo IQueryable com a ScopeExpression
  return this.provider.createQuery<T>(scopeExpr, this.elementType);
};

// Implementação de select (inalterada)
Query.prototype.select = function <T, TResult>(
  this: IQueryable<T>,
  selector: (entity: T) => TResult
): IQueryable<TResult> {
  // Encontra o escopo disponível (se houver)
  const scopeMap = findScopeMap(this.expression);
  // Parseia a lambda do seletor, passando o escopo
  const lambdaExpr: LambdaExpression = lambdaParser.parse(
    selector,
    [], // Pilha inicial vazia (parâmetros da lambda são internos)
    scopeMap
  );
  // Cria a expressão de chamada de método 'select'
  const callExpr = new MethodCallExpression("select", this.expression, [
    lambdaExpr,
  ]);
  // O tipo do elemento resultante é desconhecido a priori, usa Object como placeholder
  const resultElementType = Object as ElementType;
  // Cria um novo IQueryable com a expressão de chamada 'select'
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
  // 'where' não muda o tipo do elemento
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
  // Parseia as lambdas de seleção de chave e de resultado
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
  // Cria a expressão de chamada 'join' com a expressão interna e as lambdas
  const callExpr = new MethodCallExpression("join", this.expression, [
    innerSource.expression, // Passa a expressão da fonte interna
    outerKeyLambda,
    innerKeyLambda,
    resultLambda,
  ]);
  const resultElementType = Object as ElementType;
  return this.provider.createQuery<TResultJoin>(callExpr, resultElementType);
};

// Implementação de exists (inalterada)
Query.prototype.exists = function <T>(
  this: IQueryable<T>,
  predicate?: (entity: T) => boolean
): boolean {
  const scopeMap = findScopeMap(this.expression);
  const args: Expression[] = [];
  if (predicate) {
    // Se um predicado foi fornecido, parseia-o
    const lambdaExpr: LambdaExpression = lambdaParser.parse(
      predicate,
      [],
      scopeMap
    );
    if (lambdaExpr.parameters.length !== 1)
      throw new Error("Exists lambda predicate needs 1 parameter.");
    args.push(lambdaExpr); // Adiciona a lambda parseada aos argumentos
  }
  // Cria a expressão de chamada 'exists'
  const callExpr = new MethodCallExpression("exists", this.expression, args);
  // Executa a expressão (método terminal)
  return this.provider.execute<boolean>(callExpr);
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
  // Retorna um IOrderedQueryable
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
  this: IOrderedQueryable<T>, // Note: Chamado em IOrderedQueryable
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
  this: IOrderedQueryable<T>, // Note: Chamado em IOrderedQueryable
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

// Implementação de count (inalterada)
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
  return this.provider.execute<number>(callExpr);
};

// Implementação de skip (inalterada)
Query.prototype.skip = function <T>(
  this: IQueryable<T>,
  count: number
): IQueryable<T> {
  // Validação do argumento 'count'
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error(
      "Argument 'count' for 'skip' must be a non-negative integer."
    );
  }
  // Cria uma ConstantExpression para o valor de 'count'
  const countExpression = new ConstantExpression(count);
  // Cria a expressão de chamada 'skip'
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

// Implementação de avg (inalterada)
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
  // Método terminal, executa a consulta
  return this.provider.execute<number | null>(callExpr);
};

// Implementação de sum (inalterada)
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
  return this.provider.execute<number | null>(callExpr);
};

// Implementação de min (inalterada)
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
  return this.provider.execute<TResult | null>(callExpr);
};

// Implementação de max (inalterada)
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
  return this.provider.execute<TResult | null>(callExpr);
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

// **** NOVAS IMPLEMENTAÇÕES UNION / CONCAT ****

/**
 * Cria uma expressão de chamada de método para 'union'.
 * Representa a operação SQL UNION (remove duplicatas).
 * @param this A queryable atual (primeira sequência).
 * @param second A segunda queryable a ser unida.
 * @returns Um novo IQueryable representando a união.
 */
Query.prototype.union = function <T>(
  this: IQueryable<T>,
  second: IQueryable<T>
): IQueryable<T> {
  if (!second || !second.expression || !second.provider) {
    throw new Error("Invalid second IQueryable provided for 'union'.");
  }
  // Cria a MethodCallExpression para 'union', passando a expressão da segunda queryable como argumento.
  const callExpr = new MethodCallExpression("union", this.expression, [
    second.expression,
  ]);
  // O tipo de elemento permanece o mesmo.
  return this.provider.createQuery<T>(callExpr, this.elementType);
};

/**
 * Cria uma expressão de chamada de método para 'concat'.
 * Representa a operação SQL UNION ALL (mantém duplicatas).
 * @param this A queryable atual (primeira sequência).
 * @param second A segunda queryable a ser concatenada.
 * @returns Um novo IQueryable representando a concatenação.
 */
Query.prototype.concat = function <T>(
  this: IQueryable<T>,
  second: IQueryable<T>
): IQueryable<T> {
  if (!second || !second.expression || !second.provider) {
    throw new Error("Invalid second IQueryable provided for 'concat'.");
  }
  // Cria a MethodCallExpression para 'concat', passando a expressão da segunda queryable.
  const callExpr = new MethodCallExpression("concat", this.expression, [
    second.expression,
  ]);
  // O tipo de elemento permanece o mesmo.
  return this.provider.createQuery<T>(callExpr, this.elementType);
};
// **** FIM NOVAS IMPLEMENTAÇÕES ****

// --- END OF FILE src/query/QueryableExtensions.ts ---
