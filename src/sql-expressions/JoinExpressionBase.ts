// --- START OF FILE src/sql-expressions/JoinExpressionBase.ts ---

// --- START OF FILE src/sql-expressions/JoinExpressionBase.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
// *** CORREÇÃO: Importar TableExpressionBase ***
import {
  TableExpressionBase,
  TableExpressionBaseMetadata,
} from "./TableExpressionBase"; // Importar Base
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
  // *** ATENÇÃO: Adicionado LeftJoin ***
  /** O tipo específico do JOIN (ex: InnerJoin, LeftJoin). */
  $type: SqlExpressionType.InnerJoin | SqlExpressionType.LeftJoin; // <<< ADICIONADO LeftJoin
  /** Metadados da fonte de dados que está sendo juntada (Tabela, Select, Union). */
  // *** CORREÇÃO: Usar TableExpressionBaseMetadata ***
  table: TableExpressionBaseMetadata; // <<< Metadados da fonte JOINED (pode ser Table, Select, Union)
  /** Metadados da condição SQL da cláusula ON. */
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
  // *** CORREÇÃO: Aceitar TableExpressionBase ***
  protected constructor(
    public readonly table: TableExpressionBase, // <<< Aceita Tabela, Select ou Union
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
   * @type {SqlExpressionType.InnerJoin | SqlExpressionType.LeftJoin} // Adicionar outros tipos se necessário
   * @memberof JoinExpressionBase
   */
  // *** CORREÇÃO: Estreitar o tipo abstrato aqui ***
  // Exige que as classes filhas definam o tipo como um dos tipos de JOIN válidos.
  // *** ATENÇÃO: Adicionado LeftJoin ***
  abstract override readonly type:
    | SqlExpressionType.InnerJoin
    | SqlExpressionType.LeftJoin; // <<< ADICIONADO LeftJoin

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
      // Esta atribuição agora é válida porque 'this.type'
      // é garantido ser um dos tipos de JOIN permitidos.
      $type: this.type,
      // *** CORREÇÃO: Garantir metadados corretos ***
      table: this.table.toMetadata() as TableExpressionBaseMetadata, // <<< Usa metadados base
      joinPredicate: this.joinPredicate.toMetadata(),
    };
  }
}

// --- END OF FILE src/sql-expressions/JoinExpressionBase.ts ---
