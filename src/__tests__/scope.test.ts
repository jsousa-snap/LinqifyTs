// Em src/__tests__/scope.test.ts (ou adicione ao exists.test.ts)

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions";

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

// Helper normalizeSql
const normalizeSql = (sql: string): string => {
  let result = sql;

  // Remove espaços em branco seguidos pela primeira quebra de linha no início
  result = result.replace(/^\s*\n/, "");

  // Remove a última quebra de linha seguida por espaços em branco no final
  result = result.replace(/\n\s*$/, "");

  return result;
};

describe("Queryable ProvideScope Tests", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
  });

  it("Teste Scope 1: should handle scalar value in scope for where clause", () => {
    const searchName = "Bob";
    const minAge = 25;

    const query = users
      .provideScope({ searchName, minAge }) // Passa string e número
      .where((u) => u.name === searchName && u.age >= minAge); // Usa os valores do escopo

    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE ([t0].[name] = 'Bob' AND [t0].[age] >= 25)
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Scope 2: should handle mixed IQueryable and scalar values in scope", () => {
    const specificTitle = "Specific Post";

    // Teste original do exists não-terminal, mas agora com provideScope
    const query = users
      .provideScope({ posts, specificTitle }) // Passa IQueryable e string
      .where((u) =>
        posts
          .where((p) => p.authorId === u.id)
          .exists((p) => p.title == specificTitle)
      );

    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE EXISTS (
        SELECT 1
        FROM [Posts] AS [t1]
        WHERE ([t1].[authorId] = [t0].[id] AND [t1].[title] = 'Specific Post')
    )
        `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Teste para o seu exemplo original (usando 'includes' - ainda pode falhar se includes não for traduzido)
  it("Teste Scope 3: should handle scalar value with includes translated to LIKE", () => {
    const searchTerm = "usuario1";
    const query = users
      .provideScope({ searchTerm }) // Só precisa do searchTerm aqui
      .where((u) => u.name.includes(searchTerm));

    // Agora esperamos LIKE
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE ([t0].[name] LIKE '%usuario1%')
      `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Adicionar teste para caracteres especiais no includes
  it("Teste Scope 4: should handle includes with special LIKE characters", () => {
    const searchTerm = "user%"; // Contém %
    const query = users
      .provideScope({ searchTerm })
      .where((u) => u.name.includes(searchTerm));

    // Esperamos que o % seja escapado no padrão
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE ([t0].[name] LIKE '%user[%]%')
      `; // Nota: o % do termo é escapado como [%]
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Scope 5: should handle includes with underscore", () => {
    const searchTerm = "user_1"; // Contém _
    const query = users
      .provideScope({ searchTerm })
      .where((u) => u.name.includes(searchTerm));

    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE ([t0].[name] LIKE '%user[_]1%')
      `; // Nota: o _ é escapado como [_]
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
