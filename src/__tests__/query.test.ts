// --- START OF FILE src/__tests__/query.test.ts ---

// src/main.test.ts  (ou o caminho que preferir)

// Assumindo que DbContext e QueryableExtensions estão em locais acessíveis
// Ajuste os caminhos conforme a estrutura do seu projeto
import { DbContext } from "../core"; // Ex: './core/DbContext' ou similar
import "../query/QueryableExtensions"; // Importa para aplicar os métodos no protótipo
import { IQueryable } from "../interfaces"; // Se necessário para tipagem
import { normalizeSql } from "./utils/testUtils"; // <<< IMPORTADO (caminho correto)

// --- Interfaces/Classes de Entidade (Copie ou importe-as) ---
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  departmentId?: number | null; // <<< Deixamos aqui caso outros testes usem
}
class UserEntity implements User {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
  departmentId?: number | null;
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
interface Profile {
  profileId: number;
  userId: number;
  bio: string;
  website?: string;
}
class ProfileEntity implements Profile {
  profileId!: number;
  userId!: number;
  bio!: string;
  website?: string;
}
interface Category {
  categoryId: number;
  name: string;
}
class CategoryEntity implements Category {
  categoryId!: number;
  name!: string;
}
interface PostCategory {
  postId: number;
  categoryId: number;
}
class PostCategoryEntity implements PostCategory {
  postId!: number;
  categoryId!: number;
}
// *** NOVA INTERFACE PARA TESTE LEFT JOIN ***
interface Department {
  deptId: number;
  deptName: string;
}
// --- Fim Entidades ---

describe("Queryable Extensions Tests (EF Core Formatting)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let profiles: IQueryable<Profile>;
  let categories: IQueryable<Category>;
  let postCategories: IQueryable<PostCategory>;
  let departments: IQueryable<Department>; // <<< NOVO DbSet

  // Setup antes de cada teste no bloco 'describe'
  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    profiles = dbContext.set<Profile>("Profiles");
    categories = dbContext.set<Category>("Categories");
    postCategories = dbContext.set<PostCategory>("PostCategories");
    departments = dbContext.set<Department>("Departments"); // <<< Inicializa DbSet

    // Mock console.warn para evitar poluir a saída do teste
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    // Restaura mocks
    jest.restoreAllMocks();
  });

  // --- Testes de Select e Where ---
  it("Teste 1: should handle simple select", () => {
    const nameQuery = users.select((u) => u.name);
    const expectedSql = `
SELECT [u].[name]
FROM [Users] AS [u]
    `;
    const actualSql = nameQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 2: should handle simple where", () => {
    const oldUsersQuery = users.where((u) => u.age > 30);
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[age] > 30
    `;
    const actualSql = oldUsersQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 3: should handle where with string equality", () => {
    const aliceQuery = users.where((u) => u.name == "Alice");
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[name] = 'Alice'
    `;
    const actualSql = aliceQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 4: should handle select with object projection", () => {
    const dtoQuery = users.select((u) => ({ UserId: u.id, UserName: u.name }));
    const expectedSql = `
SELECT [u].[id] AS [UserId], [u].[name] AS [UserName]
FROM [Users] AS [u]
    `;
    const actualSql = dtoQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 5: should handle combined where and select", () => {
    const youngUserNamesQuery = users
      .where((u) => u.age < 25)
      .select((u) => u.name);
    const expectedSql = `
SELECT [u].[name]
FROM [Users] AS [u]
WHERE [u].[age] < 25
    `;
    const actualSql = youngUserNamesQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 6: should handle where and select with projection", () => {
    const seniorDtoQuery = users
      .where((u) => u.age >= 65)
      .select((u) => ({ Name: u.name, Contact: u.email }));
    const expectedSql = `
SELECT [u].[name] AS [Name], [u].[email] AS [Contact]
FROM [Users] AS [u]
WHERE [u].[age] >= 65
    `;
    const actualSql = seniorDtoQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 7: should handle where with logical AND", () => {
    const specificUserQuery = users.where((u) => u.age > 20 && u.name == "Bob");
    const expectedSql = `
SELECT [u].*
FROM [Users] AS [u]
WHERE [u].[age] > 20 AND [u].[name] = 'Bob'
    `;
    const actualSql = specificUserQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // --- Fim Testes de Select e Where ---

  // --- Teste Subquery ---
  it("Teste 8: Subquery should handle subquery using provideScope (expecting JSON)", () => {
    const subQueryTest = users
      .provideScope({ posts, categories }) // categories é [c]
      .select((user) => ({
        // user é [u]
        nome: user.name,
        postsList: posts // posts é [p]
          .where((post) => post.authorId === user.id)
          .select((post) => ({
            // post interno é [p] (ou pode ser [p1] dependendo se o contexto é reiniciado) - Assumindo [p] por simplicidade na expectativa
            title: post.title,
            categories: categories.select((c) => c.name), // categories interno é [c], param c é [c1]
          })),
      }));

    // **EXPECTED SQL COM ALIAS CORRIGIDOS**
    const expectedSql = `
SELECT [u].[name] AS [nome], JSON_QUERY(COALESCE((
    SELECT [p].[title], JSON_QUERY(COALESCE((
        SELECT [c].[name]
        FROM [Categories] AS [c]
        FOR JSON PATH, INCLUDE_NULL_VALUES
    ), '[]')) AS [categories]
    FROM [Posts] AS [p]
    WHERE [p].[authorId] = [u].[id]
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [postsList]
FROM [Users] AS [u]`;

    const actualSql = subQueryTest.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 9: should handle simple ternary operator in select (CASE WHEN)", () => {
    const youngUserNamesQuery = users
      .where((u) => u.age < 25)
      .select(
        (u) => (u.name.startsWith("a") ? "Começa com A" : "Não começa A") // Operador ternário simples
      );
    const expectedSql = `
SELECT CASE WHEN [u].[name] LIKE 'a%' THEN 'Começa com A' ELSE 'Não começa A' END AS [expr0]
FROM [Users] AS [u]
WHERE [u].[age] < 25
    `;
    const actualSql = youngUserNamesQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 10: should handle nested ternary operator in select (Nested CASE WHEN)", () => {
    const youngUserNamesQuery = users
      .where((u) => u.age < 25)
      .select((u) =>
        // Operadores ternários aninhados
        u.name.startsWith("a")
          ? "Começa com A"
          : u.name.startsWith("b")
          ? "Começa com B"
          : "Não começa com A ou B"
      );
    const expectedSql = `
SELECT CASE WHEN [u].[name] LIKE 'a%' THEN 'Começa com A' ELSE CASE WHEN [u].[name] LIKE 'b%' THEN 'Começa com B' ELSE 'Não começa com A ou B' END END AS [expr0]
FROM [Users] AS [u]
WHERE [u].[age] < 25
    `;
    const actualSql = youngUserNamesQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 11: should handle nested ternary operator in object projection (Nested CASE WHEN)", () => {
    const youngUserNamesQuery = users
      .where((u) => u.age < 25)
      .select((u) => ({
        // Operador ternário dentro de uma projeção de objeto
        category: u.name.startsWith("a") // Usando 'category' como alias
          ? "Começa com A"
          : u.name.startsWith("b")
          ? "Começa com B"
          : "Não começa com A ou B",
      }));
    const expectedSql = `
SELECT CASE WHEN [u].[name] LIKE 'a%' THEN 'Começa com A' ELSE CASE WHEN [u].[name] LIKE 'b%' THEN 'Começa com B' ELSE 'Não começa com A ou B' END END AS [category]
FROM [Users] AS [u]
WHERE [u].[age] < 25
    `;
    const actualSql = youngUserNamesQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 12: should handle identity select (x => x)", () => {
    const nameQuery = users.select((u) => u.name).select((result) => result);
    const expectedSql = `
SELECT [u].[name]
FROM [Users] AS [u]
    `;
    const actualSql = nameQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});

// --- END OF FILE src/__tests__/query.test.ts ---
