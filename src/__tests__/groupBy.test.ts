import { DbContext } from "../core";
import { IQueryable } from "../interfaces";
import "../query/QueryableExtensions"; // Apply extensions
import { normalizeSql } from "./utils/testUtils";

// --- Interfaces ---
interface Employee {
  id: number;
  name: string;
  department: string;
  country: string;
  salary: number;
}
// --- Fim Interfaces ---

describe("Queryable GroupBy Tests", () => {
  let dbContext: DbContext;
  let employees: IQueryable<Employee>;

  beforeEach(() => {
    dbContext = new DbContext();
    employees = dbContext.set<Employee>("Employees");
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Teste GroupBy 1: Group by single key and count", () => {
    const query = employees.groupBy(
      (e) => e.department,
      // **** CORREÇÃO: Usa group.count() ****
      (key, group) => ({ Department: key, EmployeeCount: group.count() })
    );

    const expectedSql = `
SELECT [e].[department] AS [Department], COUNT(1) AS [EmployeeCount]
FROM [Employees] AS [e]
GROUP BY [e].[department]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 2: Group by single key and sum salary", () => {
    const query = employees.groupBy(
      (e) => e.department,
      // **** CORREÇÃO: Usa group.sum() ****
      (key, group) => ({
        Department: key,
        TotalSalary: group.sum((e: Employee) => e.salary),
      })
    );

    const expectedSql = `
SELECT [e].[department] AS [Department], SUM([e].[salary]) AS [TotalSalary]
FROM [Employees] AS [e]
GROUP BY [e].[department]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 3: Group by composite key and calculate average salary", () => {
    const query = employees.groupBy(
      (e) => ({ dept: e.department, country: e.country }),
      // **** CORREÇÃO: Usa group.avg() ****
      (key, group) => ({
        Department: key.dept,
        Country: key.country,
        AverageSalary: group.avg((e: Employee) => e.salary),
      })
    );

    const expectedSql = `
SELECT [e].[department] AS [Department], [e].[country] AS [Country], AVG([e].[salary]) AS [AverageSalary]
FROM [Employees] AS [e]
GROUP BY [e].[department], [e].[country]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 4: Group by key and multiple aggregates", () => {
    const query = employees.groupBy(
      (e) => e.country,
      // **** CORREÇÃO: Usa group.count(), min(), max() ****
      (key, group) => ({
        Country: key,
        Count: group.count(),
        MinSalary: group.min((e: Employee) => e.salary),
        MaxSalary: group.max((e: Employee) => e.salary),
      })
    );

    const expectedSql = `
SELECT [e].[country] AS [Country], COUNT(1) AS [Count], MIN([e].[salary]) AS [MinSalary], MAX([e].[salary]) AS [MaxSalary]
FROM [Employees] AS [e]
GROUP BY [e].[country]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 5: Group by after Where clause", () => {
    const query = employees
      .where((e) => e.salary > 50000)
      .groupBy(
        (e) => e.department,
        // **** CORREÇÃO: Usa group.count() ****
        (key, group) => ({ Department: key, HighSalaryCount: group.count() })
      );

    const expectedSql = `
SELECT [e].[department] AS [Department], COUNT(1) AS [HighSalaryCount]
FROM [Employees] AS [e]
WHERE [e].[salary] > 50000
GROUP BY [e].[department]
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 6: Group by and filter groups (HAVING equivalent)", () => {
    const query = employees
      .groupBy(
        (e) => e.department,
        // **** CORREÇÃO: Usa group.count() ****
        (key, group) => ({ Department: key, Count: group.count() })
      )
      .where((g) => g.Count > 10);

    const expectedSql = `
SELECT [e].[department] AS [Department], COUNT(1) AS [Count]
FROM [Employees] AS [e]
GROUP BY [e].[department]
HAVING COUNT(1) > 10
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });

  it("Teste GroupBy 7: Group by constant key (groups all)", () => {
    const query = employees.groupBy(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (e) => 1,
      // **** CORREÇÃO: Usa group.count(), avg() ****
      (key, group) => ({
        TotalEmployees: group.count(),
        AverageSalary: group.avg((e: Employee) => e.salary),
      })
    );

    const expectedSql = `
SELECT COUNT(1) AS [TotalEmployees], AVG([e].[salary]) AS [AverageSalary]
FROM [Employees] AS [e]
GROUP BY 1
    `;
    const actualSql = query.toQueryString();
    expect(normalizeSql(actualSql)).toEqual(normalizeSql(expectedSql));
  });
});
// --- END OF FILE src/__tests__/groupBy.test.ts ---
