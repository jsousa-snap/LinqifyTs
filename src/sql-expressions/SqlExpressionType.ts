// --- START OF FILE src/sql-expressions/SqlExpressionType.ts ---

// src/sql-expressions/SqlExpressionType.ts

/**
 * Enumeração dos tipos possíveis de nós em uma árvore de expressão SQL.
 * Ajuda na identificação e processamento de diferentes partes de uma consulta SQL.
 */
export enum SqlExpressionType {
  // Componentes Principais do Select
  Select = "Select", // Representa uma declaração SELECT completa ou subquery.
  Table = "Table", // Representa uma tabela física do banco de dados.
  Column = "Column", // Representa uma coluna de uma tabela.
  Projection = "Projection", // Representa um item na lista do SELECT (expressão + alias).

  // Literais / Constantes
  Constant = "Constant", // Representa um valor constante (número, string, booleano, null, data).

  // Operações
  Binary = "Binary", // Representa uma operação binária (ex: +, -, =, AND, OR).
  Like = "Like", // Representa uma operação SQL LIKE.
  FunctionCall = "FunctionCall", // Representa uma chamada de função SQL (ex: COUNT, MAX, UPPER).
  Case = "Case", // Representa uma expressão CASE WHEN.
  In = "In", // <<< NOVO: Representa uma operação IN (value IN (list)).

  // Joins
  InnerJoin = "InnerJoin", // Representa uma operação INNER JOIN.
  LeftJoin = "LeftJoin", // Representa uma operação LEFT JOIN.
  // Outros tipos de JOIN (RightJoin, etc.) podem ser adicionados aqui.

  // Subqueries / Predicados
  Exists = "Exists", // Representa um predicado EXISTS(subquery).
  ScalarSubqueryAsJson = "ScalarSubqueryAsJson", // Subquery escalar formatada como JSON (FOR JSON).
  ScalarSubquery = "ScalarSubquery", // Subquery que retorna um único valor escalar.

  // Fontes Compostas (para FROM)
  Union = "Union", // Representa uma operação UNION ou UNION ALL.
}
// --- END OF FILE src/sql-expressions/SqlExpressionType.ts ---
