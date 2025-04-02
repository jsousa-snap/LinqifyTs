// --- START OF FILE src/__tests__/count.test.ts ---

// src/__tests__/count.test.ts

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
}

interface Post {
  postId: number;
  title: string;
  authorId: number;
}

// --- Fim Interfaces ---

describe("Queryable Count Operator Tests (Async)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Teste Count 1: should generate correct SQL for simple countAsync()", async () => {
    const query = users;
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
    `;
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count", // Nome interno
        query.expression,
        []
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    expect(await query.countAsync()).toBe(10); // Chama countAsync
  });

  it("Teste Count 2: should generate correct SQL for countAsync(predicate)", async () => {
    const predicate = (u: User) => u.age > 30;
    const query = users;
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
WHERE [u].[age] > 30
    `;
    const predicateLambda = new (require("../parsing").LambdaParser)().parse(
      predicate
    );
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression,
        [predicateLambda]
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    expect(await query.countAsync(predicate)).toBe(10); // Chama countAsync
  });

  it("Teste Count 3: should generate correct SQL for countAsync() after where()", async () => {
    const query = users.where((u) => u.name === "Alice");
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
WHERE [u].[name] = 'Alice'
    `;
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression,
        []
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    expect(await query.countAsync()).toBe(10); // Chama countAsync
  });

  it("Teste Count 4: should generate correct SQL for countAsync(predicate) after where()", async () => {
    const predicate = (u: User) => u.age < 25;
    const query = users.where((u) => u.name.includes("a"));
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
WHERE [u].[name] LIKE '%a%' AND [u].[age] < 25
    `;
    const predicateLambda = new (require("../parsing").LambdaParser)().parse(
      predicate
    );
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression,
        [predicateLambda]
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    expect(await query.countAsync(predicate)).toBe(10); // Chama countAsync
  });

  it("Teste Count 5: should generate correct SQL for countAsync() after select() (should ignore projection)", async () => {
    const query = users.select((u) => ({ nameOnly: u.name }));
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
    `;
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression,
        []
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    expect(await query.countAsync()).toBe(10); // Chama countAsync
  });

  it("Teste Count 6: should generate correct SQL for countAsync() in subquery", () => {
    // countAsync() na construção da expressão
    const query = users.provideScope({ posts }).select((u) => ({
      nameOnly: u.name,
      quantity: posts.where((p) => p.authorId === u.id).count(),
    }));

    const expectedSql = `
SELECT [u].[name] AS [nameOnly], (
    SELECT COUNT_BIG(1) AS [count_result]
    FROM [Posts] AS [p]
    WHERE [p].[authorId] = [u].[id]
) AS [quantity]
FROM [Users] AS [u]
          `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/count.test.ts ---
