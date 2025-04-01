// --- START OF FILE src/sql-expressions/CompositeUnionExpression.ts ---

// --- START OF FILE src/sql-expressions/CompositeUnionExpression.ts ---

import {
  TableExpressionBase,
  TableExpressionBaseMetadata,
} from "./TableExpressionBase"; // Importar TableExpressionBaseMetadata
import { SelectExpression } from "./SelectExpression";
import { SqlExpressionType } from "./SqlExpressionType";
import { escapeIdentifier } from "../query/generation/utils/sqlUtils";
import { SqlExpressionMetadata } from "./SqlExpression"; // Importar SqlExpressionMetadata

// Nova interface de metadados para CompositeUnionExpression
export interface CompositeUnionExpressionMetadata
  extends TableExpressionBaseMetadata {
  $type: SqlExpressionType.Union;
  sources: SqlExpressionMetadata[]; // Array de metadados de SelectExpression
  distinct: boolean;
}

/**
 * Representa uma operação UNION ou UNION ALL entre múltiplas SelectExpressions.
 * Agora estende TableExpressionBase para poder ser usada diretamente como fonte.
 *
 * @class CompositeUnionExpression
 * @extends {TableExpressionBase} // <<< ESTENDE TableExpressionBase
 */
export class CompositeUnionExpression extends TableExpressionBase {
  // <<< ESTENDE TableExpressionBase
  public override readonly type = SqlExpressionType.Union; // <<< Define o tipo
  public readonly sources: ReadonlyArray<SelectExpression>;
  public readonly distinct: boolean;

  constructor(
    sources: ReadonlyArray<SelectExpression>,
    alias: string, // <<< Recebe o alias
    distinct: boolean = true
  ) {
    super(alias); // <<< Passa o alias para a classe base
    if (!sources || sources.length < 2) {
      throw new Error(
        "CompositeUnionExpression requires at least two source SelectExpressions."
      );
    }
    this.sources = sources;
    this.distinct = distinct;
  }

  override toString(): string {
    // A representação em string é complexa e feita pelo gerador.
    // Esta é apenas para debug básico.
    const unionType = this.distinct ? "UNION" : "UNION ALL";
    const sourcesStr = this.sources.map((s) => `(...)`).join(` ${unionType} `);
    return `(${sourcesStr}) AS ${escapeIdentifier(this.alias)}`;
  }

  // *** IMPLEMENTAR toMetadata() ***
  override toMetadata(): CompositeUnionExpressionMetadata {
    return {
      ...super.toMetadata(), // Inclui metadados da base (alias e type)
      $type: SqlExpressionType.Union, // Redefine para Union (era Union, Table ou Select na base)
      sources: this.sources.map((s) => s.toMetadata()), // Metadados das SelectExpressions
      distinct: this.distinct,
    };
  }

  // **** CÓDIGO REMOVIDO DAQUI ****
  // protected visitMember(expression: LinqMemberExpression): SqlExpression { ... }
}

// --- END OF FILE src/sql-expressions/CompositeUnionExpression.ts ---
