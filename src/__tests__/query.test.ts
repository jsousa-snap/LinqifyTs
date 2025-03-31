// --- START OF FILE query.test.ts ---

// src/main.test.ts  (ou o caminho que preferir)

// Assumindo que DbContext e QueryableExtensions estão em locais acessíveis
// Ajuste os caminhos conforme a estrutura do seu projeto
import { DbContext } from "../core"; // Ex: './core/DbContext' ou similar
import "../query/QueryableExtensions"; // Importa para aplicar os métodos no protótipo
import { IQueryable } from "../interfaces"; // Se necessário para tipagem

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

// Helper para remover a primeira e a última quebra de linha para comparação
const normalizeSql = (sql: string): string => {
  let result = sql;

  // Remove espaços em branco seguidos pela primeira quebra de linha no início
  result = result.replace(/^\s*\n/, "");

  // Remove a última quebra de linha seguida por espaços em branco no final
  result = result.replace(/\n\s*$/, "");

  return result;
};

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
  });

  it("Teste 1: should handle simple select", () => {
    const nameQuery = users.select((u) => u.name);
    const expectedSql = `
SELECT [t0].[name]
FROM [Users] AS [t0]
    `;
    const actualSql = nameQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 2: should handle simple where", () => {
    const oldUsersQuery = users.where((u) => u.age > 30);
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE [t0].[age] > 30
    `;
    const actualSql = oldUsersQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 3: should handle where with string equality", () => {
    const aliceQuery = users.where((u) => u.name == "Alice");
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE [t0].[name] = 'Alice'
    `;
    const actualSql = aliceQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 4: should handle select with object projection", () => {
    const dtoQuery = users.select((u) => ({ UserId: u.id, UserName: u.name }));
    const expectedSql = `
SELECT [t0].[id] AS [UserId], [t0].[name] AS [UserName]
FROM [Users] AS [t0]
    `;
    const actualSql = dtoQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 5: should handle combined where and select", () => {
    const youngUserNamesQuery = users
      .where((u) => u.age < 25)
      .select((u) => u.name);
    const expectedSql = `
SELECT [t0].[name]
FROM [Users] AS [t0]
WHERE [t0].[age] < 25
    `;
    const actualSql = youngUserNamesQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 6: should handle where and select with projection", () => {
    const seniorDtoQuery = users
      .where((u) => u.age >= 65)
      .select((u) => ({ Name: u.name, Contact: u.email }));
    const expectedSql = `
SELECT [t0].[name] AS [Name], [t0].[email] AS [Contact]
FROM [Users] AS [t0]
WHERE [t0].[age] >= 65
    `;
    const actualSql = seniorDtoQuery.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste 7: should handle where with logical AND", () => {
    const specificUserQuery = users.where((u) => u.age > 20 && u.name == "Bob");
    const expectedSql = `
SELECT [t0].*
FROM [Users] AS [t0]
WHERE ([t0].[age] > 20 AND [t0].[name] = 'Bob')
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
SELECT [t0].[name] AS [UserName], [t1].[title] AS [PostTitle]
FROM [Users] AS [t0]
INNER JOIN [Posts] AS [t1] ON [t0].[id] = [t1].[authorId]
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
SELECT [t0].[id] AS [UserId], [t0].[name] AS [UserName], [t1].[title] AS [PostTitle], [t1].[postId] AS [PostId]
FROM [Users] AS [t0]
INNER JOIN [Posts] AS [t1] ON [t0].[id] = [t1].[authorId]
WHERE [t0].[name] = 'Alice'
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
SELECT [t0].[name] AS [UserName], [t3].[name] AS [CategoryName]
FROM [Users] AS [t0]
INNER JOIN [Posts] AS [t1] ON [t0].[id] = [t1].[authorId]
INNER JOIN [PostCategories] AS [t2] ON [t1].[postId] = [t2].[postId]
INNER JOIN [Categories] AS [t3] ON [t2].[categoryId] = [t3].[categoryId]
    `;
    const actualSql = userAndCategoryNames.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Teste Subquery (Teste 11 original) - AINDA PODE FALHAR dependendo do suporte a subqueries correlacionadas
  it("Teste Subquery: should handle subquery using provideScope (expecting error or specific SQL)", () => {
    const subQueryTest = users
      .provideScope({ posts, categories })
      .select((user) => ({
        nome: user.name,
        postsList: posts
          .where((post) => post.authorId === user.id)
          .select((post) => ({
            title: post.title,
            categories: categories.select((c) => c.name),
          })),
      }));

    const expectedSql = `
SELECT [t0].[name] AS [nome], JSON_QUERY(COALESCE((
    SELECT [t1].[title], JSON_QUERY(COALESCE((
        SELECT [t2].[name]
        FROM [Categories] AS [t2]
        FOR JSON PATH, INCLUDE_NULL_VALUES
    ), '[]')) AS [categories]
    FROM [Posts] AS [t1]
    WHERE [t1].[authorId] = [t0].[id]
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [postsList]
FROM [Users] AS [t0]`;

    const actualSql = subQueryTest.toQueryString(); // Armazena o resultado
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql)); // Compara
  });

  it("Teste 11: should handle multi-join with where before and after", () => {
    const userAndTechCategoryNames = users
      .join(
        posts,
        (u: User) => u.id,
        (p: Post) => p.authorId,
        (u, p) => ({ user: u, post: p })
      )
      .join(
        postCategories,
        (up) => up.post.postId,
        (pc: PostCategory) => pc.postId,
        (up, pc) => ({ user: up.user, post: up.post, postCategory: pc })
      )
      .where((uppc) => uppc.post.title != null) // Where intermediário
      .join(
        categories,
        (uppc) => uppc.postCategory.categoryId,
        (cat: Category) => cat.categoryId,
        (uppc, cat) => ({ UserName: uppc.user.name, CategoryName: cat.name })
      )
      .where((result) => result.CategoryName == "Tech"); // Where final

    const expectedSqlNotNull = `
SELECT [t0].[name] AS [UserName], [t3].[name] AS [CategoryName]
FROM [Users] AS [t0]
INNER JOIN [Posts] AS [t1] ON [t0].[id] = [t1].[authorId]
INNER JOIN [PostCategories] AS [t2] ON [t1].[postId] = [t2].[postId]
INNER JOIN [Categories] AS [t3] ON [t2].[categoryId] = [t3].[categoryId]
WHERE ([t1].[title] != NULL AND [t3].[name] = 'Tech')
    `;
    const actualSql = userAndTechCategoryNames.toQueryString(); // Armazena o resultado
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSqlNotNull)); // Compara
  });
});

// --- END OF FILE query.test.ts ---
