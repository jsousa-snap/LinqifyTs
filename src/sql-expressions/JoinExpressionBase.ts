import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { TableExpressionBase, TableExpressionBaseMetadata } from "./TableExpressionBase"; // Importar Base
import { SqlExpressionType } from "./SqlExpressionType"; // Importar SqlExpressionType

/**
 * Interface base para metadados de expressões JOIN.
 * Define as propriedades comuns a todos os tipos de JOIN.
 *
 * @export
 * @interface JoinExpressionBaseMetadata
 * @extends {SqlExpressionMetadata}
 */
export interface JoinExpressionBaseMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.InnerJoin | SqlExpressionType.LeftJoin;
  table: TableExpressionBaseMetadata;
  joinPredicate: SqlExpressionMetadata;
}

/**
 * Classe base abstrata para todas as expressões SQL JOIN (INNER JOIN, LEFT JOIN, etc.).
 *
 * @export
 * @abstract
 * @class JoinExpressionBase
 * @extends {SqlExpression}
 */
export abstract class JoinExpressionBase extends SqlExpression {
  /**
   * Cria uma instância de JoinExpressionBase.
   * @param {TableExpressionBase} table A fonte de dados a ser juntada (Tabela, Select, Union).
   * @param {SqlExpression} joinPredicate A condição SQL da cláusula ON.
   * @protected // Torna o construtor protegido para forçar uso das classes filhas.
   * @memberof JoinExpressionBase
   */
  protected constructor(
    public readonly table: TableExpressionBase,
    public readonly joinPredicate: SqlExpression
  ) {
    super();
    if (!table) throw new Error("Join table source cannot be null.");
    if (!joinPredicate) throw new Error("Join predicate cannot be null.");
  }

  /**
   * O tipo específico desta expressão JOIN (ex: InnerJoin, LeftJoin).
   * Deve ser implementado pelas classes filhas.
   * @abstract
   * @type {SqlExpressionType.InnerJoin | SqlExpressionType.LeftJoin}
   * @memberof JoinExpressionBase
   */
  abstract override readonly type: SqlExpressionType.InnerJoin | SqlExpressionType.LeftJoin;

  /**
   * Retorna a representação em string desta expressão JOIN para depuração.
   * Deve ser implementado pelas classes filhas.
   * @abstract
   * @returns {string}
   * @memberof JoinExpressionBase
   */
  abstract override toString(): string;

  /**
   * Converte esta expressão JOIN base para seus metadados serializáveis em JSON.
   *
   * @returns {JoinExpressionBaseMetadata}
   * @memberof JoinExpressionBase
   */
  toMetadata(): JoinExpressionBaseMetadata {
    return {
      $type: this.type,
      table: this.table.toMetadata() as TableExpressionBaseMetadata, // <<< Usa metadados base
      joinPredicate: this.joinPredicate.toMetadata(),
    };
  }
}
