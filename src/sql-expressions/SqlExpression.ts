import { SqlExpressionType } from "./SqlExpressionType";

export interface SqlExpressionMetadata {
  $type: SqlExpressionType;
}

export abstract class SqlExpression {
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
