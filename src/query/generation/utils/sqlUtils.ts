/* src/query/generation/utils/sqlUtils.ts */
// --- START OF FILE src/query/generation/utils/sqlUtils.ts ---

import {
  OperatorType as LinqOperatorType, // Renomeia para evitar conflito interno
  ConstantExpression,
} from "../../../expressions";

// IMPORTANTE: Usar o enum importado diretamente
import { OperatorType } from "../../../expressions/BinaryExpression"; // Caminho direto para o enum

// **NOVO: Reexportar OperatorType**
export { OperatorType };

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
 * ATUALIZADO: Adiciona mapeamento para operadores aritméticos e corrige NotEqual.
 *
 * @export
 * @param {OperatorType} op O operador LINQ.
 * @returns {string} O operador SQL como string.
 * @throws {Error} Se o operador LINQ não for suportado para tradução SQL.
 */
export function mapOperatorToSql(op: OperatorType): string {
  switch (op) {
    case OperatorType.Equal:
      return "=";
    case OperatorType.NotEqual:
      return "<>"; // <<< CORRIGIDO de != para <>
    case OperatorType.GreaterThan:
      return ">";
    case OperatorType.GreaterThanOrEqual:
      return ">=";
    case OperatorType.LessThan:
      return "<";
    case OperatorType.LessThanOrEqual:
      return "<=";
    case OperatorType.And:
      return "AND";
    case OperatorType.Or:
      return "OR";
    // ** NOVO: Aritméticos **
    case OperatorType.Add:
      return "+";
    case OperatorType.Subtract:
      return "-";
    case OperatorType.Multiply:
      return "*";
    case OperatorType.Divide:
      return "/";
    // ** FIM: Aritméticos **
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
 * ATUALIZADO: Adiciona precedência para operadores aritméticos.
 *
 * @param op O tipo do operador.
 * @returns A precedência numérica.
 */
export function getOperatorPrecedence(op: OperatorType): number {
  switch (op) {
    // ** NOVO: Aritméticos (precedência maior) **
    case OperatorType.Multiply:
    case OperatorType.Divide:
      return 5;
    case OperatorType.Add:
    case OperatorType.Subtract:
      return 4;
    // ** FIM: Aritméticos **
    // Comparação e LIKE (precedência menor que aritméticos)
    case OperatorType.Equal:
    case OperatorType.NotEqual:
    case OperatorType.GreaterThan:
    case OperatorType.GreaterThanOrEqual:
    case OperatorType.LessThan:
    case OperatorType.LessThanOrEqual:
      return 3;
    // Lógicos (precedência menor que comparação)
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
