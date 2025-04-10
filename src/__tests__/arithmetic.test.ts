import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions
import { normalizeSql } from "./utils/testUtils";

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
}

interface Order {
  orderId: number;
  productId: number;
  quantity: number;
  discount: number;
}

describe("Queryable Arithmetic Operator Tests", () => {
  let dbContext: DbContext;
  let products: IQueryable<Product>;
  let orders: IQueryable<Order>;

  beforeEach(() => {
    dbContext = new DbContext();
    products = dbContext.set<Product>("Products");
    orders = dbContext.set<Order>("Orders");
  });

  it("Teste Arit 1: should handle addition in select", () => {
    const query = products.select((p) => ({
      Name: p.name,
      PriceWithTax: p.price + 5.0,
    }));
    const expectedSql = `
SELECT [p].[name] AS [Name], [p].[price] + 5 AS [PriceWithTax]
FROM [Products] AS [p]`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 2: should handle multiplication in select", () => {
    const query = products.select((p) => ({
      Name: p.name,
      IncreasedPrice: p.price * 1.1,
    }));
    const expectedSql = `
SELECT [p].[name] AS [Name], [p].[price] * 1.1 AS [IncreasedPrice]
FROM [Products] AS [p]`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 3: should handle subtraction and division in select", () => {
    const query = orders.select((o) => ({
      Id: o.orderId,
      FinalPrice: o.quantity * (100.0 - o.discount / 2), // Exemplo arbitrário
    }));
    // Precedência: / antes de -, * antes de -
    const expectedSql = `
SELECT [o].[orderId] AS [Id], [o].[quantity] * (100 - [o].[discount] / 2) AS [FinalPrice]
FROM [Orders] AS [o]`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 4: should handle combined arithmetic with precedence", () => {
    const query = products.select((p) => ({
      Val: p.price + p.stock * 2 - 10 / 5,
    }));
    // Precedência: * e / antes de + e -
    const expectedSql = `
SELECT [p].[price] + [p].[stock] * 2 - 10 / 5 AS [Val]
FROM [Products] AS [p]`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 5: should handle addition in where", () => {
    const query = products.where((p) => p.stock + 10 > 50).select((p) => p.name);
    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE [p].[stock] + 10 > 50`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 6: should handle multiplication in where", () => {
    const query = orders.where((o) => o.quantity * 10.0 <= 100.0).select((o) => o.quantity);
    const expectedSql = `
SELECT [o].[quantity]
FROM [Orders] AS [o]
WHERE [o].[quantity] * 10 <= 100`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 7: should handle combined arithmetic and logical operators in where", () => {
    const query = products
      .where((p) => (p.price * 1.05 > 200.0 && p.stock > 0) || p.category == "SALE")
      .select((p) => p.name);
    // Precedência: * > && > ||
    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE [p].[price] * 1.05 > 200 AND [p].[stock] > 0 OR [p].[category] = 'SALE'`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 8: should handle arithmetic with constants on both sides", () => {
    const query = products.where((p) => 10 * p.stock > p.price / 2).select((p) => p.name);
    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE 10 * [p].[stock] > [p].[price] / 2`;
    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Arit 9: should handle combined arithmetic and logical operators in where", () => {
    const query = products
      .where((p) => (p.category == "SALE" || p.category == "SS") && p.price * 1.05 > 200.0 && p.stock > 0)
      .select((p) => p.name);
    const expectedSql = `
SELECT [p].[name]
FROM [Products] AS [p]
WHERE ([p].[category] = 'SALE' OR [p].[category] = 'SS') AND [p].[price] * 1.05 > 200 AND [p].[stock] > 0`;

    expect(normalizeSql(query.toQueryString())).toEqual(normalizeSql(expectedSql));
  });
});
