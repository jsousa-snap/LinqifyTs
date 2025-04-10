// --- START OF FILE src/__tests__/aggregate.test.ts ---

// src/__tests__/aggregate.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions
import { normalizeSql } from "./utils/testUtils";

// --- Interfaces ---
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  salary: number | null;
}
interface Post {
  postId: number;
  title: string;
  authorId: number;
  views: number;
}
// --- Fim Interfaces ---

describe("Queryable Aggregate Operator Tests (Async)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let emptyUsers: IQueryable<User>;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    emptyUsers = users.where((_user) => false);
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Teste Aggregate 1: should generate correct SQL for avgAsync()", async () => {
    const queryPromise = users.avgAsync((u) => u.age); // Usa Async
    const expectedSql = `
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
    `;
    expect(await queryPromise).toBe(42.5);
    const avgExpression = new (require("../expressions").MethodCallExpression)("avg", users.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.age),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 2: should generate correct SQL for avgAsync() after where()", async () => {
    const queryPromise = users.where((u) => u.name === "Alice").avgAsync((u) => u.age); // Usa Async
    const expectedSql = `
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
WHERE [u].[name] = 'Alice'
    `;
    expect(await queryPromise).toBe(42.5);
    const filteredUsers = users.where((u) => u.name === "Alice");
    const avgExpression = new (require("../expressions").MethodCallExpression)("avg", filteredUsers.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.age),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 3: should generate correct SQL for avgAsync() on nullable field", async () => {
    const queryPromise = users.avgAsync((u) => u.salary!); // Usa Async
    const expectedSql = `
SELECT AVG([u].[salary]) AS [avg_result]
FROM [Users] AS [u]
    `;
    expect(await queryPromise).toBe(42.5);
    const avgExpression = new (require("../expressions").MethodCallExpression)("avg", users.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.salary),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 4: should generate correct SQL for sumAsync()", async () => {
    const queryPromise = posts.sumAsync((p) => p.views); // Usa Async
    const expectedSql = `
SELECT SUM([p].[views]) AS [sum_result]
FROM [Posts] AS [p]
    `;
    expect(await queryPromise).toBe(1234);
    const sumExpression = new (require("../expressions").MethodCallExpression)("sum", posts.expression, [
      new (require("../parsing").LambdaParser)().parse((p: Post) => p.views),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(sumExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 5: should generate correct SQL for sumAsync() after where()", async () => {
    const queryPromise = posts.where((p) => p.authorId === 1).sumAsync((p) => p.views); // Usa Async
    const expectedSql = `
SELECT SUM([p].[views]) AS [sum_result]
FROM [Posts] AS [p]
WHERE [p].[authorId] = 1
    `;
    expect(await queryPromise).toBe(1234);
    const filteredPosts = posts.where((p) => p.authorId === 1);
    const sumExpression = new (require("../expressions").MethodCallExpression)("sum", filteredPosts.expression, [
      new (require("../parsing").LambdaParser)().parse((p: Post) => p.views),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(sumExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 6: should generate correct SQL for minAsync()", async () => {
    const queryPromise = users.minAsync((u) => u.age); // Usa Async
    const expectedSql = `
SELECT MIN([u].[age]) AS [min_result]
FROM [Users] AS [u]
    `;
    expect(await queryPromise).toBe(1);
    const minExpression = new (require("../expressions").MethodCallExpression)("min", users.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.age),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(minExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 7: should generate correct SQL for minAsync() on strings", async () => {
    const queryPromise = users.minAsync((u) => u.name); // Usa Async
    const expectedSql = `
SELECT MIN([u].[name]) AS [min_result]
FROM [Users] AS [u]
    `;
    expect(await queryPromise).toBe(1); // Simulado
    const minExpression = new (require("../expressions").MethodCallExpression)("min", users.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.name),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(minExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 8: should generate correct SQL for maxAsync()", async () => {
    const queryPromise = posts.maxAsync((p) => p.views); // Usa Async
    const expectedSql = `
SELECT MAX([p].[views]) AS [max_result]
FROM [Posts] AS [p]
    `;
    expect(await queryPromise).toBe(99);
    const maxExpression = new (require("../expressions").MethodCallExpression)("max", posts.expression, [
      new (require("../parsing").LambdaParser)().parse((p: Post) => p.views),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(maxExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 9: should generate correct SQL for maxAsync() after where()", async () => {
    const queryPromise = users.where((u) => u.age < 30).maxAsync((u) => u.age); // Usa Async
    const expectedSql = `
SELECT MAX([u].[age]) AS [max_result]
FROM [Users] AS [u]
WHERE [u].[age] < 30
    `;
    expect(await queryPromise).toBe(99);
    const filteredUsers = users.where((u) => u.age < 30);
    const maxExpression = new (require("../expressions").MethodCallExpression)("max", filteredUsers.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.age),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(maxExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 10: should generate correct SQL for avgAsync() on empty set", async () => {
    const queryPromise = emptyUsers.avgAsync((u) => u.age); // Usa Async
    const expectedSql = `
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
WHERE 0
    `;
    expect(await queryPromise).toBe(null); // AVG de vazio é NULL
    const avgExpression = new (require("../expressions").MethodCallExpression)("avg", emptyUsers.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.age),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 11 (Subquery): should generate correct SQL for avgAsync() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      AveragePostViews: posts.where((p) => p.authorId === u.id).avgAsync((p) => p.views), // Usa Async
    }));

    const expectedSql = `
SELECT [u].[name] AS [UserName], (
    SELECT AVG([p].[views]) AS [avg_result]
    FROM [Posts] AS [p]
    WHERE [p].[authorId] = [u].[id]
) AS [AveragePostViews]
FROM [Users] AS [u]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 12 (Subquery): should generate correct SQL for sumAsync() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      TotalPostViews: posts.where((p) => p.authorId === u.id).sumAsync((p) => p.views), // Usa Async
    }));

    const expectedSql = `
SELECT [u].[name] AS [UserName], (
    SELECT SUM([p].[views]) AS [sum_result]
    FROM [Posts] AS [p]
    WHERE [p].[authorId] = [u].[id]
) AS [TotalPostViews]
FROM [Users] AS [u]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 13 (Subquery): should generate correct SQL for minAsync() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      MinPostViews: posts.where((p) => p.authorId === u.id).minAsync((p) => p.views), // Usa Async
    }));

    const expectedSql = `
SELECT [u].[name] AS [UserName], (
    SELECT MIN([p].[views]) AS [min_result]
    FROM [Posts] AS [p]
    WHERE [p].[authorId] = [u].[id]
) AS [MinPostViews]
FROM [Users] AS [u]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 14 (Subquery): should generate correct SQL for maxAsync() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      MaxPostViews: posts.where((p) => p.authorId === u.id).maxAsync((p) => p.views), // Usa Async
    }));

    const expectedSql = `
SELECT [u].[name] AS [UserName], (
    SELECT MAX([p].[views]) AS [max_result]
    FROM [Posts] AS [p]
    WHERE [p].[authorId] = [u].[id]
) AS [MaxPostViews]
FROM [Users] AS [u]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 15 (Subquery): should generate correct SQL for avgAsync() on outer query containing subquery", async () => {
    const queryPromise = users
      .provideScope({ posts })
      .where(
        (u) => posts.where((p) => p.authorId === u.id).any((p) => p.views > 50) // Usa any() não-terminal
      )
      .avgAsync((u) => u.age); // avgAsync finaliza

    const expectedSql = `
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
WHERE EXISTS (
        SELECT 1
        FROM [Posts] AS [p]
        WHERE [p].[authorId] = [u].[id] AND [p].[views] > 50
    )
    `;

    expect(await queryPromise).toBe(42.5); // Simulado

    // Verifica SQL gerado (lógica interna)
    const filteredUsers = users
      .provideScope({ posts })
      .where((u) => posts.where((p) => p.authorId === u.id).any((p) => p.views > 50));
    const avgExpression = new (require("../expressions").MethodCallExpression)("avg", filteredUsers.expression, [
      new (require("../parsing").LambdaParser)().parse((u: User) => u.age),
    ]);
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/aggregate.test.ts ---
