import { DbContext } from "../core";
import "../query/QueryableExtensions";
import { IQueryable } from "../interfaces";
import { normalizeSql } from "./utils/testUtils";

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  departmentId?: number | null;
}
interface Post {
  postId: number;
  title: string;
  authorId: number;
}
interface Profile {
  profileId: number;
  userId: number;
  bio: string;
  website?: string;
}
interface Category {
  categoryId: number;
  name: string;
}
interface PostCategory {
  postId: number;
  categoryId: number;
}
interface Department {
  deptId: number;
  deptName: string;
}

describe("Queryable Extensions Tests (EF Core Formatting)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let profiles: IQueryable<Profile>;
  let categories: IQueryable<Category>;
  let postCategories: IQueryable<PostCategory>;
  let departments: IQueryable<Department>;

  // Setup antes de cada teste no bloco 'describe'
  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    profiles = dbContext.set<Profile>("Profiles");
    categories = dbContext.set<Category>("Categories");
    postCategories = dbContext.set<PostCategory>("PostCategories");
    departments = dbContext.set<Department>("Departments");

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
    const oldUsersQuery = users.where((u) => u.age > 30).select((u) => u.name);
    const expectedSql = `
SELECT [u].[name]
FROM [Users] AS [u]
WHERE [u].[age] > 30
    `;
    const actualSql = oldUsersQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 3: should handle where with string equality", () => {
    const aliceQuery = users.where((u) => u.name == "Alice").select((u) => u.name);
    const expectedSql = `
SELECT [u].[name]
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
    const youngUserNamesQuery = users.where((u) => u.age < 25).select((u) => u.name);
    const expectedSql = `
SELECT [u].[name]
FROM [Users] AS [u]
WHERE [u].[age] < 25
    `;
    const actualSql = youngUserNamesQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 6: should handle where and select with projection", () => {
    const seniorDtoQuery = users.where((u) => u.age >= 65).select((u) => ({ Name: u.name, Contact: u.email }));
    const expectedSql = `
SELECT [u].[name] AS [Name], [u].[email] AS [Contact]
FROM [Users] AS [u]
WHERE [u].[age] >= 65
    `;
    const actualSql = seniorDtoQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 7: should handle where with logical AND", () => {
    const specificUserQuery = users.where((u) => u.age > 20 && u.name == "Bob").select((u) => u.name);
    const expectedSql = `
SELECT [u].[name]
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
        u.name.startsWith("a") ? "Começa com A" : u.name.startsWith("b") ? "Começa com B" : "Não começa com A ou B"
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

  it("Teste 13: should handle query join with subquery with join", () => {
    const query = users
      .provideScope({ posts, postCategories, profiles })
      .join(
        departments,
        (user) => user.departmentId,
        (department) => department.deptId,
        (user, department) => ({
          user,
          department,
        })
      )
      .select((result) => ({
        UserName: result.user.name,
        Department: result.department.deptName,
        ProfileInfo: profiles
          .where((profile) => profile.userId === result.user.id)
          .select((profile) => ({
            Id: profile.profileId,
            Bio: profile.bio,
            Website: profile.website,
          }))
          .firstOrDefault(),
        Posts: posts
          .join(
            postCategories,
            (post) => post.postId,
            (category) => category.postId,
            (post, category) => ({
              post,
              category,
            })
          )
          .where((postResult) => postResult.post.authorId === result.user.id)
          .select((postResult) => ({
            Id: postResult.post.postId,
            PostTitle: postResult.post.title,
            PostCategoryId: postResult.category.categoryId,
          })),
      }));

    const expectedSql = `
SELECT [u].[name] AS [UserName], [d].[deptName] AS [Department], (
    SELECT [p].[profileId] AS [Id], [p].[bio] AS [Bio], [p].[website] AS [Website]
    FROM [Profiles] AS [p]
    WHERE [p].[userId] = [u].[id]
    ORDER BY (SELECT NULL)
    OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
) AS [ProfileInfo], JSON_QUERY(COALESCE((
    SELECT [p1].[postId] AS [Id], [p1].[title] AS [PostTitle], [p2].[categoryId] AS [PostCategoryId]
    FROM [Posts] AS [p1]
    INNER JOIN [PostCategories] AS [p2] ON [p1].[postId] = [p2].[postId]
    WHERE [p1].[authorId] = [u].[id]
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [Posts]
FROM [Users] AS [u]
INNER JOIN [Departments] AS [d] ON [u].[departmentId] = [d].[deptId]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
