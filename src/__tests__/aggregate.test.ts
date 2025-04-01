// --- START OF FILE src/__tests__/aggregate.test.ts ---

// src/__tests__/aggregate.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions
import { normalizeSql } from "./utils/testUtils"; // <<< IMPORTADO (caminho correto)

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

// normalizeSql REMOVIDO DAQUI

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
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
    `;
    expect(query).toBe(42.5); // Simulado
    const avgExpression = new (require("../expressions").MethodCallExpression)(
      "avg",
      users.expression,
      [new (require("../parsing").LambdaParser)().parse((u: User) => u.age)]
    );
    const actualSql = dbContext["queryProvider"].getQueryText(avgExpression);
    // Usa a função importada
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Aggregate 2: should generate correct SQL for avg() after where()", () => {
    const query = users.where((u) => u.name === "Alice").avg((u) => u.age);
    const expectedSql = `
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
WHERE [u].[name] = 'Alice'
    `;
    expect(query).toBe(42.5); // Simulado
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
SELECT AVG([u].[salary]) AS [avg_result]
FROM [Users] AS [u]
    `;
    expect(query).toBe(42.5); // Simulado
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
SELECT SUM([p].[views]) AS [sum_result]
FROM [Posts] AS [p]
    `;
    expect(query).toBe(1234); // Simulado
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
SELECT SUM([p].[views]) AS [sum_result]
FROM [Posts] AS [p]
WHERE [p].[authorId] = 1
    `;
    expect(query).toBe(1234); // Simulado
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
SELECT MIN([u].[age]) AS [min_result]
FROM [Users] AS [u]
    `;
    expect(query).toBe(1); // Simulado
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
SELECT MIN([u].[name]) AS [min_result]
FROM [Users] AS [u]
    `;
    expect(query).toBe(1); // Simulado (retorno genérico)
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
SELECT MAX([p].[views]) AS [max_result]
FROM [Posts] AS [p]
    `;
    expect(query).toBe(99); // Simulado
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
SELECT MAX([u].[age]) AS [max_result]
FROM [Users] AS [u]
WHERE [u].[age] < 30
    `;
    expect(query).toBe(99); // Simulado
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
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
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

  it("Teste Aggregate 12 (Subquery): should generate correct SQL for sum() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      TotalPostViews: posts
        .where((p) => p.authorId === u.id)
        .sum((p) => p.views),
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

  it("Teste Aggregate 13 (Subquery): should generate correct SQL for min() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      MinPostViews: posts.where((p) => p.authorId === u.id).min((p) => p.views),
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

  it("Teste Aggregate 14 (Subquery): should generate correct SQL for max() in projection", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      MaxPostViews: posts.where((p) => p.authorId === u.id).max((p) => p.views),
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
SELECT AVG([u].[age]) AS [avg_result]
FROM [Users] AS [u]
WHERE EXISTS (
        SELECT 1
        FROM [Posts] AS [p]
        WHERE [p].[authorId] = [u].[id] AND [p].[views] > 50
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
