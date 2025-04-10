// --- START OF FILE src/__tests__/orderby.test.ts ---

// src/__tests__/orderby.test.ts

import { DbContext } from "../core";
import { IQueryable, IOrderedQueryable } from "../interfaces"; // Import IOrderedQueryable
import { normalizeSql } from "./utils/testUtils"; // <<< IMPORTADO (caminho correto)
import "../query/QueryableExtensions"; // Apply extensions

// --- Interfaces ---
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}
// --- Fim Interfaces ---

describe("Queryable OrderBy/ThenBy Tests", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
  });

  it("Teste OrderBy 1: should generate correct SQL for orderBy", () => {
    const query = users.orderBy((u) => u.age);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
ORDER BY [u].[age] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 2: should generate correct SQL for orderByDescending", () => {
    const query = users.orderByDescending((u) => u.name);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
ORDER BY [u].[name] DESC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 3: should generate correct SQL for orderBy and thenBy", () => {
    const query = users.orderBy((u) => u.age).thenBy((u) => u.name);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
ORDER BY [u].[age] ASC, [u].[name] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 4: should generate correct SQL for orderByDescending and thenByDescending", () => {
    const query = users.orderByDescending((u) => u.age).thenByDescending((u) => u.name);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
ORDER BY [u].[age] DESC, [u].[name] DESC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 5: should generate correct SQL for mixed orderBy and thenBy", () => {
    const query = users
      .orderBy((u) => u.age)
      .thenByDescending((u) => u.name)
      .thenBy((u) => u.id);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
ORDER BY [u].[age] ASC, [u].[name] DESC, [u].[id] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 6: should generate correct SQL for orderBy after where", () => {
    const query = users.where((u) => u.email.includes("@")).orderBy((u) => u.id);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[email] LIKE '%@%'
ORDER BY [u].[id] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 7: should generate correct SQL for orderBy before select", () => {
    const query = users.orderBy((u) => u.age).select((u) => u.name);
    // Order By should apply to the source before projection in SQL
    const expectedSql = `
SELECT [u].[name]
FROM [Users] AS [u]
ORDER BY [u].[age] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 8: should generate correct SQL for orderBy using projected field alias (less common but possible)", () => {
    const querySimple = users
      .select((u) => ({ NameVal: u.name, AgeVal: u.age })) // Simple projection
      .orderBy((dto) => dto.AgeVal); // Order by projected 'AgeVal'

    const expectedSqlSimple = `
SELECT [u].[name] AS [NameVal], [u].[age] AS [AgeVal]
FROM [Users] AS [u]
ORDER BY [u].[age] ASC
    `;

    const actualSqlSimple = querySimple.toQueryString();
    expect(normalizeSql(actualSqlSimple)).toEqual(normalizeSql(expectedSqlSimple));
  });
});
// --- END OF FILE src/__tests__/orderby.test.ts ---
