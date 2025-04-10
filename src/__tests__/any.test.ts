import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions";
import { MethodCallExpression } from "../expressions";
import { LambdaParser } from "../parsing";
import { normalizeSql } from "./utils/testUtils";

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

describe("Queryable Any Operator Tests", () => {
  // Descrição padrão
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let lambdaParser: LambdaParser;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    lambdaParser = new LambdaParser();
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // **** TESTE SINCRONO ****
  it("Teste Any 1: should generate correct SQL for terminal any()", () => {
    const anyCallExpr = new MethodCallExpression("any", users.expression, []);
    const expectedSql = `
EXISTS (
    SELECT 1
    FROM [Users] AS [u]
)
    `;
    const actualSql = dbContext["queryProvider"].getQueryText(anyCallExpr);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    // **** CHAMADA SINCRONA ****
    expect(users.any()).toBe(true); // Simulado
  });

  // **** TESTE SINCRONO ****
  it("Teste Any 2: should generate correct SQL for terminal any(predicate)", () => {
    const predicate = (u: User) => u.age > 90;
    const lambda = lambdaParser.parse(predicate);
    const anyCallExpr = new MethodCallExpression("any", users.expression, [lambda]);
    const expectedSql = `
EXISTS (
    SELECT 1
    FROM [Users] AS [u]
    WHERE [u].[age] > 90
)
    `;
    const actualSql = dbContext["queryProvider"].getQueryText(anyCallExpr);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    // **** CHAMADA SINCRONA ****
    expect(users.any(predicate)).toBe(true); // Simulado
  });

  // **** TESTE SINCRONO ****
  it("Teste Any 3: should generate correct SQL for terminal any() after where()", () => {
    const filteredUsers = users.where((u) => u.name === "Alice");
    const anyCallExpr = new MethodCallExpression("any", filteredUsers.expression, []);
    const expectedSql = `
EXISTS (
    SELECT 1
    FROM [Users] AS [u]
    WHERE [u].[name] = 'Alice'
)
    `;
    const actualSql = dbContext["queryProvider"].getQueryText(anyCallExpr);
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
    // **** CHAMADA SINCRONA ****
    expect(filteredUsers.any()).toBe(true); // Simulado
  });

  // Teste 4 não chama any() terminalmente
  it("Teste Any 4: should generate correct SQL for non-terminal any() inside where()", () => {
    const query = users.provideScope({ posts }).where((u) => posts.where((p) => p.authorId === u.id).any()); // any() não-terminal

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
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Teste 5 não chama any() terminalmente
  it("Teste Any 5: should generate correct SQL for non-terminal any(predicate) inside where()", () => {
    const query = users.provideScope({ posts }).where(
      (u) => posts.where((p) => p.authorId === u.id).any((p) => p.title == "Specific Post") // any() não-terminal
    );

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
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
