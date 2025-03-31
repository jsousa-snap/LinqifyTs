// --- START OF FILE src/__tests__/union.test.ts ---

// src/__tests__/union.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions

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

// Helper normalizeSql (inalterado)
const normalizeSql = (sql: string): string => {
  let result = sql;

  // Remove espaços em branco seguidos pela primeira quebra de linha no início
  result = result.replace(/^\s*\n/, "");

  // Remove a última quebra de linha seguida por espaços em branco no final
  result = result.replace(/\n\s*$/, "");

  return result;
};

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

  // Testes 1 a 11 permanecem inalterados
  it("Teste Union 1: Simple Union", () => {
    const query = set1.union(set2);
    const expectedOuterSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
    ) AS [t2]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 2: Simple Concat (UNION ALL)", () => {
    const query = set1.concat(set2);
    const expectedOuterSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION ALL
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
    ) AS [t2]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 3: Union with Where clauses", () => {
    const query = set1
      .where((i) => i.category === "A")
      .union(set2.where((i) => i.id > 10));
    const expectedOuterSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
            WHERE [t0].[category] = 'A'
        )
        UNION
        (SELECT [t1].*
            FROM [Items2] AS [t1]
            WHERE [t1].[id] > 10
        )
    ) AS [t2]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 4: Concat with Select projections", () => {
    // As projeções DEVEM ser compatíveis (mesmos nomes/tipos)
    const query = set1
      .select((i) => ({ itemId: i.id, itemValue: i.value }))
      .concat(set2.select((i) => ({ itemId: i.id, itemValue: i.value })));

    const expectedOuterSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].[id] AS [itemId], [t0].[value] AS [itemValue]
            FROM [Items1] AS [t0]
        )
        UNION ALL
        (SELECT [t1].[id] AS [itemId], [t1].[value] AS [itemValue]
            FROM [Items2] AS [t1]
        )
    ) AS [t2]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedOuterSql));
  });

  it("Teste Union 5: Union followed by Where", () => {
    const query = set1
      .union(set2)
      .where((combined) => combined.value.includes("test"));

    // O WHERE é aplicado sobre o resultado da UNION
    const expectedSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
    ) AS [t2]
WHERE ([t2].[value] LIKE '%test%')
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 6: Concat followed by OrderBy", () => {
    const query = set1.concat(set2).orderBy((combined) => combined.id);

    // O ORDER BY é aplicado sobre o resultado do UNION ALL
    const expectedSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION ALL
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
    ) AS [t2]
ORDER BY [t2].[id] ASC
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 7: Union followed by Select", () => {
    const query = set1
      .union(set2)
      .select((combined) => ({ OnlyValue: combined.value }));

    // O SELECT é aplicado sobre o resultado da UNION
    const expectedSql = `
SELECT [t2].[value] AS [OnlyValue]
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
    ) AS [t2]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 8: Union of three sets (Flattened)", () => {
    // Testa o encadeamento: (set1 UNION set2) UNION set3
    const query = set1.union(set2).union(set3);

    // O resultado esperado agora é plano (sem aninhamento de UNION)
    const expectedSql = `
SELECT [t4].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
        UNION
        (SELECT [t3].*
            FROM [Items3] AS [t3]
        )
    ) AS [t4]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 9: Union with compatible DTO projections", () => {
    // Garante que a união funcione mesmo se as fontes originais forem diferentes,
    // desde que a projeção final seja compatível.
    const projectedSet1 = set1
      .where((i) => i.id < 5)
      .select((i) => ({ id: i.id, text: i.value }));
    const projectedSet3 = set3
      .where((i) => i.category == "X")
      .select((i) => ({ id: i.id, text: i.category + i.value })); // Projeção diferente, mas estrutura compatível

    const query = projectedSet1.union(projectedSet3);

    const expectedSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].[id], [t0].[value] AS [text]
            FROM [Items1] AS [t0]
            WHERE [t0].[id] < 5
        )
        UNION
        (SELECT [t1].[id], [t1].[category] + [t1].[value] AS [text]
            FROM [Items3] AS [t1]
            WHERE [t1].[category] = 'X'
        )
    ) AS [t2]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste Union 10: Concat followed by Take", () => {
    // Testar paginação após união (requer ORDER BY)
    const query = set1
      .concat(set2)
      .orderBy((c) => c.id)
      .take(10);

    const expectedSql = `
SELECT [t2].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION ALL
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
    ) AS [t2]
ORDER BY [t2].[id] ASC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Teste opcional: Union com uma fonte que já é uma união
  it("Teste Union 11: Union of (set1 UNION set2) and (set3 UNION set1) (Flattened)", () => {
    const union12 = set1.union(set2);
    const union31 = set3.union(set1); // set1 aparece em ambas as uniões

    const query = union12.union(union31);

    // Espera-se uma estrutura plana
    // O otimizador SQL pode remover a duplicação do set1, mas a tradução LINQ o incluirá
    const expectedSql = `
SELECT [t6].*
FROM (
        (SELECT [t0].*
            FROM [Items1] AS [t0]
        )
        UNION
        (SELECT [t1].*
            FROM [Items2] AS [t1]
        )
        UNION
        (SELECT [t5].*
            FROM (
                    (SELECT [t3].*
                        FROM [Items3] AS [t3]
                    )
                    UNION
                    (SELECT [t4].*
                        FROM [Items1] AS [t4]
                    )
                ) AS [t5]
        )
    ) AS [t6]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // **** NOVO TESTE ****
  it("Teste Union 12: Union inside Subquery Projection", () => {
    // Define projeções compatíveis para unir
    const proj1 = set1
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));
    const proj2 = set2
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));

    // Query principal selecionando usuários e uma lista de valores de itens da categoria 'A'
    const query = users
      .provideScope({ proj1, proj2 }) // Fornece as projeções ao escopo
      .select((u) => ({
        UserName: u.name,
        CategoryAValues: proj1 // Começa a subquery com a primeira projeção
          .union(proj2) // Une com a segunda projeção DENTRO da subquery
          .select((p) => p.itemValue), // Seleciona apenas o valor final
      }));

    // O SQL esperado terá uma subconsulta FOR JSON contendo a UNION
    const expectedSql = `
SELECT [t0].[name] AS [UserName], JSON_QUERY(COALESCE((
    SELECT [t3].[itemValue]
    FROM (
            (SELECT [t1].[value] AS [itemValue]
                FROM [Items1] AS [t1]
                WHERE [t1].[category] = 'A'
            )
            UNION
            (SELECT [t2].[value] AS [itemValue]
                FROM [Items2] AS [t2]
                WHERE [t2].[category] = 'A'
            )
        ) AS [t3]
    FOR JSON PATH, INCLUDE_NULL_VALUES
), '[]')) AS [CategoryAValues]
FROM [Users] AS [t0]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // **** NOVO TESTE ****
  it("Teste Union 13: Union inside Subquery Projection limit 1", () => {
    // Define projeções compatíveis para unir
    const proj1 = set1
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));
    const proj2 = set2
      .where((i) => i.category == "A")
      .select((i) => ({ itemValue: i.value }));

    // Query principal selecionando usuários e uma lista de valores de itens da categoria 'A'
    const query = users
      .provideScope({ proj1, proj2 }) // Fornece as projeções ao escopo
      .select((u) => ({
        UserName: u.name,
        CategoryAValue: proj1 // Começa a subquery com a primeira projeção
          .union(proj2) // Une com a segunda projeção DENTRO da subquery
          .select((p) => p.itemValue)
          .take(1), // Seleciona apenas o valor final
      }));

    // O SQL esperado terá uma subconsulta FOR JSON contendo a UNION
    const expectedSql = `
SELECT [t0].[name] AS [UserName], (
    SELECT [t3].[itemValue]
    FROM (
            (SELECT [t1].[value] AS [itemValue]
                FROM [Items1] AS [t1]
                WHERE [t1].[category] = 'A'
            )
            UNION
            (SELECT [t2].[value] AS [itemValue]
                FROM [Items2] AS [t2]
                WHERE [t2].[category] = 'A'
            )
        ) AS [t3]
    ORDER BY (SELECT NULL)
    OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
) AS [CategoryAValue]
FROM [Users] AS [t0]
      `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
  // **** FIM NOVO TESTE ****
});
// --- END OF FILE src/__tests__/union.test.ts ---
