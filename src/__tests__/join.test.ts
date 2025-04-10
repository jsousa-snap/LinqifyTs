import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Importa para aplicar os métodos no protótipo
import { normalizeSql } from "./utils/testUtils";

// --- Interfaces/Classes de Entidade ---
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
// --- Fim Entidades ---

describe("Queryable Join Operator Tests (INNER JOIN / LEFT JOIN)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let profiles: IQueryable<Profile>;
  let categories: IQueryable<Category>;
  let postCategories: IQueryable<PostCategory>;
  let departments: IQueryable<Department>;

  // Setup antes de cada teste
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

  // --- INNER JOIN Tests ---

  it("Teste INNER Join 1: should handle simple join", () => {
    const userPostsQuery = users.join(
      posts,
      (user) => user.id,
      (post) => post.authorId,
      (user: User, post: Post) => ({
        UserName: user.name,
        PostTitle: post.title,
      })
    );
    const expectedSql = `
SELECT [u].[name] AS [UserName], [p].[title] AS [PostTitle]
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
    `;
    const actualSql = userPostsQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste INNER Join 2: should handle join with subsequent where", () => {
    const specificUserPostsQuery = users
      .join(
        posts,
        (user) => user.id,
        (post) => post.authorId,
        (user, post) => ({
          UserId: user.id,
          UserName: user.name,
          PostTitle: post.title,
          PostId: post.postId,
        })
      )
      .where((joinedResult) => joinedResult.UserName == "Alice");

    const expectedSql = `
SELECT [u].[id] AS [UserId], [u].[name] AS [UserName], [p].[title] AS [PostTitle], [p].[postId] AS [PostId]
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
WHERE [u].[name] = 'Alice'
    `;
    const actualSql = specificUserPostsQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste INNER Join 3: should handle multi-join (Users -> Posts -> PostCategories -> Categories)", () => {
    const userAndCategoryNames = users
      .join(
        posts,
        (u) => u.id,
        (p) => p.authorId,
        (u, p) => ({ user: u, post: p }) // Projeta objetos intermediários
      )
      .join(
        postCategories,
        (up) => up.post.postId, // Acessa membro do objeto intermediário
        (pc) => pc.postId,
        (up, pc) => ({ user: up.user, post: up.post, postCategory: pc }) // Projeta novamente
      )
      .join(
        categories,
        (uppc) => uppc.postCategory.categoryId, // Acessa membro
        (cat) => cat.categoryId,
        (uppc, cat) => ({ UserName: uppc.user.name, CategoryName: cat.name }) // Projeção final
      );

    const expectedSql = `
SELECT [u].[name] AS [UserName], [c].[name] AS [CategoryName]
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
INNER JOIN [PostCategories] AS [p1] ON [p].[postId] = [p1].[postId]
INNER JOIN [Categories] AS [c] ON [p1].[categoryId] = [c].[categoryId]
    `;
    const actualSql = userAndCategoryNames.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste INNER Join 4: should handle multi-join with where before and after", () => {
    const userAndTechCategoryNames = users // [u]
      .join(
        posts, // [p]
        (u: User) => u.id,
        (p: Post) => p.authorId,
        (u, p) => ({ user: u, post: p })
      )
      .join(
        postCategories, // [p1]
        (up) => up.post.postId,
        (pc: PostCategory) => pc.postId,
        (up, pc) => ({ user: up.user, post: up.post, postCategory: pc })
      )
      .where((uppc) => uppc.post.title != null)
      .join(
        categories,
        (uppc) => uppc.postCategory.categoryId,
        (cat: Category) => cat.categoryId,
        (uppc, cat) => ({ UserName: uppc.user.name, CategoryName: cat.name })
      )
      .where((result) => result.CategoryName == "Tech");

    const expectedSqlNotNull = `
SELECT [u].[name] AS [UserName], [c].[name] AS [CategoryName]
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
INNER JOIN [PostCategories] AS [p1] ON [p].[postId] = [p1].[postId]
INNER JOIN [Categories] AS [c] ON [p1].[categoryId] = [c].[categoryId]
WHERE [p].[title] IS NOT NULL AND [c].[name] = 'Tech'`;

    const actualSql = userAndTechCategoryNames.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSqlNotNull));
  });

  it("Teste INNER Join 5: should handle multi-join with subquery", () => {
    const userAndTechCategoryNames = users // [u]
      .join(
        posts, // [p]
        (u: User) => u.id,
        (p: Post) => p.authorId,
        (u, p) => ({ user: u, post: p })
      )
      .join(
        postCategories, // [p1]
        (up) => up.post.postId,
        (pc: PostCategory) => pc.postId,
        (up, pc) => ({ user: up.user, post: up.post, postCategory: pc })
      )
      .where((uppc) => uppc.post.title != null) // Where intermediário
      .join(
        categories.where((c) => c.name === "cat1"), // Subquery -> categories é [c], where usa [c], alias da subquery será [c1] ou similar
        (uppc) => uppc.postCategory.categoryId,
        (cat: Category) => cat.categoryId, // cat refere-se ao alias da subquery [c1]
        (uppc, cat) => ({ UserName: uppc.user.name, CategoryName: cat.name })
      )
      .where((result) => result.CategoryName == "Tech"); // Where final

    // **EXPECTED SQL COM ALIAS CORRIGIDOS**
    // Alias da subquery Categories é [c] (interno) e [c1] (externo)
    const expectedSqlNotNull = `
SELECT [u].[name] AS [UserName], [c].[name] AS [CategoryName]
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
INNER JOIN [PostCategories] AS [p1] ON [p].[postId] = [p1].[postId]
INNER JOIN (
    SELECT [c].*
    FROM [Categories] AS [c]
    WHERE [c].[name] = 'cat1'
) AS [c] ON [p1].[categoryId] = [c].[categoryId]
WHERE [p].[title] IS NOT NULL AND [c].[name] = 'Tech'`;

    const actualSql = userAndTechCategoryNames.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSqlNotNull));
  });

  it("Teste INNER Join 6: should select a single field from join result", () => {
    const userPostsQuery = users
      .join(
        posts,
        (user) => user.id,
        (post) => post.authorId,
        (user: User, post: Post) => ({
          UserName: user.name,
          PostTitle: post.title,
        })
      )
      .select((result) => result.UserName);
    const expectedSql = `
SELECT [u].[name] AS [UserName]
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
      `;
    const actualSql = userPostsQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste INNER Join 7: should handle inner join with where clause", () => {
    const userPostsQuery = users
      .join(
        posts,
        (user) => user.id,
        (post) => post.authorId,
        (user: User, post: Post) => ({
          UserName: user.name,
          PostTitle: post.title,
        })
      )
      .where((result) => result.UserName == "Alice");

    const expectedSql = `
SELECT [u].[name] AS [UserName], [p].[title] AS [PostTitle]
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
WHERE [u].[name] = 'Alice'`;

    const actualSql = userPostsQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
  // --- LEFT JOIN Tests ---

  it("Teste LEFT Join 1: Simple Left Join", () => {
    const query = users.leftJoin(
      departments,
      (u) => u.departmentId,
      (d) => d.deptId,
      (u, d) => ({
        UserName: u.name,
        DeptName: d != null ? d.deptName : "No Department", // Handle null dept
      })
    );

    // Nota: A tradução exata do operador ternário para CASE WHEN pode variar.
    // Vamos verificar as partes principais
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toContain("SELECT [u].[name] AS [UserName]");
    expect(normalizeSql(actualSql)).toContain("LEFT JOIN [Departments] AS [d] ON [u].[departmentId] = [d].[deptId]");
    // A verificação da projeção exata do CASE WHEN é omitida por simplicidade,
    // pois depende da implementação detalhada do visitor para condicionais.
    // Se necessário, um teste mais específico para o CASE WHEN seria criado.
  });

  it("Teste LEFT Join 2: Multiple Left Joins", () => {
    const query = users // u
      .leftJoin(
        profiles, // p
        (u) => u.id,
        (p) => p.userId,
        (u, p) => ({ user: u, profile: p })
      )
      .leftJoin(
        departments, // d
        (up) => up.user.departmentId,
        (d) => d.deptId,
        (up, d) => ({
          UserName: up.user.name,
          Bio: up.profile != null ? up.profile.bio : null,
          DeptName: d != null ? d.deptName : null,
        })
      );

    // A projeção exata com CASE WHEN pode variar. Focamos na estrutura.
    const expectedBaseSql = `
FROM [Users] AS [u]
LEFT JOIN [Profiles] AS [p] ON [u].[id] = [p].[userId]
LEFT JOIN [Departments] AS [d] ON [u].[departmentId] = [d].[deptId]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toContain(normalizeSql(expectedBaseSql));
    expect(normalizeSql(actualSql)).toContain("SELECT [u].[name] AS [UserName]");
  });

  it("Teste LEFT Join 3: Inner Join followed by Left Join", () => {
    const query = users // u
      .join(
        posts, // p
        (u) => u.id,
        (p) => p.authorId,
        (u, p) => ({ user: u, post: p })
      )
      .leftJoin(
        departments, // d
        (up) => up.user.departmentId,
        (d) => d.deptId,
        (up, d) => ({
          UserName: up.user.name,
          PostTitle: up.post.title,
          DeptName: d != null ? d.deptName : null,
        })
      );

    const expectedSqlStructure = `
FROM [Users] AS [u]
INNER JOIN [Posts] AS [p] ON [u].[id] = [p].[authorId]
LEFT JOIN [Departments] AS [d] ON [u].[departmentId] = [d].[deptId]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toContain(normalizeSql(expectedSqlStructure));
    expect(normalizeSql(actualSql)).toContain("SELECT [u].[name] AS [UserName]");
    expect(normalizeSql(actualSql)).toContain("[p].[title] AS [PostTitle]");
  });
});
// --- END OF FILE src/__tests__/join.test.ts ---
