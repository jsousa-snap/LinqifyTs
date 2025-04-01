// src/__tests__/exists.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions";
import {
  MethodCallExpression,
  LambdaExpression,
  Expression, // Import Expression
} from "../expressions";
import { LambdaParser } from "../parsing";
import { normalizeSql } from "./utils/testUtils"; // <<< IMPORTADO (caminho correto)

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

describe("Queryable Exists Operator Tests", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let lambdaParser: LambdaParser;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    lambdaParser = new LambdaParser();
  });

  // Testes 1, 2, 3 (Inalterados - devem passar após corrigir QueryProvider)
  it("Teste Exists 1: should generate correct SQL for terminal exists()", () => {
    const existsCallExpr = new MethodCallExpression(
      "exists",
      users.expression,
      []
    );
    const expectedSql = `
EXISTS (
    SELECT 1
    FROM [Users] AS [u]
)
    `;
    const actualSql = dbContext["queryProvider"].getQueryText(existsCallExpr);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    expect(users.exists()).toBe(true);
    warnSpy.mockRestore();
  });

  it("Teste Exists 2: should generate correct SQL for terminal exists(predicate)", () => {
    const predicate = (u: User) => u.age > 90;
    const lambda = lambdaParser.parse(predicate);
    const existsCallExpr = new MethodCallExpression(
      "exists",
      users.expression,
      [lambda]
    );
    const expectedSql = `
EXISTS (
    SELECT 1
    FROM [Users] AS [u]
    WHERE [u].[age] > 90
)
    `;
    const actualSql = dbContext["queryProvider"].getQueryText(existsCallExpr);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    expect(users.exists(predicate)).toBe(true);
    warnSpy.mockRestore();
  });

  it("Teste Exists 3: should generate correct SQL for terminal exists() after where()", () => {
    const filteredUsers = users.where((u) => u.name === "Alice");
    const existsCallExpr = new MethodCallExpression(
      "exists",
      filteredUsers.expression,
      []
    );
    const expectedSql = `
EXISTS (
    SELECT 1
    FROM [Users] AS [u]
    WHERE [u].[name] = 'Alice'
)
    `;
    const actualSql = dbContext["queryProvider"].getQueryText(existsCallExpr);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    expect(filteredUsers.exists()).toBe(true);
    warnSpy.mockRestore();
  });

  // **** Teste 4 MODIFICADO para usar provideScope ****
  it("Teste Exists 4: should generate correct SQL for non-terminal exists() inside where()", () => {
    // Passa 'posts' para o escopo da lambda 'where'
    const query = users
      .provideScope({ posts }) // <<< ADICIONADO
      .where((u) => posts.where((p) => p.authorId === u.id).exists()); // 'posts' agora é conhecido

    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE EXISTS (
        SELECT 1
        FROM [Posts] AS [p]
        WHERE [p].[authorId] = [u].[id]
    )
        `;
    const actualSql = query.toQueryString();
    // Removendo o alias 'exists_val' da expectativa, pois o gerador foi corrigido
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // **** Teste 5 MODIFICADO para usar provideScope ****
  it("Teste Exists 5: should generate correct SQL for non-terminal exists(predicate) inside where()", () => {
    // Passa 'posts' para o escopo da lambda 'where'
    const query = users
      .provideScope({ posts }) // <<< ADICIONADO
      .where((u) =>
        posts
          .where((p) => p.authorId === u.id)
          .exists((p) => p.title == "Specific Post")
      ); // 'posts' agora é conhecido

    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE EXISTS (
        SELECT 1
        FROM [Posts] AS [p]
        WHERE [p].[authorId] = [u].[id] AND [p].[title] = 'Specific Post'
    )
        `;
    const actualSql = query.toQueryString();
    // Removendo o alias 'exists_val' da expectativa
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
}); // Fim do describe
