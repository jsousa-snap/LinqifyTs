// --- START OF FILE src/__tests__/groupBy.test.ts ---

// --- START OF FILE src/__tests__/groupBy.test.ts ---

// src/__tests__/groupBy.test.ts

import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions

// --- Interfaces ---
interface Employee {
  id: number;
  name: string;
  department: string;
  country: string;
  salary: number;
}
// --- Fim Interfaces ---

const normalizeSql = (sql: string): string => {
  return sql
    .replace(/\s+/g, " ") // Replace multiple spaces/newlines with single space
    .trim();
};

describe("Queryable GroupBy Tests", () => {
  let dbContext: DbContext;
  let employees: IQueryable<Employee>;

  beforeEach(() => {
    dbContext = new DbContext();
    employees = dbContext.set<Employee>("Employees");

    // Mock console.warn to avoid polluting test output
    jest.spyOn(console, "warn").mockImplementation();
    // Mock console.error as well if needed for specific tests
    // jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore original console functions
  });

  it("Teste GroupBy 1: Group by single key and count", () => {
    const query = employees.groupBy(
      (e) => e.department, // keySelector
      (key, group) => ({ Department: key, EmployeeCount: group.count() }) // resultSelector
    );

    const expectedSql = `
SELECT [t0].[department] AS [Department], COUNT(1) AS [EmployeeCount]
FROM [Employees] AS [t0]
GROUP BY [t0].[department]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 2: Group by single key and sum salary", () => {
    const query = employees.groupBy(
      (e) => e.department,
      (key, group) => ({
        Department: key,
        TotalSalary: group.sum((e) => e.salary),
      })
    );

    const expectedSql = `
SELECT [t0].[department] AS [Department], SUM([t0].[salary]) AS [TotalSalary]
FROM [Employees] AS [t0]
GROUP BY [t0].[department]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 3: Group by composite key and calculate average salary", () => {
    const query = employees.groupBy(
      (e) => ({ dept: e.department, country: e.country }), // Composite key
      (key, group) => ({
        Department: key.dept, // Access composite key member
        Country: key.country, // Access composite key member
        AverageSalary: group.avg((e) => e.salary),
      })
    );

    const expectedSql = `
SELECT [t0].[department] AS [Department], [t0].[country] AS [Country], AVG([t0].[salary]) AS [AverageSalary]
FROM [Employees] AS [t0]
GROUP BY [t0].[department], [t0].[country]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 4: Group by key and multiple aggregates", () => {
    const query = employees.groupBy(
      (e) => e.country,
      (key, group) => ({
        Country: key,
        Count: group.count(),
        MinSalary: group.min((e) => e.salary),
        MaxSalary: group.max((e) => e.salary),
      })
    );

    const expectedSql = `
SELECT [t0].[country] AS [Country], COUNT(1) AS [Count], MIN([t0].[salary]) AS [MinSalary], MAX([t0].[salary]) AS [MaxSalary]
FROM [Employees] AS [t0]
GROUP BY [t0].[country]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 5: Group by after Where clause", () => {
    const query = employees
      .where((e) => e.salary > 50000)
      .groupBy(
        (e) => e.department,
        (key, group) => ({ Department: key, HighSalaryCount: group.count() })
      );

    const expectedSql = `
SELECT [t0].[department] AS [Department], COUNT(1) AS [HighSalaryCount]
FROM [Employees] AS [t0]
WHERE [t0].[salary] > 50000
GROUP BY [t0].[department]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  // Simula o HAVING usando Where após GroupBy
  it("Teste GroupBy 6: Group by and filter groups (HAVING equivalent)", () => {
    const query = employees
      .groupBy(
        (e) => e.department,
        (key, group) => ({ Department: key, Count: group.count() })
      )
      .where((g) => g.Count > 10); // Filtro aplicado *após* o GroupBy

    // *** CORRIGIDO: Espera HAVING agora ***
    const expectedSql = `
SELECT [t0].[department] AS [Department], COUNT(1) AS [Count]
FROM [Employees] AS [t0]
GROUP BY [t0].[department]
HAVING COUNT(1) > 10
    `;
    const actualSql = query.toQueryString();
    // *** CORRIGIDO: Descomentado e comparando com HAVING ***
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 7: Group by constant key (groups all)", () => {
    const query = employees.groupBy(
      (e) => 1, // Group all employees into a single group
      (key, group) => ({
        TotalEmployees: group.count(),
        AverageSalary: group.avg((e) => e.salary),
      })
    );

    // Grouping by a constant doesn't usually translate to GROUP BY 1 in SQL.
    // It typically results in aggregates over the whole table without a GROUP BY clause.
    // O SQL Server aceita GROUP BY <constante>, então manteremos assim por enquanto.
    const expectedSql = `
SELECT COUNT(1) AS [TotalEmployees], AVG([t0].[salary]) AS [AverageSalary]
FROM [Employees] AS [t0]
GROUP BY 1
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/groupBy.test.ts ---
