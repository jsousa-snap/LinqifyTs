// --- START OF FILE src/__tests__/metadata.test.ts ---
import { DbContext } from "../core";
import "../query/QueryableExtensions";
import { IQueryable } from "../interfaces";
import { QueryExpressionVisitor } from "../query/translation/QueryExpressionVisitor"; // Importar Visitor
import {
  // Importar tipos de expressão SQL
  SqlExpression,
  SelectExpression,
  TableExpression,
  ColumnExpression,
  SqlBinaryExpression,
  SqlConstantExpression,
  ProjectionExpression,
  InnerJoinExpression,
  CompositeUnionExpression,
  SqlFunctionCallExpression,
  SqlScalarSubqueryAsJsonExpression,
  SqlExpressionType, // Importar o Enum de tipos SQL

  // Importar interfaces de metadados SQL (essencial para os asserts)
  SelectExpressionMetadata,
  TableExpressionMetadata,
  ColumnExpressionMetadata,
  SqlBinaryExpressionMetadata,
  SqlConstantExpressionMetadata,
  ProjectionExpressionMetadata,
  InnerJoinExpressionMetadata,
  CompositeUnionExpressionMetadata,
  SqlFunctionCallExpressionMetadata,
  SqlScalarSubqueryAsJsonExpressionMetadata,
} from "../sql-expressions"; // Ajuste o caminho se necessário

// Interfaces de Entidade (simplificadas para os testes)
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

describe("SQL Expression Metadata Generation Tests", () => {
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
    visitor = new QueryExpressionVisitor(); // Instanciar o visitor
  });

  // Helper para traduzir e obter metadados
  function getMetadata(query: IQueryable<any>): any {
    // Retorna any para facilitar asserts iniciais
    const sqlExpr = visitor.translate(query.expression);
    return sqlExpr.toMetadata();
  }

  it("Teste Metadata 1: Simple Select/Where", () => {
    const query = users
      .where((u) => u.age > 30 && u.name == "Alice")
      .select((u) => u.email);

    const metadata = getMetadata(query);
    // console.log("Metadata 1:\n", JSON.stringify(metadata, null, 2));

    expect(metadata.$type).toBe(SqlExpressionType.Select);
    const selectMeta = metadata as SelectExpressionMetadata;

    // Projection
    expect(selectMeta.projection).toHaveLength(1);
    const proj = selectMeta.projection[0];
    expect(proj.$type).toBe(SqlExpressionType.Projection);
    expect(proj.alias).toBe("email");
    expect(proj.expression.$type).toBe(SqlExpressionType.Column);
    expect((proj.expression as ColumnExpressionMetadata).name).toBe("email");
    expect((proj.expression as ColumnExpressionMetadata).table.$type).toBe(
      SqlExpressionType.Table
    );
    expect(
      (
        (proj.expression as ColumnExpressionMetadata)
          .table as TableExpressionMetadata
      ).name
    ).toBe("Users");
    const tableAlias = (
      (proj.expression as ColumnExpressionMetadata)
        .table as TableExpressionMetadata
    ).alias; // Guarda o alias para usar abaixo

    // From
    expect(selectMeta.from.$type).toBe(SqlExpressionType.Table);
    expect((selectMeta.from as TableExpressionMetadata).name).toBe("Users");
    expect((selectMeta.from as TableExpressionMetadata).alias).toBe(tableAlias);

    // Predicate (Where)
    expect(selectMeta.predicate).not.toBeNull();
    expect(selectMeta.predicate?.$type).toBe(SqlExpressionType.Binary);
    const predicate = selectMeta.predicate as SqlBinaryExpressionMetadata;
    expect(predicate.operator).toBe("&&"); // Ou "AND" dependendo do enum/mapeamento

    // Left side of AND
    expect(predicate.left.$type).toBe(SqlExpressionType.Binary);
    const leftAnd = predicate.left as SqlBinaryExpressionMetadata;
    expect(leftAnd.operator).toBe(">");
    expect(leftAnd.left.$type).toBe(SqlExpressionType.Column);
    expect((leftAnd.left as ColumnExpressionMetadata).name).toBe("age");
    expect(
      (
        (leftAnd.left as ColumnExpressionMetadata)
          .table as TableExpressionMetadata
      ).alias
    ).toBe(tableAlias);
    expect(leftAnd.right.$type).toBe(SqlExpressionType.Constant);
    expect((leftAnd.right as SqlConstantExpressionMetadata).value).toBe(30);

    // Right side of AND
    expect(predicate.right.$type).toBe(SqlExpressionType.Binary);
    const rightAnd = predicate.right as SqlBinaryExpressionMetadata;
    expect(rightAnd.operator).toBe("=="); // Ou "="
    expect(rightAnd.left.$type).toBe(SqlExpressionType.Column);
    expect((rightAnd.left as ColumnExpressionMetadata).name).toBe("name");
    expect(
      (
        (rightAnd.left as ColumnExpressionMetadata)
          .table as TableExpressionMetadata
      ).alias
    ).toBe(tableAlias);
    expect(rightAnd.right.$type).toBe(SqlExpressionType.Constant);
    expect((rightAnd.right as SqlConstantExpressionMetadata).value).toBe(
      "Alice"
    );

    // Joins, GroupBy, OrderBy, Offset, Limit should be empty/null
    expect(selectMeta.joins).toEqual([]);
    expect(selectMeta.groupBy).toEqual([]);
    expect(selectMeta.orderBy).toEqual([]);
    expect(selectMeta.offset).toBeNull();
    expect(selectMeta.limit).toBeNull();
  });

  it("Teste Metadata 2: Inner Join", () => {
    const query = users.join(
      posts,
      (u) => u.id,
      (p) => p.authorId,
      (u, p) => ({ UserName: u.name, PostTitle: p.title })
    );

    const metadata = getMetadata(query);
    // console.log("Metadata 2:\n", JSON.stringify(metadata, null, 2));

    expect(metadata.$type).toBe(SqlExpressionType.Select);
    const selectMeta = metadata as SelectExpressionMetadata;

    // Projections
    expect(selectMeta.projection).toHaveLength(2);
    expect(selectMeta.projection[0].alias).toBe("UserName");
    expect(
      (selectMeta.projection[0].expression as ColumnExpressionMetadata).name
    ).toBe("name");
    const userAlias = (
      (selectMeta.projection[0].expression as ColumnExpressionMetadata)
        .table as TableExpressionMetadata
    ).alias;
    expect(selectMeta.projection[1].alias).toBe("PostTitle");
    expect(
      (selectMeta.projection[1].expression as ColumnExpressionMetadata).name
    ).toBe("title");
    const postAlias = (
      (selectMeta.projection[1].expression as ColumnExpressionMetadata)
        .table as TableExpressionMetadata
    ).alias;

    // From
    expect(selectMeta.from.$type).toBe(SqlExpressionType.Table);
    expect((selectMeta.from as TableExpressionMetadata).name).toBe("Users");
    expect((selectMeta.from as TableExpressionMetadata).alias).toBe(userAlias);

    // Joins
    expect(selectMeta.joins).toHaveLength(1);
    const join = selectMeta.joins[0] as InnerJoinExpressionMetadata;
    expect(join.$type).toBe(SqlExpressionType.InnerJoin);
    expect(join.table.$type).toBe(SqlExpressionType.Table);
    expect(join.table.name).toBe("Posts");
    expect(join.table.alias).toBe(postAlias);

    // Join Predicate
    expect(join.joinPredicate.$type).toBe(SqlExpressionType.Binary);
    const joinPred = join.joinPredicate as SqlBinaryExpressionMetadata;
    expect(joinPred.operator).toBe("=="); // ou "="
    expect((joinPred.left as ColumnExpressionMetadata).name).toBe("id");
    expect(
      (
        (joinPred.left as ColumnExpressionMetadata)
          .table as TableExpressionMetadata
      ).alias
    ).toBe(userAlias);
    expect((joinPred.right as ColumnExpressionMetadata).name).toBe("authorId");
    expect(
      (
        (joinPred.right as ColumnExpressionMetadata)
          .table as TableExpressionMetadata
      ).alias
    ).toBe(postAlias);

    expect(selectMeta.predicate).toBeNull();
    expect(selectMeta.groupBy).toEqual([]);
    expect(selectMeta.orderBy).toEqual([]);
    expect(selectMeta.offset).toBeNull();
    expect(selectMeta.limit).toBeNull();
  });

  it("Teste Metadata 3: Union", () => {
    const query = items1
      .select((i) => ({ Val: i.value }))
      .union(items2.select((i) => ({ Val: i.value })));

    const metadata = getMetadata(query);
    // console.log("Metadata 3:\n", JSON.stringify(metadata, null, 2));

    expect(metadata.$type).toBe(SqlExpressionType.Select); // A raiz ainda é SELECT * FROM (UNION)
    const selectMeta = metadata as SelectExpressionMetadata;

    // From deve ser Union
    expect(selectMeta.from.$type).toBe(SqlExpressionType.Union);
    const unionMeta = selectMeta.from as CompositeUnionExpressionMetadata;
    const unionAlias = unionMeta.alias;
    expect(unionMeta.distinct).toBe(true);
    expect(unionMeta.sources).toHaveLength(2);

    // Source 1 (Items1)
    const source1 = unionMeta.sources[0] as SelectExpressionMetadata;
    expect(source1.$type).toBe(SqlExpressionType.Select);
    expect((source1.from as TableExpressionMetadata).name).toBe("Items1");
    expect(source1.projection[0].alias).toBe("Val");
    expect(
      (source1.projection[0].expression as ColumnExpressionMetadata).name
    ).toBe("value");

    // Source 2 (Items2)
    const source2 = unionMeta.sources[1] as SelectExpressionMetadata;
    expect(source2.$type).toBe(SqlExpressionType.Select);
    expect((source2.from as TableExpressionMetadata).name).toBe("Items2");
    expect(source2.projection[0].alias).toBe("Val");
    expect(
      (source2.projection[0].expression as ColumnExpressionMetadata).name
    ).toBe("value");

    // Projeção externa deve ser *
    expect(selectMeta.projection).toHaveLength(1);
    expect(selectMeta.projection[0].alias).toBe("*");
    expect(
      (selectMeta.projection[0].expression as ColumnExpressionMetadata).name
    ).toBe("*");
    // A tabela referenciada pela projeção * deve ter o alias da UNION
    expect(
      (
        (selectMeta.projection[0].expression as ColumnExpressionMetadata)
          .table as TableExpressionMetadata
      ).alias
    ).toBe(unionAlias);
  });

  it("Teste Metadata 4: Subquery Projection (FOR JSON)", () => {
    const query = users.provideScope({ posts }).select((u) => ({
      UserName: u.name,
      PostTitles: posts
        .where((p) => p.authorId === u.id)
        .select((p) => p.title)
        .take(5),
    }));

    const metadata = getMetadata(query);
    //   console.log("Metadata 4:\n", JSON.stringify(metadata, null, 2));

    expect(metadata.$type).toBe(SqlExpressionType.Select);
    const selectMeta = metadata as SelectExpressionMetadata;
    expect(selectMeta.projection).toHaveLength(2);

    // UserName Projection
    expect(selectMeta.projection[0].alias).toBe("UserName");
    expect(
      (selectMeta.projection[0].expression as ColumnExpressionMetadata).name
    ).toBe("name");

    // PostTitles Projection
    expect(selectMeta.projection[1].alias).toBe("PostTitles");
    expect(selectMeta.projection[1].expression.$type).toBe(
      SqlExpressionType.ScalarSubqueryAsJson
    );
    const subqMeta = selectMeta.projection[1]
      .expression as SqlScalarSubqueryAsJsonExpressionMetadata;
    expect(subqMeta.withoutArrayWrapper).toBe(false); // take(5) means array

    // Inner SelectExpression of Subquery
    const innerSelect = subqMeta.selectExpression;
    expect(innerSelect.$type).toBe(SqlExpressionType.Select);
    expect((innerSelect.from as TableExpressionMetadata).name).toBe("Posts");
    expect(innerSelect.projection).toHaveLength(1);
    expect(
      (innerSelect.projection[0].expression as ColumnExpressionMetadata).name
    ).toBe("title");
    expect(innerSelect.predicate).not.toBeNull(); // WHERE p.authorId = u.id
    expect(innerSelect.limit).not.toBeNull();
    expect((innerSelect.limit as SqlConstantExpressionMetadata).value).toBe(5);
  });

  it("Teste Metadata 5: Aggregation (COUNT)", () => {
    const query = users.where((u) => u.country === "BR").count();

    // Count é terminal, precisamos traduzir a expressão ANTES da chamada final
    const queryBeforeCount = users.where((u) => u.country === "BR");
    const countLinqExpr =
      new (require("../expressions/MethodCallExpression").MethodCallExpression)(
        "count",
        queryBeforeCount.expression,
        []
      );
    const sqlExpr = visitor.translate(countLinqExpr);
    const metadata = sqlExpr.toMetadata();
    // console.log("Metadata 5:\n", JSON.stringify(metadata, null, 2));

    expect(metadata.$type).toBe(SqlExpressionType.Select);
    const selectMeta = metadata as SelectExpressionMetadata;

    // Projection deve ser COUNT
    expect(selectMeta.projection).toHaveLength(1);
    expect(selectMeta.projection[0].alias).toBe("count_result");
    expect(selectMeta.projection[0].expression.$type).toBe(
      SqlExpressionType.FunctionCall
    );
    const funcCall = selectMeta.projection[0]
      .expression as SqlFunctionCallExpressionMetadata;
    expect(funcCall.functionName.toUpperCase()).toBe("COUNT_BIG"); // Ou COUNT
    expect(funcCall.args).toHaveLength(1);
    expect((funcCall.args[0] as SqlConstantExpressionMetadata).value).toBe(1);

    // From
    expect((selectMeta.from as TableExpressionMetadata).name).toBe("Users");

    // Where
    expect(selectMeta.predicate).not.toBeNull();
    expect(selectMeta.predicate?.$type).toBe(SqlExpressionType.Binary);
    expect(
      (
        (selectMeta.predicate as SqlBinaryExpressionMetadata)
          .left as ColumnExpressionMetadata
      ).name
    ).toBe("country");
    expect(
      (
        (selectMeta.predicate as SqlBinaryExpressionMetadata)
          .right as SqlConstantExpressionMetadata
      ).value
    ).toBe("BR");
  });

  it("Teste Metadata 6: Paging (Skip/Take)", () => {
    const query = users
      .orderBy((u) => u.age)
      .skip(10)
      .take(5);
    const metadata = getMetadata(query);
    // console.log("Metadata 6:\n", JSON.stringify(metadata, null, 2));

    expect(metadata.$type).toBe(SqlExpressionType.Select);
    const selectMeta = metadata as SelectExpressionMetadata;

    // OrderBy
    expect(selectMeta.orderBy).toHaveLength(1);
    expect(selectMeta.orderBy[0].direction).toBe("ASC");
    expect(
      (selectMeta.orderBy[0].expression as ColumnExpressionMetadata).name
    ).toBe("age");

    // Offset
    expect(selectMeta.offset).not.toBeNull();
    expect(selectMeta.offset?.$type).toBe(SqlExpressionType.Constant);
    expect(selectMeta.offset?.value).toBe(10);

    // Limit
    expect(selectMeta.limit).not.toBeNull();
    expect(selectMeta.limit?.$type).toBe(SqlExpressionType.Constant);
    expect(selectMeta.limit?.value).toBe(5);
  });

  it("Teste Metadata 7: GroupBy", () => {
    const query = users
      .where((u) => u.age > 18)
      .groupBy(
        (u) => u.country,
        (key, group) => ({ Country: key, Count: group.count() })
      );

    const metadata = getMetadata(query);
    // console.log("Metadata 7:\n", JSON.stringify(metadata, null, 2));

    expect(metadata.$type).toBe(SqlExpressionType.Select);
    const selectMeta = metadata as SelectExpressionMetadata;

    // GroupBy
    expect(selectMeta.groupBy).toHaveLength(1);
    expect(selectMeta.groupBy[0].$type).toBe(SqlExpressionType.Column);
    expect((selectMeta.groupBy[0] as ColumnExpressionMetadata).name).toBe(
      "country"
    );

    // Projections
    expect(selectMeta.projection).toHaveLength(2);
    // Proj 1 (Key)
    expect(selectMeta.projection[0].alias).toBe("Country");
    expect(selectMeta.projection[0].expression.$type).toBe(
      SqlExpressionType.Column
    );
    expect(
      (selectMeta.projection[0].expression as ColumnExpressionMetadata).name
    ).toBe("country");
    // Proj 2 (Aggregate)
    expect(selectMeta.projection[1].alias).toBe("Count");
    expect(selectMeta.projection[1].expression.$type).toBe(
      SqlExpressionType.FunctionCall
    );
    const funcCall = selectMeta.projection[1]
      .expression as SqlFunctionCallExpressionMetadata;
    expect(funcCall.functionName.toUpperCase()).toBe("COUNT"); // Ou COUNT_BIG dependendo da implementação de groupBy
    expect(funcCall.args).toHaveLength(1);
    expect((funcCall.args[0] as SqlConstantExpressionMetadata).value).toBe(1); // COUNT(1)

    // Where
    expect(selectMeta.predicate).not.toBeNull();
    expect(selectMeta.predicate?.$type).toBe(SqlExpressionType.Binary);
    expect(
      (
        (selectMeta.predicate as SqlBinaryExpressionMetadata)
          .left as ColumnExpressionMetadata
      ).name
    ).toBe("age");
    expect(
      (
        (selectMeta.predicate as SqlBinaryExpressionMetadata)
          .right as SqlConstantExpressionMetadata
      ).value
    ).toBe(18);
  });

  // **** NOVO TESTE DE STRINGIFY ****
  it("Teste Metadata 8: JSON Stringify Comparison for Simple Select/Where", () => {
    const query = users
      .where((u) => u.age > 30 && u.name == "Alice")
      .select((u) => u.email);

    const metadata = getMetadata(query);
    const generatedJson = JSON.stringify(metadata, null, 2); // Usa 2 espaços para formatação

    const expectedJson = `{
  "$type": "Select",
  "projection": [
    {
      "$type": "Projection",
      "expression": {
        "$type": "Column",
        "name": "email",
        "table": {
          "$type": "Table",
          "alias": "t0",
          "name": "Users"
        }
      },
      "alias": "email"
    }
  ],
  "from": {
    "$type": "Table",
    "alias": "t0",
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
          "alias": "t0",
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
          "alias": "t0",
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

    // Compara as strings JSON formatadas
    expect(generatedJson).toEqual(expectedJson);
  });
});
// --- END OF FILE src/__tests__/metadata.test.ts ---
