// --- START OF FILE src/__tests__/aggregate.test.ts ---

// src/__tests__/aggregate.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions

// --- Interfaces ---
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  salary: number | null; // Adicionando um campo anulável para teste
}
interface Post {
  postId: number;
  title: string;
  authorId: number;
  views: number;
}
// --- Fim Interfaces ---

const normalizeSql = (sql: string): string => {
  return sql
    .replace(/^\s*\n/, "")
    .replace(/\n\s*$/, "")
    .trim();
};

describe("Queryable Aggregate Operator Tests", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let emptyUsers: IQueryable<User>; // Para testar agregação em conjunto vazio

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    // A lambda do where precisa aceitar um parâmetro, mesmo que não o use.
    emptyUsers = users.where((_user) => false); // Cria um queryable "vazio"
    // Mock console.warn para evitar poluir a saída do teste com mensagens de simulação
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    // Restaura o mock
    jest.restoreAllMocks();
  });

  // --- Testes de Agregação Simples (1-9, Inalterados) ---
  it("Teste Aggregate 1: should generate correct SQL for avg()", () => {
    const query = users.avg((u) => u.age);
    const expectedSql = `
SELECT AVG([t0].[age]) AS [avg_result]
FROM [Users] AS [t0]
    `;
    expect(query).toBe(42.5);
    const avgExpression = new (require("../expressions").MethodCallExpression)(
      "avg",
      users.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.age)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 2: should generate correct SQL for avg() after where()", () => {
    const query = users.where((u) => u.name === "Alice").avg((u) => u.age);
    const expectedSql = `
SELECT AVG([t0].[age]) AS [avg_result]
FROM [Users] AS [t0]
WHERE [t0].[name] = 'Alice'
    `;
    expect(query).toBe(42.5);
    const filteredUsers = users.where((u) => u.name === "Alice");
    const avgExpression = new (require("../expressions").MethodCallExpression)(
      "avg",
      filteredUsers.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.age)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 3: should generate correct SQL for avg() on nullable field", () => {
    const query = users.avg((u) => u.salary!);
    const expectedSql = `
SELECT AVG([t0].[salary]) AS [avg_result]
FROM [Users] AS [t0]
    `;
    expect(query).toBe(42.5);
    const avgExpression = new (require("../expressions").MethodCallExpression)(
      "avg",
      users.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.salary)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 4: should generate correct SQL for sum()", () => {
    const query = posts.sum((p) => p.views);
    const expectedSql = `
SELECT SUM([t0].[views]) AS [sum_result]
FROM [Posts] AS [t0]
    `;
    expect(query).toBe(1234);
    const sumExpression = new (require("../expressions").MethodCallExpression)(
      "sum",
      posts.expression,
      [new (require("../parsing").LambdaParser)().parse((p: Post) => p.views)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(sumExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 5: should generate correct SQL for sum() after where()", () => {
    const query = posts.where((p) => p.authorId === 1).sum((p) => p.views);
    const expectedSql = `
SELECT SUM([t0].[views]) AS [sum_result]
FROM [Posts] AS [t0]
WHERE [t0].[authorId] = 1
    `;
    expect(query).toBe(1234);
    const filteredPosts = posts.where((p) => p.authorId === 1);
    const sumExpression = new (require("../expressions").MethodCallExpression)(
      "sum",
      filteredPosts.expression,
      [new (require("../parsing").LambdaParser)().parse((p: Post) => p.views)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(sumExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 6: should generate correct SQL for min()", () => {
    const query = users.min((u) => u.age);
    const expectedSql = `
SELECT MIN([t0].[age]) AS [min_result]
FROM [Users] AS [t0]
    `;
    expect(query).toBe(1);
    const minExpression = new (require("../expressions").MethodCallExpression)(
      "min",
      users.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.age)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(minExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 7: should generate correct SQL for min() on strings", () => {
    const query = users.min((u) => u.name);
    const expectedSql = `
SELECT MIN([t0].[name]) AS [min_result]
FROM [Users] AS [t0]
    `;
    expect(query).toBe(1);
    const minExpression = new (require("../expressions").MethodCallExpression)(
      "min",
      users.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.name)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(minExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 8: should generate correct SQL for max()", () => {
    const query = posts.max((p) => p.views);
    const expectedSql = `
SELECT MAX([t0].[views]) AS [max_result]
FROM [Posts] AS [t0]
    `;
    expect(query).toBe(99);
    const maxExpression = new (require("../expressions").MethodCallExpression)(
      "max",
      posts.expression,
      [new (require("../parsing").LambdaParser)().parse((p: Post) => p.views)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(maxExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 9: should generate correct SQL for max() after where()", () => {
    const query = users.where((u) => u.age < 30).max((u) => u.age);
    const expectedSql = `
SELECT MAX([t0].[age]) AS [max_result]
FROM [Users] AS [t0]
WHERE [t0].[age] < 30
    `;
    expect(query).toBe(99);
    const filteredUsers = users.where((u) => u.age < 30);
    const maxExpression = new (require("../expressions").MethodCallExpression)(
      "max",
      filteredUsers.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.age)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(maxExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 10: should generate correct SQL for avg() on empty set", () => {
    const query = emptyUsers.avg((u) => u.age);
    const expectedSql = `
SELECT AVG([t0].[age]) AS [avg_result]
FROM [Users] AS [t0]
WHERE 0
    `;
    expect(query).toBe(42.5); // Mantém o valor simulado atual
    const avgExpression = new (require("../expressions").MethodCallExpression)(
      "avg",
      emptyUsers.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.age)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // --- NOVOS TESTES COM SUBQUERY ---

  it("Teste Aggregate 11 (Subquery): should generate correct SQL for avg() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      AveragePostViews: posts
        .where((p) => p.authorId === u.id)
        .avg((p) => p.views),
    }));

    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT AVG([t1].[views]) AS [avg_result]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
) AS [AveragePostViews]
FROM [Users] AS [t0]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 12 (Subquery): should generate correct SQL for sum() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      TotalPostViews: posts
        .where((p) => p.authorId === u.id)
        .sum((p) => p.views),
    }));

    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT SUM([t1].[views]) AS [sum_result]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
) AS [TotalPostViews]
FROM [Users] AS [t0]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 13 (Subquery): should generate correct SQL for min() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      MinPostViews: posts.where((p) => p.authorId === u.id).min((p) => p.views),
    }));

    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT MIN([t1].[views]) AS [min_result]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
) AS [MinPostViews]
FROM [Users] AS [t0]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 14 (Subquery): should generate correct SQL for max() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      MaxPostViews: posts.where((p) => p.authorId === u.id).max((p) => p.views),
    }));

    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT MAX([t1].[views]) AS [max_result]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
) AS [MaxPostViews]
FROM [Users] AS [t0]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Opcional: Teste com agregação na query externa após subquery (embora menos comum)
  it("Teste Aggregate 15 (Subquery): should generate correct SQL for avg() on outer query containing subquery aggregate", () => {
    // Calcula a média das idades dos usuários que têm alguma postagem com mais de 50 visualizações
    const query = users
      .provideScope({ posts })
      .where((u) =>
        posts.where((p) => p.authorId === u.id).exists((p) => p.views > 50)
      )
      .avg((u) => u.age);

    const expectedSql = `
SELECT AVG([t0].[age]) AS [avg_result]
FROM [Users] AS [t0]
WHERE EXISTS (
        SELECT 1
        FROM [Posts] AS [t1]
        WHERE ([t1].[authorId] = [t0].[id] AND [t1].[views] > 50)
    )
    `;

    expect(query).toBe(42.5); // Simulado
    const filteredUsers = users
      .provideScope({ posts })
      .where((u) =>
        posts.where((p) => p.authorId === u.id).exists((p) => p.views > 50)
      );
    const avgExpression = new (require("../expressions").MethodCallExpression)(
      "avg",
      filteredUsers.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.age)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/aggregate.test.ts ---
