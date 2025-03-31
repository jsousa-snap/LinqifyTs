// --- START OF FILE src/__tests__/orderby.test.ts ---

// src/__tests__/orderby.test.ts

import { DbContext } from "../core";
import { IQueryable, IOrderedQueryable } from "../interfaces"; // Import IOrderedQueryable
import "../query/QueryableExtensions"; // Apply extensions

// --- Interfaces ---
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}
// --- Fim Interfaces ---

// Helper normalizeSql
const normalizeSql = (sql: string): string => {
  let result = sql;

  // Remove espaços em branco seguidos pela primeira quebra de linha no início
  result = result.replace(/^\s*\n/, "");

  // Remove a última quebra de linha seguida por espaços em branco no final
  result = result.replace(/\n\s*$/, "");

  return result;
};

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
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 2: should generate correct SQL for orderByDescending", () => {
    const query = users.orderByDescending((u) => u.name);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[name] DESC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 3: should generate correct SQL for orderBy and thenBy", () => {
    const query = users.orderBy((u) => u.age).thenBy((u) => u.name);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC, [t0].[name] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 4: should generate correct SQL for orderByDescending and thenByDescending", () => {
    const query = users
      .orderByDescending((u) => u.age)
      .thenByDescending((u) => u.name);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[age] DESC, [t0].[name] DESC
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
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC, [t0].[name] DESC, [t0].[id] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 6: should generate correct SQL for orderBy after where", () => {
    const query = users
      .where((u) => u.email.includes("@"))
      .orderBy((u) => u.id);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE ([t0].[email] LIKE '%@%')
ORDER BY [t0].[id] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 7: should generate correct SQL for orderBy before select", () => {
    const query = users.orderBy((u) => u.age).select((u) => u.name);
    // Order By should apply to the source before projection in SQL
    const expectedSql = `
SELECT [t0].[name]
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste OrderBy 8: should generate correct SQL for orderBy using projected field alias (less common but possible)", () => {
    // Note: SQL typically orders by the source column before projection,
    // but let's test if ordering by the *result* of a select works conceptually.
    // The translator might optimize this back to the source column.
    const query = users
      .select((u) => ({ NameUpper: u.name.toUpperCase(), Age: u.age })) // Select projection
      .orderBy((dto) => dto.Age); // Order by projected 'Age'

    // Expected: ORDER BY happens on the source table column
    const expectedSql = `
SELECT UPPER([t0].[name]) AS [NameUpper], [t0].[age] AS [Age]
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC
    `;
    // How UPPER is translated might vary, assuming a simple UPPER function for now.
    // The key point is that ORDER BY [t0].[age] refers to the *source* table.

    // Let's refine the test slightly, as `toUpperCase` isn't translated yet.
    const querySimple = users
      .select((u) => ({ NameVal: u.name, AgeVal: u.age })) // Simple projection
      .orderBy((dto) => dto.AgeVal); // Order by projected 'AgeVal'

    const expectedSqlSimple = `
SELECT [t0].[name] AS [NameVal], [t0].[age] AS [AgeVal]
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC
    `;

    const actualSqlSimple = querySimple.toQueryString();
    expect(normalizeSql(actualSqlSimple)).toEqual(
      normalizeSql(expectedSqlSimple)
    );
  });
});
// --- END OF FILE src/__tests__/orderby.test.ts ---
