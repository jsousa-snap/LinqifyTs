// --- START OF FILE src/__tests__/in.test.ts ---
import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions
import { normalizeSql } from "./utils/testUtils";

// --- Interfaces ---
interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}
// --- Fim Interfaces ---

describe("Queryable IN Operator (Array.includes) Tests", () => {
  let dbContext: DbContext;
  let products: IQueryable<Product>;

  beforeEach(() => {
    dbContext = new DbContext();
    products = dbContext.set<Product>("Products");
  });

  it("Teste IN 1: should translate array.includes(column) with numbers", () => {
    const categoryIds = [1, 3, 5]; // Array local
    const query = products
      .provideScope({ categoryIds }) // <<< Passa o array para o escopo
      .where((p) => categoryIds.includes(p.id)); // <<< Lambda usa a variável do escopo

    const expectedSql = `
SELECT [p].*
FROM [Products] AS [p]
WHERE [p].[id] IN (1, 3, 5)
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 2: should translate array.includes(column) with strings", () => {
    const targetCategories = ["Electronics", "Books"]; // Array local
    const query = products
      .provideScope({ targetCategories }) // <<< Passa o array para o escopo
      .where((p) => targetCategories.includes(p.category)); // <<< Lambda usa a variável do escopo

    const expectedSql = `
SELECT [p].*
FROM [Products] AS [p]
WHERE [p].[category] IN ('Electronics', 'Books')
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 3: should translate array.includes() combined with other conditions (AND)", () => {
    const ids = [10, 20]; // Array local
    const query = products
      .provideScope({ ids }) // <<< Passa o array para o escopo
      .where((p) => ids.includes(p.id) && p.price > 50); // <<< Lambda usa a variável do escopo

    const expectedSql = `
SELECT [p].*
FROM [Products] AS [p]
WHERE [p].[id] IN (10, 20) AND [p].[price] > 50
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 4: should translate array.includes() combined with other conditions (OR)", () => {
    const names = ["Laptop", "Mouse"]; // Array local
    const query = products
      .provideScope({ names }) // <<< Passa o array para o escopo
      .where((p) => p.price < 10 || names.includes(p.name)); // <<< Lambda usa a variável do escopo

    const expectedSql = `
SELECT [p].*
FROM [Products] AS [p]
WHERE [p].[price] < 10 OR [p].[name] IN ('Laptop', 'Mouse')
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 5: should throw error during translation for empty array", () => {
    const emptyIds: number[] = []; // Array local vazio
    // O erro deve ocorrer ao tentar traduzir (criar SqlInExpression), não ao gerar SQL.
    expect(() => {
      products
        .provideScope({ emptyIds }) // <<< Passa o array vazio para o escopo
        .where((p) => emptyIds.includes(p.id)) // <<< Lambda usa a variável do escopo
        .toQueryString(); // Tentativa de tradução/geração
    }).toThrow(
      "Query Processing Failed: Translation Error: Array provided to 'includes' (for SQL IN) cannot be empty."
    ); // Verifica a mensagem de erro do construtor SqlInExpression
  });

  // Teste de Regressão: Garantir que string.includes ainda funciona (não usa array externo)
  it("Teste IN 6: Regression - string.includes() should still generate LIKE", () => {
    const searchTerm = "pro";
    const query = products
      .provideScope({ searchTerm })
      // Não precisa de provideScope aqui, pois searchTerm não é usado na lambda
      .where((p) => p.name.includes(searchTerm)); // <<< Usa string.includes diretamente
    const expectedSql = `
SELECT [p].*
FROM [Products] AS [p]
WHERE [p].[name] LIKE '%pro%'
        `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Teste com valor vindo do provideScope já estava correto conceitualmente,
  // mas agora está consistente com os outros.
  it("Teste IN 7: should translate array.includes() with array from provideScope", () => {
    const categoryIds = [2, 4];
    const query = products
      .provideScope({ categoryIds }) // <<< Passa o array via escopo
      .where((p) => categoryIds.includes(p.id)); // <<< Lambda usa a variável do escopo

    const expectedSql = `
SELECT [p].*
FROM [Products] AS [p]
WHERE [p].[id] IN (2, 4)
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/in.test.ts ---
