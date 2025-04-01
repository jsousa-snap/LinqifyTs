// --- START OF FILE src/query/generation/utils/sqlUtils.ts ---

import {
  OperatorType as LinqOperatorType, // Renomeia para evitar conflito interno
  ConstantExpression,
  OperatorType,
} from "../../../expressions";

// Reexporta o OperatorType do LINQ para uso nos visitors SQL
export { LinqOperatorType as OperatorType };

/**
 * Gera a representação literal SQL para um valor JavaScript.
 * Lida com strings, números, booleanos, null, undefined e datas.
 * Escapa apóstrofos em strings.
 *
 * @export
 * @param {*} value O valor JavaScript a ser convertido.
 * @returns {string} A representação literal SQL.
 * @throws {Error} Se o tipo do valor não for suportado.
 */
export function generateSqlLiteral(value: any): string {
  if (value === null || typeof value === "undefined") return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`; // Escapa apóstrofos
  if (typeof value === "number" && Number.isFinite(value))
    return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0"; // Converte boolean para 1 ou 0
  if (value instanceof Date) return `'${value.toISOString()}'`; // Formato ISO 8601 para datas
  throw new Error(
    `Unsupported literal type for SQL generation: ${typeof value}`
  );
}

/**
 * Mapeia um OperatorType da árvore de expressão LINQ para o operador SQL correspondente.
 *
 * @export
 * @param {LinqOperatorType} op O operador LINQ.
 * @returns {string} O operador SQL como string.
 * @throws {Error} Se o operador LINQ não for suportado para tradução SQL.
 */
export function mapOperatorToSql(op: LinqOperatorType): string {
  switch (op) {
    case LinqOperatorType.Equal:
      return "=";
    case LinqOperatorType.NotEqual:
      return "!="; // Ou <> dependendo do dialeto SQL
    case LinqOperatorType.GreaterThan:
      return ">";
    case LinqOperatorType.GreaterThanOrEqual:
      return ">=";
    case LinqOperatorType.LessThan:
      return "<";
    case LinqOperatorType.LessThanOrEqual:
      return "<=";
    case LinqOperatorType.And:
      return "AND";
    case LinqOperatorType.Or:
      return "OR";
    case LinqOperatorType.Add:
      return "+";
    case LinqOperatorType.Subtract:
      return "-";
    default:
      const exhaustiveCheck: never = op;
      throw new Error(
        `Unsupported operator type encountered in SQL generation: ${exhaustiveCheck}`
      );
  }
}

/**
 * Retorna a precedência numérica de um operador SQL.
 * Números maiores indicam maior precedência.
 * Usado para determinar a necessidade de parênteses em expressões binárias.
 * @param op O tipo do operador.
 * @returns A precedência numérica.
 */
export function getOperatorPrecedence(op: OperatorType): number {
  switch (op) {
    // Adicionar aritméticos se forem suportados
    // case OperatorType.Multiply:
    // case OperatorType.Divide:
    //     return 5;
    case OperatorType.Add:
    case OperatorType.Subtract:
      return 4;
    case OperatorType.Equal:
    case OperatorType.NotEqual:
    case OperatorType.GreaterThan:
    case OperatorType.GreaterThanOrEqual:
    case OperatorType.LessThan:
    case OperatorType.LessThanOrEqual:
      // LIKE também entra aqui em termos de agrupamento com AND/OR
      return 3;
    case OperatorType.And:
      return 2;
    case OperatorType.Or:
      return 1;
    default:
      return 0; // Precedência mais baixa para desconhecidos ou não binários
  }
}

/**
 * Escapa um identificador (nome de tabela, coluna, alias) para uso seguro em SQL Server.
 * Envolve o nome em colchetes `[]` e duplica quaisquer colchetes internos.
 * Retorna '*' ou null/undefined sem alteração.
 *
 * @export
 * @param {string} name O identificador a ser escapado.
 * @returns {string} O identificador escapado.
 */
export function escapeIdentifier(name: string): string {
  if (!name) return name; // Retorna nulo/vazio como está
  if (name === "*") return "*"; // '*' não precisa ser escapado

  const escaped = name.replace(/\]/g, "]]");
  return `[${escaped}]`;
}

/**
 * Extrai o nome da tabela de uma ConstantExpression que representa uma tabela.
 *
 * @export
 * @param {ConstantExpression} tableConstantExpr A expressão constante da tabela.
 * @returns {(string | null)} O nome da tabela ou null se a expressão não for válida.
 */
export function getTableName(
  tableConstantExpr: ConstantExpression
): string | null {
  if (tableConstantExpr.value?.type === "Table") {
    return tableConstantExpr.value.name;
  }
  return null;
}

// --- END OF FILE src/query/generation/utils/sqlUtils.ts ---
