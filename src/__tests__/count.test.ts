// --- START OF FILE src/__tests__/count.test.ts ---

// src/__tests__/count.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions

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

const normalizeSql = (sql: string): string => {
  let result = sql;

  // Remove espaços em branco seguidos pela primeira quebra de linha no início
  result = result.replace(/^\s*\n/, "");

  // Remove a última quebra de linha seguida por espaços em branco no final
  result = result.replace(/\n\s*$/, "");

  return result;
};

describe("Queryable Count Operator Tests", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
  });

  it("Teste Count 1: should generate correct SQL for simple count()", () => {
    const query = users; // Base query
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
    `;
    // Verifica o SQL gerado pela expressão correspondente
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression,
        []
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    // Verifica a execução (simulada)
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(); // Silencia o warning da simulação
    expect(query.count()).toBe(10); // Valor simulado retornado pelo provider.execute
    warnSpy.mockRestore();
  });

  it("Teste Count 2: should generate correct SQL for count(predicate)", () => {
    const predicate = (u: User) => u.age > 30;
    const query = users; // Base query
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
WHERE [u].[age] > 30
    `;
    // Verifica o SQL gerado pela expressão correspondente
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

    // Verifica a execução (simulada)
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    expect(query.count(predicate)).toBe(10);
    warnSpy.mockRestore();
  });

  it("Teste Count 3: should generate correct SQL for count() after where()", () => {
    const query = users.where((u) => u.name === "Alice");
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
WHERE [u].[name] = 'Alice'
    `;
    // Verifica o SQL gerado pela expressão correspondente
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression, // Expressão já contém o WHERE
        []
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    // Verifica a execução (simulada)
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    expect(query.count()).toBe(10);
    warnSpy.mockRestore();
  });

  it("Teste Count 4: should generate correct SQL for count(predicate) after where()", () => {
    const predicate = (u: User) => u.age < 25;
    const query = users.where((u) => u.name.includes("a")); // WHERE inicial
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
WHERE (([u].[name] LIKE '%a%') AND [u].[age] < 25)
    `;
    // Verifica o SQL gerado pela expressão correspondente
    const predicateLambda = new (require("../parsing").LambdaParser)().parse(
      predicate
    );
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression, // Expressão já contém o WHERE inicial
        [predicateLambda] // Predicado adicional
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    // Verifica a execução (simulada)
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    expect(query.count(predicate)).toBe(10);
    warnSpy.mockRestore();
  });

  it("Teste Count 5: should generate correct SQL for count() after select() (should ignore projection)", () => {
    // O COUNT deve operar sobre a fonte *antes* da projeção
    const query = users.select((u) => ({ nameOnly: u.name }));
    const expectedSql = `
SELECT COUNT_BIG(1) AS [count_result]
FROM [Users] AS [u]
    `;
    // Verifica o SQL gerado pela expressão correspondente
    const countExpression =
      new (require("../expressions").MethodCallExpression)(
        "count",
        query.expression, // Expressão contém o SELECT
        []
      );
    const actualSql = dbContext["queryProvider"].getQueryText(countExpression);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    // Verifica a execução (simulada)
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    expect(query.count()).toBe(10);
    warnSpy.mockRestore();
  });

  it("Teste Count 6: should generate correct SQL for count() in subquery", () => {
    // O COUNT deve operar sobre a fonte *antes* da projeção
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
    const actualSql = query.toQueryString(); // Armazena o resultado
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql)); // Compara
  });
});
// --- END OF FILE src/__tests__/count.test.ts ---
