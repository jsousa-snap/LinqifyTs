// --- START OF FILE src/__tests__/scope.test.ts ---

// Em src/__tests__/scope.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions";
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

describe("Queryable ProvideScope Tests", () => {
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

  it("Teste Scope 1: should handle scalar value in scope for where clause", () => {
    const searchName = "Bob";
    const minAge = 25;

    const query = users
      .provideScope({ searchName, minAge })
      .where((u) => u.name === searchName && u.age >= minAge);

    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] = 'Bob' AND [u].[age] >= 25`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Scope 2: should handle mixed IQueryable and scalar values in scope", () => {
    const specificTitle = "Specific Post";

    // Usa any() não-terminal
    const query = users.provideScope({ posts, specificTitle }).where(
      (u) =>
        posts
          .where((p) => p.authorId === u.id)
          .any((p) => p.title == specificTitle) // **** USA any() ****
    );

    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE EXISTS (
        SELECT 1
        FROM [Posts] AS [p]
        WHERE [p].[authorId] = [u].[id] AND [p].[title] = 'Specific Post'
    )`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Scope 3: should handle scalar value with includes translated to LIKE", () => {
    const searchTerm = "usuario1";
    const query = users
      .provideScope({ searchTerm })
      .where((u) => u.name.includes(searchTerm));

    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] LIKE '%usuario1%'`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Scope 4: should handle includes with special LIKE characters", () => {
    const searchTerm = "user%";
    const query = users
      .provideScope({ searchTerm })
      .where((u) => u.name.includes(searchTerm));

    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] LIKE '%user[%]%'`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Scope 5: should handle includes with underscore", () => {
    const searchTerm = "user_1";
    const query = users
      .provideScope({ searchTerm })
      .where((u) => u.name.includes(searchTerm));

    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] LIKE '%user[_]1%'`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/scope.test.ts ---
