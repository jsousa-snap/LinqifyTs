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
    const categoryIds = [1, 3, 5];
    const query = products
      .provideScope({ categoryIds })
      .where((p) => categoryIds.includes(p.id))
      .select((p) => p.name);

    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE [p].[id] IN (1, 3, 5)
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 2: should translate array.includes(column) with strings", () => {
    const targetCategories = ["Electronics", "Books"];
    const query = products
      .provideScope({ targetCategories })
      .where((p) => targetCategories.includes(p.category))
      .select((p) => p.name);

    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE [p].[category] IN ('Electronics', 'Books')
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 3: should translate array.includes() combined with other conditions (AND)", () => {
    const ids = [10, 20];
    const query = products
      .provideScope({ ids })
      .where((p) => ids.includes(p.id) && p.price > 50)
      .select((p) => p.name);

    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE [p].[id] IN (10, 20) AND [p].[price] > 50
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 4: should translate array.includes() combined with other conditions (OR)", () => {
    const names = ["Laptop", "Mouse"];
    const query = products
      .provideScope({ names })
      .where((p) => p.price < 10 || names.includes(p.name))
      .select((p) => p.name);

    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE [p].[price] < 10 OR [p].[name] IN ('Laptop', 'Mouse')
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste IN 5: should throw error during translation for empty array", () => {
    const emptyIds: number[] = [];
    expect(() => {
      products
        .provideScope({ emptyIds })
        .where((p) => emptyIds.includes(p.id))
        .select((p) => p.name)
        .toQueryString();
    }).toThrow(
      "Query Processing Failed during getQueryText: Erro de Tradução: O array fornecido para 'includes' (SQL IN) não pode estar vazio."
    );
  });

  // Teste de Regressão: Garantir que string.includes ainda funciona (não usa array externo)
  it("Teste IN 6: Regression - string.includes() should still generate LIKE", () => {
    const searchTerm = "pro";
    const query = products
      .provideScope({ searchTerm })
      .where((p) => p.name.includes(searchTerm))
      .select((p) => p.name);
    const expectedSql = `
SELECT [p].[name]
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
      .provideScope({ categoryIds })
      .where((p) => categoryIds.includes(p.id))
      .select((p) => p.name);

    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE [p].[id] IN (2, 4)
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
