// --- START OF FILE src/__tests__/union.test.ts ---

// src/__tests__/union.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions
import { normalizeSql } from "./utils/testUtils"; // <<< IMPORTADO (caminho correto)
// --- Interfaces ---
// Usaremos uma interface simples para os testes de Union/Concat
interface DataItem {
  id: number;
  value: string;
  category: string;
}

// Adicionando uma interface User para o novo teste
interface User {
  userId: number;
  name: string;
}

interface DataItemDto {
  itemId: number;
  itemValue: string;
}
// --- Fim Interfaces ---

describe("Queryable Union/Concat Tests", () => {
  let dbContext: DbContext;
  let set1: IQueryable<DataItem>;
  let set2: IQueryable<DataItem>;
  let set3: IQueryable<DataItem>; // Outro set para testes
  let users: IQueryable<User>; // Para o novo teste

  beforeEach(() => {
    dbContext = new DbContext();
    // Assume tabelas 'Items1', 'Items2', 'Items3' com a estrutura de DataItem
    set1 = dbContext.set<DataItem>("Items1");
    set2 = dbContext.set<DataItem>("Items2");
    set3 = dbContext.set<DataItem>("Items3");
    users = dbContext.set<User>("Users"); // Set de usuários

    // Mock console.warn para evitar poluir a saída do teste
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    // Restaura mocks
    jest.restoreAllMocks();
  });

  // Testes com aliases corrigidos
  it("Teste Union 1: Simple Union", () => {
    const query = set1.union(set2);
    // set1 -> i, set2 -> i1, union -> un
    const expectedOuterSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
    ) AS [u]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 2: Simple Concat (UNION ALL)", () => {
    const query = set1.concat(set2);

    const expectedOuterSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION ALL
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
    ) AS [u]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 3: Union with Where clauses", () => {
    const query = set1
      .where((item) => item.category === "A") // Alias interno 'i'
      .union(set2.where((item) => item.id > 10)); // Alias interno 'i1'
    // union -> un
    const expectedOuterSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
            WHERE [i].[category] = 'A'
        )
        UNION
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
            WHERE [i1].[id] > 10
        )
    ) AS [u]`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 4: Concat with Select projections", () => {
    const query = set1
      .select((i) => ({ itemId: i.id, itemValue: i.value })) // Alias interno 'i'
      .concat(set2.select((i) => ({ itemId: i.id, itemValue: i.value }))); // Alias interno 'i1'
    // union -> un
    const expectedOuterSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].[id] AS [itemId], [i].[value] AS [itemValue]
            FROM [Items1] AS [i]
        )
        UNION ALL
        (
            SELECT [i1].[id] AS [itemId], [i1].[value] AS [itemValue]
            FROM [Items2] AS [i1]
        )
    ) AS [u]`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 5: Union followed by Where", () => {
    const query = set1
      .union(set2) // union -> un
      .where((combined) => combined.value.includes("test")); // Referencia 'un'
    const expectedSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
    ) AS [u]
WHERE [u].[value] LIKE '%test%'`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 6: Concat followed by OrderBy", () => {
    const query = set1
      .concat(set2) // union -> un
      .orderBy((combined) => combined.id); // Referencia 'un'
    const expectedSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION ALL
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
    ) AS [u]
ORDER BY [u].[id] ASC`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 7: Union followed by Select", () => {
    const query = set1
      .union(set2) // union -> un
      .select((combined) => ({ OnlyValue: combined.value })); // Referencia 'un'
    const expectedSql = `
SELECT [u].[value] AS [OnlyValue]
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
    ) AS [u]`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 8: Union of three sets (Flattened)", () => {
    const query = set1.union(set2).union(set3);
    const expectedSql = `
SELECT [u1].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
        UNION
        (
            SELECT [i2].*
            FROM [Items3] AS [i2]
        )
    ) AS [u1]`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 9: Union with compatible DTO projections", () => {
    const projectedSet1 = set1 // alias interno 'i'
      .where((i) => i.id < 5)
      .select((i) => ({ id: i.id, text: i.value }));
    const projectedSet3 = set3 // alias interno 'i1'
      .where((i) => i.category == "X")
      .select((i) => ({ id: i.id, text: i.category + i.value }));

    const query = projectedSet1.union(projectedSet3); // union -> un
    const expectedSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].[id], [i].[value] AS [text]
            FROM [Items1] AS [i]
            WHERE [i].[id] < 5
        )
        UNION
        (
            SELECT [i1].[id], [i1].[category] + [i1].[value] AS [text]
            FROM [Items3] AS [i1]
            WHERE [i1].[category] = 'X'
        )
    ) AS [u]`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 10: Concat followed by Take", () => {
    const query = set1
      .concat(set2) // union -> un
      .orderBy((c) => c.id) // referencia un
      .take(10);
    const expectedSql = `
SELECT [u].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION ALL
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
    ) AS [u]
ORDER BY [u].[id] ASC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 11: Union of (set1 UNION set2) and (set3 UNION set1) (Flattened)", () => {
    const union12 = set1.union(set2); // union interna -> un (fontes i, i1)
    const union31 = set3.union(set1); // union interna -> un1 (fontes i2, i3)
    const query = union12.union(union31); // union externa -> un2 (fontes i, i1, un1)
    const expectedSql = `
SELECT [u2].*
FROM (
        (
            SELECT [i].*
            FROM [Items1] AS [i]
        )
        UNION
        (
            SELECT [i1].*
            FROM [Items2] AS [i1]
        )
        UNION
        (
            SELECT [u1].*
            FROM (
                    (
                        SELECT [i2].*
                        FROM [Items3] AS [i2]
                    )
                    UNION
                    (
                        SELECT [i3].*
                        FROM [Items1] AS [i3]
                    )
                ) AS [u1]
        )
    ) AS [u2]`;

    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 12: Union inside Subquery Projection", () => {
    const proj1 = set1
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));
    const proj2 = set2
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));
    const query = users.provideScope({ proj1, proj2 }).select((user) => ({
      // parâmetro user -> alias u
      UserName: user.name,
      CategoryAValues: proj1.union(proj2).select((p) => p.itemValue), // parâmetro p -> alias un
    }));
    const expectedSql = `
SELECT [u].[name] AS [UserName], JSON_QUERY(COALESCE((
    SELECT [u1].[itemValue]
    FROM (
            (
                SELECT [i].[value] AS [itemValue]
                FROM [Items1] AS [i]
                WHERE [i].[category] = 'A'
            )
            UNION
            (
                SELECT [i1].[value] AS [itemValue]
                FROM [Items2] AS [i1]
                WHERE [i1].[category] = 'A'
            )
        ) AS [u1]
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [CategoryAValues]
FROM [Users] AS [u]`;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 13: Union inside Subquery Projection limit 1", () => {
    const proj1 = set1
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));
    const proj2 = set2
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));
    const query = users.provideScope({ proj1, proj2 }).select((user) => ({
      // user -> u
      UserName: user.name,
      CategoryAValue: proj1
        .union(proj2)
        .select((p) => p.itemValue) // p -> un
        .take(1),
    }));
    const expectedSql = `
SELECT [u].[name] AS [UserName], (
    SELECT [u1].[itemValue]
    FROM (
            (
                SELECT [i].[value] AS [itemValue]
                FROM [Items1] AS [i]
                WHERE [i].[category] = 'A'
            )
            UNION
            (
                SELECT [i1].[value] AS [itemValue]
                FROM [Items2] AS [i1]
                WHERE [i1].[category] = 'A'
            )
        ) AS [u1]
    ORDER BY (SELECT NULL)
    OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
) AS [CategoryAValue]
FROM [Users] AS [u]
      `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/union.test.ts ---
