// --- START OF FILE src/sql-expressions/InnerJoinExpression.ts ---

// --- START OF FILE src/sql-expressions/InnerJoinExpression.ts ---

import {
  JoinExpressionBase,
  JoinExpressionBaseMetadata,
} from "./JoinExpressionBase"; // Importar JoinExpressionBaseMetadata
import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata
// *** CORREÇÃO: Importar TableExpressionBase ***
import {
  TableExpressionBase,
  TableExpressionBaseMetadata,
} from "./TableExpressionBase"; // Importar TableExpressionBase
import { SqlExpressionType } from "./SqlExpressionType";
import { escapeIdentifier } from "../query/generation/utils/sqlUtils";

// Nova interface de metadados para InnerJoinExpression (opcional, só para type safety extra)
// *** CORREÇÃO: Usar TableExpressionBaseMetadata ***
export interface InnerJoinExpressionMetadata
  extends JoinExpressionBaseMetadata {
  $type: SqlExpressionType.InnerJoin;
  table: TableExpressionBaseMetadata; // <<< Usa metadados base
}

/**
 * Representa uma operação INNER JOIN SQL.
 * A tabela juntada (`table`) pode ser uma tabela física, uma subconsulta SELECT ou uma UNION.
 *
 * @export
 * @class InnerJoinExpression
 * @extends {JoinExpressionBase}
 */
export class InnerJoinExpression extends JoinExpressionBase {
  /**
   * O tipo desta expressão (InnerJoin).
   * @override
   * @readonly
   * @type {SqlExpressionType.InnerJoin}
   * @memberof InnerJoinExpression
   */
  public override readonly type = SqlExpressionType.InnerJoin;

  /**
   * Cria uma instância de InnerJoinExpression.
   * @param {TableExpressionBase} table A fonte de dados a ser juntada (Tabela, Select ou Union).
   * @param {SqlExpression} joinPredicate A condição SQL da cláusula ON.
   * @memberof InnerJoinExpression
   */
  // *** CORREÇÃO: Aceitar TableExpressionBase ***
  constructor(table: TableExpressionBase, joinPredicate: SqlExpression) {
    super(table, joinPredicate); // <<< Passa TableExpressionBase para o construtor base
  }

  /**
   * Retorna a representação em string desta expressão INNER JOIN para depuração.
   * Exemplo: INNER JOIN [OutraTabela] AS [t1] ON [t0].[id] = [t1].[userId]
   *          INNER JOIN (SELECT ... ) AS [t2] ON [t0].[id] = [t2].[key]
   *
   * @override
   * @returns {string}
   * @memberof InnerJoinExpression
   */
  override toString(): string {
    // O toString da fonte (table) cuidará de gerar (SELECT...) AS alias ou Tabela AS alias
    return `INNER JOIN ${this.table.toString()} ON ${this.joinPredicate.toString()}`;
  }

  /**
   * Converte esta expressão InnerJoin para seus metadados serializáveis em JSON.
   *
   * @override
   * @returns {InnerJoinExpressionMetadata}
   * @memberof InnerJoinExpression
   */
  override toMetadata(): InnerJoinExpressionMetadata {
    const baseMeta = super.toMetadata(); // Chama o método da base
    return {
      ...baseMeta,
      // Garante que table use TableExpressionBaseMetadata
      table: this.table.toMetadata() as TableExpressionBaseMetadata,
      $type: SqlExpressionType.InnerJoin, // Redefine para InnerJoin
    };
  }
}

// --- END OF FILE src/sql-expressions/InnerJoinExpression.ts ---
