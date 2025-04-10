// --- START OF FILE src/__tests__/functions.test.ts ---

// src/__tests__/functions.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions
import { normalizeSql } from "./utils/testUtils"; // Importa a função padrão

// --- Interfaces ---
interface User {
  id: number;
  name: string;
  email: string;
  registrationDate: Date;
  lastLogin: Date | null;
  // Adiciona propriedades para teste de acesso direto (se suportado pelo visitor)
  // get Year(): number { return this.registrationDate.getFullYear(); } // Exemplo se fosse getter JS
}

interface Product {
  productId: number;
  description: string;
  price: number;
  category: string | null;
}
// --- Fim Interfaces ---

describe("Queryable SQL Function Translation Tests", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let products: IQueryable<Product>;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    products = dbContext.set<Product>("Products");
    // Remove mock de console.warn, pois não é mais esperado para getMonth
    // jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // jest.restoreAllMocks(); // Não necessário se não houver mock
  });

  // --- String Functions ---
  it("Teste Func 1: should translate string.toUpperCase()", () => {
    const query = users.where((u) => u.name.toUpperCase() === "ALICE");
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE UPPER([u].[name]) = 'ALICE'`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 2: should translate string.toLowerCase()", () => {
    const query = users.where((u) => u.email.toLowerCase() === "bob@example.com");
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE LOWER([u].[email]) = 'bob@example.com'`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 3: should translate string.startsWith()", () => {
    const query = users.where((u) => u.email.startsWith("alice@"));
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[email] LIKE 'alice@%'`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 4: should translate string.endsWith()", () => {
    const query = users.where((u) => u.email.endsWith(".org"));
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[email] LIKE '%.org'`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 5: should translate string.includes() (contains)", () => {
    const query = users.where((u) => u.name.includes("b"));
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] LIKE '%b%'`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 6: should translate string.trim()", () => {
    const query = users.where((u) => u.email.trim() === "contact@site.com");
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE TRIM([u].[email]) = 'contact@site.com'`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 7: should translate string.substring(start) to end", () => {
    const queryImplicitLen = users.where((u) => u.name.substring(1) === "lice");
    // CORRIGIDO: Espera SUBSTRING com índice 2 (JS 1 -> SQL 2) e comprimento grande (ex: 8000)
    const expectedImplicitLen = `
SELECT [u].*
FROM [Users] AS [u]
WHERE SUBSTRING([u].[name], 2, 8000) = 'lice'`;
    const actualSql = queryImplicitLen.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedImplicitLen));
  });

  it("Teste Func 8: should translate string.substring(start, length)", () => {
    // CORRIGIDO: Ajustado LINQ e SQL esperado para consistência. Testando pegar 2 chars a partir do índice 1 (SQL índice 2)
    const query = users.where((u) => u.name.substring(1, 2) === "li");
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE SUBSTRING([u].[name], 2, 2) = 'li'`; // start=2, length=2
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 9: should translate string.length", () => {
    const query = users.where((u) => u.name.length > 5);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE LEN([u].[name]) > 5`; // ou LENGTH dependendo do dialeto SQL
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 10: should handle LIKE special characters in string methods", () => {
    const queryStartsWith = users.where((u) => u.name.startsWith("A%"));
    const expectedStartsWith = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] LIKE 'A[%]%'`; // Correto
    const actualSqlStartsWith = queryStartsWith.toQueryString();
    expect(normalizeSql(actualSqlStartsWith)).toEqual(normalizeSql(expectedStartsWith));

    const queryEndsWith = users.where((u) => u.name.endsWith("_"));
    const expectedEndsWith = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] LIKE '%[_]'`; // Correto
    const actualSqlEndsWith = queryEndsWith.toQueryString();
    expect(normalizeSql(actualSqlEndsWith)).toEqual(normalizeSql(expectedEndsWith));

    const queryIncludes = users.where((u) => u.name.includes("["));
    const expectedIncludes = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] LIKE '%[[]%'`; // Correto
    const actualSqlIncludes = queryIncludes.toQueryString();
    expect(normalizeSql(actualSqlIncludes)).toEqual(normalizeSql(expectedIncludes));
  });

  // --- Date Functions ---
  it("Teste Func 11: should translate date.getFullYear()", () => {
    const query = users.where((u) => u.registrationDate.getFullYear() === 2023);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE YEAR([u].[registrationDate]) = 2023`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 12: should translate date.getMonth() (JS=0-11)", () => {
    const query = users.where((u) => u.registrationDate.getMonth() === 0); // Janeiro (JS=0)
    // CORRIGIDO: Espera SQL que gera 0-11 (MONTH(...) - 1) e compara com 0
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE MONTH([u].[registrationDate]) - 1 = 0`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    // expect(console.warn).not.toHaveBeenCalled(); // Não deve mais haver warning
  });

  it("Teste Func 13: should translate date.getDate()", () => {
    const query = users.where((u) => u.registrationDate.getDate() === 15);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE DAY([u].[registrationDate]) = 15`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 14: should translate date.getHours()", () => {
    const query = users.where((u) => u.registrationDate.getHours() === 10);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE DATEPART(hour, [u].[registrationDate]) = 10`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 15: should translate date.getMinutes()", () => {
    const query = users.where((u) => u.registrationDate.getMinutes() === 30);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE DATEPART(minute, [u].[registrationDate]) = 30`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Func 16: should translate date.getSeconds()", () => {
    const query = users.where((u) => u.registrationDate.getSeconds() < 10);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE DATEPART(second, [u].[registrationDate]) < 10`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // CORRIGIDO: Assumindo que o visitor mapeia acesso a propriedade .Year via visitMember -> mapPropertyToSqlFunction
  it("Teste Func 17: should translate property access date.Year", () => {
    // Use uma expressão que o parser TS/JS entenda como acesso a membro 'Year'
    // NOTA: Isso pode requerer que 'Year' exista na interface ou um type assertion,
    // ou que o parser LINQ seja robusto o suficiente. Usando type assertion aqui.
    const query = users.where((u) => (u.registrationDate as any).Year === 2022);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE YEAR([u].[registrationDate]) = 2022`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // --- Nullable Checks ---
  it("Teste Func 18: should handle nullable date property access", () => {
    // Testando getFullYear em tipo nullable (requer ! ou verificação prévia)
    const query = users.where((u) => u.lastLogin!.getFullYear() === 2024);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE YEAR([u].[lastLogin]) = 2024`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    // Testando com verificação explícita de não nulo
    const queryNotNull = users.where((u) => u.lastLogin != null && u.lastLogin.getFullYear() === 2024);
    const expectedNotNull = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[lastLogin] IS NOT NULL AND YEAR([u].[lastLogin]) = 2024`;
    const actualSqlNotNull = queryNotNull.toQueryString();
    expect(normalizeSql(actualSqlNotNull)).toEqual(normalizeSql(expectedNotNull));
  });

  it("Teste Func 19: should handle nullable string property access", () => {
    const query = products.where((p) => p.category!.toUpperCase() === "TECH");
    const expectedSql = `
SELECT [p].*
FROM [Products] AS [p]
WHERE UPPER([p].[category]) = 'TECH'`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));

    const queryNotNull = products.where((p) => p.category != null && p.category.startsWith("Ele"));
    const expectedNotNull = `
SELECT [p].*
FROM [Products] AS [p]
WHERE [p].[category] IS NOT NULL AND [p].[category] LIKE 'Ele%'`;
    const actualSqlNotNull = queryNotNull.toQueryString();
    expect(normalizeSql(actualSqlNotNull)).toEqual(normalizeSql(expectedNotNull));
  });

  // --- Combinações ---
  it("Teste Func 20: should translate combined string and date functions", () => {
    // Usando getMonth() que gera (MONTH(...) - 1)
    const query = users.where(
      (u) => u.email.toLowerCase().endsWith("@test.com") && u.registrationDate.getMonth() === 10 // Novembro (JS=10)
    );
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE LOWER([u].[email]) LIKE '%@test.com' AND MONTH([u].[registrationDate]) - 1 = 10`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/functions.test.ts ---
