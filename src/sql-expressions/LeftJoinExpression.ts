import { JoinExpressionBase, JoinExpressionBaseMetadata } from "./JoinExpressionBase";
import { SqlExpression } from "./SqlExpression";
import { TableExpressionBase, TableExpressionBaseMetadata } from "./TableExpressionBase";
import { SqlExpressionType } from "./SqlExpressionType";

/**
 * Interface de metadados específica para LeftJoinExpression.
 * @export
 * @interface LeftJoinExpressionMetadata
 * @extends {JoinExpressionBaseMetadata}
 */
export interface LeftJoinExpressionMetadata extends JoinExpressionBaseMetadata {
  $type: SqlExpressionType.LeftJoin;
  table: TableExpressionBaseMetadata;
}

/**
 * Representa uma operação LEFT JOIN SQL.
 * A tabela juntada (`table`) pode ser uma tabela física, uma subconsulta SELECT ou uma UNION.
 *
 * @export
 * @class LeftJoinExpression
 * @extends {JoinExpressionBase}
 */
export class LeftJoinExpression extends JoinExpressionBase {
  /**
   * O tipo desta expressão (LeftJoin).
   * @override
   * @readonly
   * @type {SqlExpressionType.LeftJoin}
   * @memberof LeftJoinExpression
   */
  public override readonly type = SqlExpressionType.LeftJoin;

  /**
   * Cria uma instância de LeftJoinExpression.
   * @param {TableExpressionBase} table A fonte de dados a ser juntada (Tabela, Select ou Union).
   * @param {SqlExpression} joinPredicate A condição SQL da cláusula ON.
   * @memberof LeftJoinExpression
   */
  constructor(table: TableExpressionBase, joinPredicate: SqlExpression) {
    super(table, joinPredicate); // Passa para o construtor base
  }

  /**
   * Retorna a representação em string desta expressão LEFT JOIN para depuração.
   * Exemplo: LEFT JOIN [TabelaPedidos] AS [t1] ON [t0].[clienteId] = [t1].[clienteId]
   *          LEFT JOIN (SELECT ... ) AS [t2] ON [t0].[id] = [t2].[key]
   *
   * @override
   * @returns {string}
   * @memberof LeftJoinExpression
   */
  override toString(): string {
    // O toString da fonte (table) cuidará de gerar (SELECT...) AS alias ou Tabela AS alias
    return `LEFT JOIN ${this.table.toString()} ON ${this.joinPredicate.toString()}`;
  }

  /**
   * Converte esta expressão LeftJoin para seus metadados serializáveis em JSON.
   *
   * @override
   * @returns {LeftJoinExpressionMetadata}
   * @memberof LeftJoinExpression
   */
  override toMetadata(): LeftJoinExpressionMetadata {
    const baseMeta = super.toMetadata(); // Chama o método da base
    return {
      ...baseMeta,
      // Garante que table use TableExpressionBaseMetadata
      table: this.table.toMetadata() as TableExpressionBaseMetadata,
      $type: SqlExpressionType.LeftJoin, // Redefine para LeftJoin
    };
  }
}
