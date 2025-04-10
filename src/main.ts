// --- START OF FILE main.ts ---

import "./query/QueryableExtensions";
import { DbContext } from "./core";
import { IQueryable } from "./interfaces"; // Importar IQueryable se necessário para tipos

// --- Interfaces/Classes de Entidade ---
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

// --- Setup do DbContext ---
const dbContext = new DbContext();

const users = dbContext.set<User>("Users");
const posts = dbContext.set<Post>("Posts");
const profiles = dbContext.set<Profile>("Profiles");
const categories = dbContext.set<Category>("Categories");
const postCategories = dbContext.set<PostCategory>("PostCategories");
// --- Fim Setup ---

const subQueryTest = users
  // **** CORRIGIDO: A chave DEVE ser o nome da variável usada na lambda ****
  .provideScope({ posts }) // <<< Chave 'posts' corresponde à variável 'posts'
  .select((user) => ({
    nome: user.name,
    // **** CORRIGIDO: Usar a variável ORIGINAL 'posts' aqui ****
    postsList: posts // <<< Usar 'posts', acessível via closure
      .where((post: Post) => post.authorId === user.id) // 'user' capturado
      .select((post: Post) => post.title),
  }));

function others() {
  // --- Testes ---
  // ... testes 1 a 10 inalterados ...
  console.log("--- Teste 1: Select Simples ---");
  const nameQuery = users.select((u) => u.name);
  console.log("Expression:", nameQuery.expression.toString());
  console.log("SQL:", nameQuery.toQueryString());

  console.log("\n--- Teste 2: Where Simples ---");
  const oldUsersQuery = users.where((u) => u.age > 30);
  console.log("Expression:", oldUsersQuery.expression.toString());
  console.log("SQL:", oldUsersQuery.toQueryString());

  console.log("\n--- Teste 3: Where com String e Igualdade ---");
  const aliceQuery = users.where((u) => u.name == "Alice");
  console.log("Expression:", aliceQuery.expression.toString());
  console.log("SQL:", aliceQuery.toQueryString());

  console.log("\n--- Teste 4: Select com Projeção de Objeto ---");
  const dtoQuery = users.select((u) => ({ UserId: u.id, UserName: u.name }));
  console.log("Expression:", dtoQuery.expression.toString());
  console.log("SQL:", dtoQuery.toQueryString());

  console.log("\n--- Teste 5: Where e Select Combinados ---");
  const youngUserNamesQuery = users.where((u) => u.age < 25).select((u) => u.name);
  console.log("Expression:", youngUserNamesQuery.expression.toString());
  console.log("SQL:", youngUserNamesQuery.toQueryString());

  console.log("\n--- Teste 6: Where e Select com Projeção ---");
  const seniorDtoQuery = users.where((u) => u.age >= 65).select((u) => ({ Name: u.name, Contact: u.email }));
  console.log("Expression:", seniorDtoQuery.expression.toString());
  console.log("SQL:", seniorDtoQuery.toQueryString());

  console.log("\n--- Teste 7: Where com AND Lógico ---");
  const specificUserQuery = users.where((u) => u.age > 20 && u.name == "Bob");
  console.log("Expression:", specificUserQuery.expression.toString());
  console.log("SQL:", specificUserQuery.toQueryString());

  console.log("\n--- Teste 8: Join Simples ---");
  const userPostsQuery = users.join(
    posts,
    (user) => user.id,
    (post) => post.authorId,
    (user: User, post: Post) => ({ UserName: user.name, PostTitle: post.title })
  );
  console.log("Expression:", userPostsQuery.expression.toString());
  console.log("SQL:", userPostsQuery.toQueryString());

  console.log("\n--- Teste 9: Join com Where depois ---");
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
  console.log("Expression:", specificUserPostsQuery.expression.toString());
  console.log("SQL:", specificUserPostsQuery.toQueryString());

  console.log("\n--- Teste 10: Multi-Join (Users -> Posts -> PostCategories -> Categories) ---");
  const userAndCategoryNames = users
    .join(
      posts,
      (u) => u.id,
      (p) => p.authorId,
      (u, p) => ({ user: u, post: p })
    )
    .join(
      postCategories,
      (up) => up.post.postId,
      (pc) => pc.postId,
      (up, pc) => ({ user: up.user, post: up.post, postCategory: pc })
    )
    .join(
      categories,
      (uppc: { user: User; post: Post; postCategory: PostCategory }) => uppc.postCategory.categoryId,
      (cat: Category) => cat.categoryId,
      (uppc, cat) => ({ UserName: uppc.user.name, CategoryName: cat.name })
    );
  console.log("Expression:", userAndCategoryNames.expression.toString());
  console.log("SQL:", userAndCategoryNames.toQueryString());

  // --- Teste Subquery com provideScope CORRIGIDO ---
  console.log("\n--- Teste Subquery (provideScope) ---");
  const subQueryTest = users
    // **** CORRIGIDO: A chave DEVE ser o nome da variável usada na lambda ****
    .provideScope({ posts }) // <<< Chave 'posts' corresponde à variável 'posts'
    .select((user) => ({
      nome: user.name,
      // **** CORRIGIDO: Usar a variável ORIGINAL 'posts' aqui ****
      postsList: posts // <<< Usar 'posts', acessível via closure
        .where((post: Post) => post.authorId === user.id) // 'user' capturado
        .select((post: Post) => post.title),
    }));

  console.log("Expression:", subQueryTest.expression.toString());
  try {
    console.log("SQL:", subQueryTest.toQueryString());
  } catch (e: any) {
    console.error("ERRO Teste Subquery:", e.message);
    console.error(e.stack);
  }
  // --- Fim Teste Subquery ---

  console.log("\n--- Teste 11: Multi-Join com Where ANTES e DEPOIS ---");
  const userAndTechCategoryNames = users
    .join(
      posts,
      (u: User) => u.id,
      (p: Post) => p.authorId,
      (u, p) => ({ user: u, post: p })
    )
    .join(
      postCategories,
      (up: { user: User; post: Post }) => up.post.postId,
      (pc: PostCategory) => pc.postId,
      (up, pc) => ({ user: up.user, post: up.post, postCategory: pc })
    )
    .where((uppc: { user: User; post: Post; postCategory: PostCategory }) => uppc.post.title != null)
    .join(
      categories,
      (uppc: { user: User; post: Post; postCategory: PostCategory }) => uppc.postCategory.categoryId,
      (cat: Category) => cat.categoryId,
      (uppc, cat) => ({ UserName: uppc.user.name, CategoryName: cat.name })
    )
    .where((result: { UserName: string; CategoryName: string }) => result.CategoryName == "Tech");
  console.log("Expression:", userAndTechCategoryNames.expression.toString());
  console.log("SQL:", userAndTechCategoryNames.toQueryString());

  console.log("\n--- Teste 12: Join com Select e Where Intercalados ---");
  try {
    const filteredProfiles = profiles.where((pr: Profile) => pr.website != null);

    const userProfileEmail = users
      .where((u: User) => u.age > 18)
      .select((u) => ({ Id: u.id, Email: u.email }))
      // **** CORRIGIDO: A chave DEVE ser o nome da variável usada no join ****
      .provideScope({ filteredProfiles }) // <<< Chave 'filteredProfiles'
      .join(
        // **** CORRIGIDO: Usar a variável ORIGINAL 'filteredProfiles' ****
        filteredProfiles, // <<< Usar 'filteredProfiles', acessível via closure
        (usr: { Id: number; Email: string }) => usr.Id,
        (prof: Profile) => prof.userId,
        (usr: { Id: number; Email: string }, prof: Profile) => ({
          UserEmail: usr.Email,
          ProfileBio: prof.bio,
        })
      );
    console.log("Expression:", userProfileEmail.expression.toString());
    console.log("SQL:", userProfileEmail.toQueryString());
  } catch (e: any) {
    console.error("ERRO INESPERADO (Teste 12):", e.message);
    console.error(e.stack);
  }
  // --- END OF FILE main.ts ---
}
