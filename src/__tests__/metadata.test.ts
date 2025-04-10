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

describe("SQL Expression Metadata Generation Tests (Async)", () => {
  let dbContext: DbContext;
  let users: IQueryable<User>;
  let posts: IQueryable<Post>;
  let items1: IQueryable<DataItem>;
  let items2: IQueryable<DataItem>;
  let visitor: QueryExpressionVisitor;

  beforeEach(() => {
    dbContext = new DbContext();
    users = dbContext.set<User>("Users");
    posts = dbContext.set<Post>("Posts");
    items1 = dbContext.set<DataItem>("Items1");
    items2 = dbContext.set<DataItem>("Items2");
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
    // ... (outros asserts inalterados)
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
    // ... (outros asserts inalterados)
  });

  it("Teste Metadata 3: Union", () => {
    const query = items1.select((i) => ({ Val: i.value })).union(items2.select((i) => ({ Val: i.value })));
    const metadata = getMetadata(query.expression); // Passa a expressão
    expect(metadata.$type).toBe(SqlExpressionType.Select);
    // ... (outros asserts inalterados)
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
    // ... (outros asserts inalterados)
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
    // ... (outros asserts inalterados)
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
    // ... (outros asserts inalterados)
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
    // ... (outros asserts inalterados)
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
});
