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
}
class UserEntity implements User {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
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
// --- Fim Entidades ---

describe("Queryable Extensions Tests (EF Core Formatting)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let profiles: IQueryable<Profile>;
  let categories: IQueryable<Category>;
  let postCategories: IQueryable<PostCategory>;

  // Setup antes de cada teste no bloco 'describe'
  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    profiles = dbContext.set<Profile>("Profiles");
    categories = dbContext.set<Category>("Categories");
    postCategories = dbContext.set<PostCategory>("PostCategories");

    // Mock console.warn para evitar poluir a saída do teste
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    // Restaura mocks
    jest.restoreAllMocks();
  });

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

  it("Teste 8: should handle simple join", () => {
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

  it("Teste 9: should handle join with subsequent where", () => {
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

  it("Teste 10: should handle multi-join (Users -> Posts -> PostCategories -> Categories)", () => {
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

  // Teste Subquery (Teste 11 original) - CORRIGIDO PARA USAR OS NOVOS ALIASES
  it("Teste Subquery: should handle subquery using provideScope (expecting JSON)", () => {
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

  it("Teste 11: should handle multi-join with where before and after", () => {
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

  it("Teste 12: should handle multi-join with subquery ", () => {
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
});

// --- END OF FILE src/__tests__/query.test.ts ---
