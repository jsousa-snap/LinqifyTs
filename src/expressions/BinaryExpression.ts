/* src/expressions/BinaryExpression.ts */
// --- START OF FILE src/expressions/BinaryExpression.ts ---

import { Expression, ExpressionType } from "./Expression";

/**
 * Enumeração dos tipos de operadores binários suportados na árvore de expressão LINQ.
 */
export enum OperatorType {
  // Comparação
  Equal = "==",
  NotEqual = "!=",
  GreaterThan = ">",
  GreaterThanOrEqual = ">=",
  LessThan = "<",
  LessThanOrEqual = "<=",
  // Lógico
  And = "&&",
  Or = "||",
  // ** NOVO: Aritméticos **
  Add = "+",
  Subtract = "-",
  Multiply = "*",
  Divide = "/",
  Modulo = "%",
  // ** FIM: Aritméticos **
}

/**
 * Representa uma operação binária na árvore de expressão LINQ.
 * Exemplos: `a + b`, `x > 5`, `y == true`, `c && d`.
 *
 * @export
 * @class BinaryExpression
 * @extends {Expression}
 */
export class BinaryExpression extends Expression {
  /**
   * O tipo desta expressão (Binária).
   * @readonly
   * @type {ExpressionType.Binary}
   * @memberof BinaryExpression
   */
  readonly type = ExpressionType.Binary;
  /**
   * Cria uma instância de BinaryExpression.
   * @param {Expression} left A expressão do lado esquerdo.
   * @param {OperatorType} operator O operador binário.
   * @param {Expression} right A expressão do lado direito.
   * @memberof BinaryExpression
   */
  constructor(
    public readonly left: Expression,
    public readonly operator: OperatorType,
    public readonly right: Expression
  ) {
    super();
  }
  /**
   * Retorna a representação em string da expressão binária para depuração.
   * Exemplo: `(user.age > 30)`
   *
   * @returns {string}
   * @memberof BinaryExpression
   */
  toString(): string {
    // Formata a string como "(left op right)"
    return `(${this.left.toString()} ${this.operator} ${this.right.toString()})`;
  }
}
// --- END OF FILE src/expressions/BinaryExpression.ts ---
