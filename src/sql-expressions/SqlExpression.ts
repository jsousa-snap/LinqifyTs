// --- START OF FILE src/sql-expressions/SqlExpression.ts ---

import { SqlExpressionType } from "./SqlExpressionType";

// Interface para o objeto de metadados SQL base
export interface SqlExpressionMetadata {
  $type: SqlExpressionType; // Usar o enum como discriminador
  // Propriedades base comuns a todas as expressões SQL podem ir aqui
}

export abstract class SqlExpression {
  // Tipo do nó da expressão SQL
  abstract readonly type: SqlExpressionType;

  protected constructor() {}

  /**
   * Converte a expressão SQL para um objeto de metadados serializável em JSON.
   */
  abstract toMetadata(): SqlExpressionMetadata; // Novo método abstrato
  /**
   * Representação em string para depuração.
   * NÃO deve ser usado para gerar o SQL final.
   */
  abstract toString(): string;
}

// --- END OF FILE src/sql-expressions/SqlExpression.ts ---
