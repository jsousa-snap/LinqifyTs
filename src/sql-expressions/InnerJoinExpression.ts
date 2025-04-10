import { JoinExpressionBase, JoinExpressionBaseMetadata } from "./JoinExpressionBase";
import { SqlExpression } from "./SqlExpression";
import { TableExpressionBase, TableExpressionBaseMetadata } from "./TableExpressionBase";
import { SqlExpressionType } from "./SqlExpressionType";

export interface InnerJoinExpressionMetadata extends JoinExpressionBaseMetadata {
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
  constructor(table: TableExpressionBase, joinPredicate: SqlExpression) {
    super(table, joinPredicate);
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
      table: this.table.toMetadata() as TableExpressionBaseMetadata,
      $type: SqlExpressionType.InnerJoin,
    };
  }
}
