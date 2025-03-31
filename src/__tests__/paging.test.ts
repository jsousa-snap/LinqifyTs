// --- START OF FILE src/__tests__/paging.test.ts ---

// src/__tests__/paging.test.ts

import { DbContext } from "../core";
import "../query/QueryableExtensions"; // Importa para aplicar os métodos no protótipo
import { IQueryable } from "../interfaces"; // Se necessário para tipagem

// --- Interfaces/Classes de Entidade (Copie ou importe-as) ---
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  limit?: number;
}
class UserEntity implements User {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
  limit?: number;
}
interface Post {
  postId: number;
  title: string;
  authorId: number;
}
class PostEntity implements Post {
  postId!: number;
  title!: string;
  authorId!: number;
}
// --- Fim Entidades ---

// Helper normalizeSql (**VERSÃO FORNECIDA PELO USUÁRIO - INTOCADA**)
const normalizeSql = (sql: string): string => {
  let result = sql;

  // Remove espaços em branco seguidos pela primeira quebra de linha no início
  result = result.replace(/^\s*\n/, "");

  // Remove a última quebra de linha seguida por espaços em branco no final
  result = result.replace(/\n\s*$/, "");

  return result;
};

describe("Queryable Paging Tests (Skip/Take)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
  });

  // **** Testes 1 a 12 (Inalterados) ****
  it("Teste Paging 1: should handle simple take", () => {
    const query = users.orderBy((u) => u.id).take(10);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[id] ASC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 2: should handle simple skip", () => {
    const query = users.orderBy((u) => u.id).skip(5);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[id] ASC
OFFSET 5 ROWS
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 3: should handle skip then take", () => {
    const query = users
      .orderBy((u) => u.name)
      .skip(10)
      .take(5);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 4: should handle take then skip (check generated SQL)", () => {
    const query = users
      .orderBy((u) => u.age)
      .take(10)
      .skip(5);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC
OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 5: should handle where, orderBy, skip, take", () => {
    const query = users
      .where((u) => u.age > 18)
      .orderByDescending((u) => u.email)
      .skip(2)
      .take(4);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE [t0].[age] > 18
ORDER BY [t0].[email] DESC
OFFSET 2 ROWS FETCH NEXT 4 ROWS ONLY
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 6: should handle take after select", () => {
    const query = users
      .select((u) => ({ Name: u.name, Age: u.age }))
      .orderBy((dto) => dto.Age)
      .take(3);
    const expectedSql = `
SELECT [t0].[name] AS [Name], [t0].[age] AS [Age]
FROM [Users] AS [t0]
ORDER BY [t0].[age] ASC
OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 7: should handle skip(0) and take(0)", () => {
    // Caso Skip 0
    const querySkip0 = users
      .orderBy((u) => u.id)
      .skip(0)
      .take(5);
    const expectedSqlSkip0 = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[id] ASC
OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
    `;
    const actualSqlSkip0 = querySkip0.toQueryString();
    expect(normalizeSql(actualSqlSkip0)).toEqual(
      normalizeSql(expectedSqlSkip0)
    );

    // Caso Take 0
    const queryTake0 = users
      .orderBy((u) => u.id)
      .skip(10)
      .take(0);
    const expectedSqlTake0 = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY [t0].[id] ASC
OFFSET 10 ROWS FETCH NEXT 0 ROWS ONLY
    `;
    const actualSqlTake0 = queryTake0.toQueryString();
    expect(normalizeSql(actualSqlTake0)).toEqual(
      normalizeSql(expectedSqlTake0)
    );
  });

  it("Teste Paging 8: should require ORDER BY for OFFSET/FETCH in SQL Server", () => {
    const query = users.skip(5).take(10);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
ORDER BY (SELECT NULL)
OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY
     `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY clause")
    );
    warnSpy.mockRestore();
  });

  it("Teste Paging 9: should throw error for negative skip", () => {
    expect(() => users.skip(-1)).toThrow("non-negative integer");
  });

  it("Teste Paging 10: should throw error for negative take", () => {
    expect(() => users.take(-5)).toThrow("non-negative integer");
  });

  it("Teste Paging 11: should throw error for non-integer skip", () => {
    expect(() => users.skip(1.5)).toThrow("non-negative integer");
  });

  it("Teste Paging 12: should throw error for non-integer take", () => {
    expect(() => users.take(3.14)).toThrow("non-negative integer");
  });

  // **** Teste Paging 13 (Inalterado - take(2) => COM COALESCE) ****
  it("Teste Paging 13: should handle skip/take inside subquery projection", () => {
    const query = users
      .provideScope({ posts })
      .select((u) => ({
        UserName: u.name,
        SecondAndThirdPostTitles: posts
          .where((p) => p.authorId === u.id)
          .orderBy((p) => p.postId)
          .skip(1)
          .take(2)
          .select((p) => p.title),
      }))
      .orderBy((uDto) => uDto.UserName);

    const expectedSql = `
SELECT [t0].[name] AS [UserName], JSON_QUERY(COALESCE((
    SELECT [t1].[title]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    ORDER BY [t1].[postId] ASC
    OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [SecondAndThirdPostTitles]
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
    `;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // **** Teste Paging 14 (Inalterado - sem take() => COM COALESCE) ****
  it("Teste Paging 14: should handle skip/take outside query with subquery projection", () => {
    const query = users
      .provideScope({ posts })
      .select((u) => ({
        UserName: u.name,
        AllPostTitles: posts
          .where((p) => p.authorId === u.id)
          .select((p) => p.title),
      }))
      .orderBy((uDto) => uDto.UserName)
      .skip(5)
      .take(10);

    const expectedSql = `
SELECT [t0].[name] AS [UserName], JSON_QUERY(COALESCE((
    SELECT [t1].[title]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [AllPostTitles]
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY
    `;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // **** NOVOS TESTES PARA WITHOUT_ARRAY_WRAPPER (SQL esperado CORRIGIDO) ****

  it("Teste Paging 15: should use WITHOUT_ARRAY_WRAPPER for subquery with take(1) and single column", () => {
    const query = users
      .provideScope({ posts })
      .select((u) => ({
        UserName: u.name,
        FirstPostTitle: posts
          .where((p) => p.authorId === u.id)
          .orderBy((p) => p.postId)
          .take(1)
          .select((p) => p.title),
      }))
      .orderBy((uDto) => uDto.UserName);

    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT [t1].[title]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    ORDER BY [t1].[postId] ASC
    OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
) AS [FirstPostTitle]
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 16: should use WITHOUT_ARRAY_WRAPPER for subquery with take(1) and multiple columns", () => {
    // CORRIGIDO: Deve usar wrapper
    const query = users
      .provideScope({ posts })
      .select((u) => ({
        UserName: u.name,
        FirstPostData: posts
          .where((p) => p.authorId === u.id)
          .orderBy((p) => p.postId)
          .take(1)
          .select((p) => ({
            Id: p.postId,
            Title: p.title,
          })),
      }))
      .orderBy((uDto) => uDto.UserName);

    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT [t1].[postId] AS [Id], [t1].[title] AS [Title]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    ORDER BY [t1].[postId] ASC
    OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
) AS [FirstPostData]
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 17: should use WITHOUT_ARRAY_WRAPPER for subquery with take(1) and wildcard projection", () => {
    // CORRIGIDO: Deve usar wrapper
    const query = users
      .provideScope({ posts })
      .select((u) => ({
        UserName: u.name,
        FirstPost: posts
          .where((p) => p.authorId === u.id)
          .orderBy((p) => p.postId)
          .take(1),
      }))
      .orderBy((uDto) => uDto.UserName);

    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT [t1].*
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    ORDER BY [t1].[postId] ASC
    OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
) AS [FirstPost]
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
    `;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 18: should NOT use WITHOUT_ARRAY_WRAPPER for subquery with take(2)", () => {
    const query = users
      .provideScope({ posts })
      .select((u) => ({
        UserName: u.name,
        FirstTwoTitles: posts
          .where((p) => p.authorId === u.id)
          .orderBy((p) => p.postId)
          .take(2)
          .select((p) => p.title),
      }))
      .orderBy((uDto) => uDto.UserName);

    const expectedSql = `
SELECT [t0].[name] AS [UserName], JSON_QUERY(COALESCE((
    SELECT [t1].[title]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    ORDER BY [t1].[postId] ASC
    OFFSET 0 ROWS FETCH NEXT 2 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [FirstTwoTitles]
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
    `;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Paging 19: should NOT use WITHOUT_ARRAY_WRAPPER for subquery without take", () => {
    const query = users
      .provideScope({ posts })
      .select((u) => ({
        UserName: u.name,
        AllTitles: posts
          .where((p) => p.authorId === u.id)
          .orderBy((p) => p.postId)
          .select((p) => p.title),
      }))
      .orderBy((uDto) => uDto.UserName);

    const expectedSql = `
SELECT [t0].[name] AS [UserName], JSON_QUERY(COALESCE((
    SELECT [t1].[title]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    ORDER BY [t1].[postId] ASC
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [AllTitles]
FROM [Users] AS [t0]
ORDER BY [t0].[name] ASC
    `; // CORRETO: sem take() => COM COALESCE, SEM WITHOUT_ARRAY_WRAPPER

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // **** FIM NOVOS TESTES ****
}); // Fim do describe

// --- END OF FILE src/__tests__/paging.test.ts ---
