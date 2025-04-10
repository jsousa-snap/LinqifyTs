import { DbContext } from "../core";
import "../query/QueryableExtensions";
import { IQueryable } from "../interfaces";
import { QueryExpressionVisitor } from "../query/translation/QueryExpressionVisitor";
import {
  SqlExpressionType,
  SelectExpressionMetadata,
  ColumnExpressionMetadata,
  SqlBinaryExpressionMetadata,
  SqlConstantExpressionMetadata,
  SqlFunctionCallExpressionMetadata,
  SqlExpressionMetadata,
} from "../sql-expressions";
import { Expression } from "../expressions";

// Interfaces de Entidade
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  country: string;
  departmentId?: number | null;
}
interface Post {
  postId: number;
  title: string;
  authorId: number;
}
interface DataItem {
  id: number;
  value: string;
  category: string;
}

interface Profile {
  profileId: number;
  userId: number;
  bio: string;
  website?: string;
}
interface PostCategory {
  postId: number;
  categoryId: number;
}
interface Department {
  deptId: number;
  deptName: string;
}

function removeSpaces(str: string) {
  return str.replace(/\s+/g, "");
}

describe("SQL Expression Metadata Generation Tests (Async)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let items1: IQueryable<DataItem>;
  let items2: IQueryable<DataItem>;
  let profiles: IQueryable<Profile>;
  let postCategories: IQueryable<PostCategory>;
  let departments: IQueryable<Department>;
  let visitor: QueryExpressionVisitor;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    items1 = dbContext.set<DataItem>("Items1");
    items2 = dbContext.set<DataItem>("Items2");
    profiles = dbContext.set<Profile>("Profiles");
    postCategories = dbContext.set<PostCategory>("PostCategories");
    departments = dbContext.set<Department>("Departments");
    visitor = new QueryExpressionVisitor();
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function getMetadata(expression: Expression): SqlExpressionMetadata {
    // Ajustado para receber LinqExpression
    const sqlExpr = visitor.translate(expression);
    return sqlExpr.toMetadata();
  }

  it("Teste Metadata 1: Simple Select/Where", () => {
    const query = users.where((u) => u.age > 30 && u.name == "Alice").select((u) => u.email);
    const metadata = getMetadata(query.expression); // Passa a expressão
    expect(metadata.$type).toBe(SqlExpressionType.Select);
  });

  it("Teste Metadata 2: Inner Join", () => {
    const query = users.join(
      posts,
      (u) => u.id,
      (p) => p.authorId,
      (u, p) => ({ UserName: u.name, PostTitle: p.title })
    );
    const metadata = getMetadata(query.expression); // Passa a expressão
    expect(metadata.$type).toBe(SqlExpressionType.Select);
  });

  it("Teste Metadata 3: Union", () => {
    const query = items1.select((i) => ({ Val: i.value })).union(items2.select((i) => ({ Val: i.value })));
    const metadata = getMetadata(query.expression); // Passa a expressão
    expect(metadata.$type).toBe(SqlExpressionType.Select);
  });

  it("Teste Metadata 4: Subquery Projection (FOR JSON)", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      PostTitles: posts
        .where((p) => p.authorId === u.id)
        .select((p) => p.title)
        .take(5),
    }));
    const metadata = getMetadata(query.expression); // Passa a expressão
    expect(metadata.$type).toBe(SqlExpressionType.Select);
  });

  it("Teste Metadata 5: Aggregation (COUNT)", async () => {
    const query = users.where((u) => u.country === "BR");
    // A execução usa countAsync
    const countResult = await query.countAsync(); // **** USA countAsync e await ****
    expect(countResult).toBe(10);

    // Verificação dos metadados da expressão ANTES da execução final
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const countLinqExpr = new (require("../expressions/MethodCallExpression").MethodCallExpression)(
      "count", // Nome base na expressão
      query.expression,
      []
    );
    const metadata = getMetadata(countLinqExpr); // Passa a expressão do count

    expect(metadata.$type).toBe(SqlExpressionType.Select);

    const selectMeta = metadata as SelectExpressionMetadata;
    expect(selectMeta.projection).toHaveLength(1);
    expect(selectMeta.projection[0].alias).toBe("count_result");
    expect(selectMeta.projection[0].expression.$type).toBe(SqlExpressionType.FunctionCall);
    const funcCall = selectMeta.projection[0].expression as SqlFunctionCallExpressionMetadata;
    expect(funcCall.functionName.toUpperCase()).toBe("COUNT_BIG");
    expect((funcCall.args[0] as SqlConstantExpressionMetadata).value).toBe(1);
    expect(selectMeta.predicate).not.toBeNull();
    expect(((selectMeta.predicate as SqlBinaryExpressionMetadata).right as SqlConstantExpressionMetadata).value).toBe(
      "BR"
    );
  });

  it("Teste Metadata 6: Paging (Skip/Take)", () => {
    const query = users
      .orderBy((u) => u.age)
      .skip(10)
      .take(5);
    const metadata = getMetadata(query.expression); // Passa a expressão
    expect(metadata.$type).toBe(SqlExpressionType.Select);
  });

  it("Teste Metadata 7: GroupBy", () => {
    const query = users
      .where((u) => u.age > 18)
      .groupBy(
        (u) => u.country,
        // **** USA countAsync na construção da expressão ****
        (key, group) => ({ Country: key, Count: group.count() })
      );

    const metadata = getMetadata(query.expression); // Passa a expressão
    expect(metadata.$type).toBe(SqlExpressionType.Select);

    const selectMeta = metadata as SelectExpressionMetadata;
    expect(selectMeta.groupBy).toHaveLength(1);
    expect((selectMeta.groupBy[0] as ColumnExpressionMetadata).name).toBe("country");
    expect(selectMeta.projection).toHaveLength(2);
    expect(selectMeta.projection[1].expression.$type).toBe(SqlExpressionType.FunctionCall);
    expect(selectMeta.predicate).not.toBeNull();
  });

  it("Teste Metadata 8: JSON Stringify Comparison for Simple Select/Where", () => {
    const query = users.where((u) => u.age > 30 && u.name == "Alice").select((u) => u.email);

    const metadata = getMetadata(query.expression); // Passa a expressão
    const generatedJson = JSON.stringify(metadata, null, 4);

    const expectedJson = `{
    "$type": "Select",
    "alias": "s",
    "projection": [
        {
            "$type": "Projection",
            "expression": {
                "$type": "Column",
                "name": "email",
                "table": {
                    "$type": "Table",
                    "alias": "u",
                    "name": "Users"
                }
            },
            "alias": "email"
        }
    ],
    "from": {
        "$type": "Table",
        "alias": "u",
        "name": "Users"
    },
    "predicate": {
        "$type": "Binary",
        "left": {
            "$type": "Binary",
            "left": {
                "$type": "Column",
                "name": "age",
                "table": {
                    "$type": "Table",
                    "alias": "u",
                    "name": "Users"
                }
            },
            "operator": ">",
            "right": {
                "$type": "Constant",
                "value": 30
            }
        },
        "operator": "&&",
        "right": {
            "$type": "Binary",
            "left": {
                "$type": "Column",
                "name": "name",
                "table": {
                    "$type": "Table",
                    "alias": "u",
                    "name": "Users"
                }
            },
            "operator": "==",
            "right": {
                "$type": "Constant",
                "value": "Alice"
            }
        }
    },
    "having": null,
    "joins": [],
    "orderBy": [],
    "offset": null,
    "limit": null,
    "groupBy": []
}`;

    expect(generatedJson).toEqual(expectedJson);
  });

  it("Teste 9: Query join with subquery with join", () => {
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

    const metadata = getMetadata(query.expression); // Passa a expressão
    const generatedJson = JSON.stringify(metadata, null, 4);

    const expectedJson = `{
    "$type": "Select",
    "alias": "s2",
    "projection": [
        {
            "$type": "Projection",
            "expression": {
                "$type": "Column",
                "name": "name",
                "table": {
                    "$type": "Table",
                    "alias": "u",
                    "name": "Users"
                }
            },
            "alias": "UserName"
        },
        {
            "$type": "Projection",
            "expression": {
                "$type": "Column",
                "name": "deptName",
                "table": {
                    "$type": "Table",
                    "alias": "d",
                    "name": "Departments"
                }
            },
            "alias": "Department"
        },
        {
            "$type": "Projection",
            "expression": {
                "$type": "ScalarSubqueryAsJson",
                "selectExpression": {
                    "$type": "Select",
                    "alias": "f",
                    "projection": [
                            {
                            "$type": "Projection",
                            "expression": {
                                "$type": "Column",
                                "name": "profileId",
                                "table": {
                                    "$type": "Table",
                                    "alias": "p",
                                    "name": "Profiles"
                                }
                            },
                            "alias": "Id"
                        },
                        {
                            "$type": "Projection",
                            "expression": {
                                "$type": "Column",
                                "name": "bio",
                                "table": {
                                    "$type": "Table",
                                    "alias": "p",
                                    "name": "Profiles"
                                }
                            },
                            "alias": "Bio"
                        },
                        {
                            "$type": "Projection",
                            "expression": {
                                "$type": "Column",
                                "name": "website",
                                "table": {
                                    "$type": "Table",
                                    "alias": "p",
                                    "name": "Profiles"
                                }
                            },
                            "alias": "Website"
                        }
                    ],
                    "from": {
                        "$type": "Table",
                        "alias": "p",
                        "name": "Profiles"
                    },
                    "predicate": {
                        "$type": "Binary",
                        "left": {
                            "$type": "Column",
                            "name": "userId",
                            "table": {
                                "$type": "Table",
                                "alias": "p",
                                "name": "Profiles"
                            }
                        },
                        "operator": "==",
                        "right": {
                            "$type": "Column",
                            "name": "id",
                            "table": {
                                "$type": "Table",
                                "alias": "u",
                                "name": "Users"
                            }
                        }
                    },
                    "having": null,
                    "joins": [],
                    "orderBy": [],
                    "offset": null,
                    "limit": {
                        "$type": "Constant",
                        "value": 1
                    },
                    "groupBy": []
                },
                "mode": "PATH",
                "includeNullValues": true,
                "withoutArrayWrapper": true
            },
            "alias": "ProfileInfo"
        },
        {
            "$type": "Projection",
            "expression": {
                "$type": "ScalarSubqueryAsJson",
                "selectExpression": {
                    "$type": "Select",
                    "alias": "s1",
                    "projection": [
                            {
                            "$type": "Projection",
                            "expression": {
                                "$type": "Column",
                                "name": "postId",
                                "table": {
                                    "$type": "Table",
                                    "alias": "p1",
                                    "name": "Posts"
                                }
                            },
                            "alias": "Id"
                        },
                        {
                            "$type": "Projection",
                            "expression": {
                                "$type": "Column",
                                "name": "title",
                                "table": {
                                    "$type": "Table",
                                    "alias": "p1",
                                    "name": "Posts"
                                }
                            },
                            "alias": "PostTitle"
                        },
                        {
                            "$type": "Projection",
                            "expression": {
                                "$type": "Column",
                                "name": "categoryId",
                                "table": {
                                    "$type": "Table",
                                    "alias": "p2",
                                    "name": "PostCategories"
                                }
                            },
                            "alias": "PostCategoryId"
                        }
                    ],
                    "from": {
                        "$type": "Table",
                        "alias": "p1",
                        "name": "Posts"
                    },
                    "predicate": {
                        "$type": "Binary",
                        "left": {
                            "$type": "Column",
                            "name": "authorId",
                            "table": {
                                "$type": "Table",
                                "alias": "p1",
                                "name": "Posts"
                            }
                        },
                        "operator": "==",
                        "right": {
                            "$type": "Column",
                            "name": "id",
                            "table": {
                                "$type": "Table",
                                "alias": "u",
                                "name": "Users"
                            }
                        }
                    },
                    "having": null,
                    "joins": [
                            {
                            "$type": "InnerJoin",
                            "table": {
                                "$type": "Table",
                                "alias": "p2",
                                "name": "PostCategories"
                            },
                            "joinPredicate": {
                                "$type": "Binary",
                                "left": {
                                    "$type": "Column",
                                    "name": "postId",
                                    "table": {
                                        "$type": "Table",
                                        "alias": "p1",
                                        "name": "Posts"
                                    }
                                },
                                "operator": "==",
                                "right": {
                                    "$type": "Column",
                                    "name": "postId",
                                    "table": {
                                        "$type": "Table",
                                        "alias": "p2",
                                        "name": "PostCategories"
                                    }
                                }
                            }
                        }
                    ],
                    "orderBy": [],
                    "offset": null,
                    "limit": null,
                    "groupBy": []
                },
                "mode": "PATH",
                "includeNullValues": true,
                "withoutArrayWrapper": false
            },
            "alias": "Posts"
        }
    ],
    "from": {
        "$type": "Table",
        "alias": "u",
        "name": "Users"
    },
    "predicate": null,
    "having": null,
    "joins": [
            {
            "$type": "InnerJoin",
            "table": {
                "$type": "Table",
                "alias": "d",
                "name": "Departments"
            },
            "joinPredicate": {
                "$type": "Binary",
                "left": {
                    "$type": "Column",
                    "name": "departmentId",
                    "table": {
                        "$type": "Table",
                        "alias": "u",
                        "name": "Users"
                    }
                },
                "operator": "==",
                "right": {
                    "$type": "Column",
                    "name": "deptId",
                    "table": {
                        "$type": "Table",
                        "alias": "d",
                        "name": "Departments"
                    }
                }
            }
        }
    ],
    "orderBy": [],
    "offset": null,
    "limit": null,
    "groupBy": []
}`;

    expect(removeSpaces(generatedJson)).toEqual(removeSpaces(expectedJson));
  });
});
