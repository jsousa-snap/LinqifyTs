/* src/parsing/ExpressionVisitor.ts */
// --- START OF FILE src/parsing/ExpressionVisitor.ts ---

import * as acorn from "acorn";
import {
  Expression,
  ParameterExpression,
  MemberExpression,
  ConstantExpression,
  LambdaExpression,
  MethodCallExpression,
  BinaryExpression,
  LiteralExpression,
  NewObjectExpression,
  OperatorType, // <<< Importar OperatorType
  ExpressionType,
  ScopeExpression,
} from "../expressions";

// --- AST Node Interfaces (inalteradas) ---
interface AstNode {
  type: string;
  [key: string]: any;
}
interface IdentifierNode extends AstNode {
  type: "Identifier";
  name: string;
}
interface LiteralNode extends AstNode {
  type: "Literal";
  value: any;
  raw: string;
}
interface MemberExpressionNode extends AstNode {
  type: "MemberExpression";
  object: AstNode;
  property: IdentifierNode;
  computed: boolean;
}
interface BinaryExpressionNode extends AstNode {
  type: "BinaryExpression";
  left: AstNode;
  operator: string;
  right: AstNode;
}
interface LogicalExpressionNode extends AstNode {
  type: "LogicalExpression";
  left: AstNode;
  operator: "&&" | "||";
  right: AstNode;
}
interface ObjectExpressionNode extends AstNode {
  type: "ObjectExpression";
  properties: PropertyNode[];
}
interface PropertyNode extends AstNode {
  type: "Property";
  key: IdentifierNode | LiteralNode;
  value: AstNode;
  kind: "init";
  method: boolean;
  shorthand: boolean;
  computed: boolean;
}
interface ArrowFunctionExpressionNode extends AstNode {
  type: "ArrowFunctionExpression";
  params: AstNode[];
  body: AstNode;
}
interface ExpressionStatementNode extends AstNode {
  type: "ExpressionStatement";
  expression: AstNode;
}
interface CallExpressionNode extends AstNode {
  type: "CallExpression";
  callee: AstNode;
  arguments: AstNode[];
  optional: boolean;
}
// --- End AST Node Interfaces ---

/**
 * Visita uma árvore de sintaxe abstrata (AST) gerada pelo Acorn
 * e a converte em uma árvore de expressão LINQ personalizada.
 * Mantém o controle dos parâmetros de lambda e escopo externo.
 *
 * @export
 * @class ExpressionVisitor
 */
export class ExpressionVisitor {
  // Pilha de mapas de parâmetros. Cada entrada representa um nível de lambda.
  private readonly parameterMapsStack: ReadonlyArray<
    ReadonlyMap<string, ParameterExpression>
  >;
  // Mapa de parâmetros/variáveis fornecidos externamente via provideScope.
  private readonly scopeParameters?: ReadonlyMap<string, Expression>;

  /**
   * Cria uma instância de ExpressionVisitor.
   * @param {ReadonlyArray<ReadonlyMap<string, ParameterExpression>>} parameterMapsStack A pilha inicial de mapas de parâmetros. Deve conter pelo menos um mapa (geralmente o da lambda raiz).
   * @param {ReadonlyMap<string, Expression>} [scopeParameters] O mapa de parâmetros de escopo externo (opcional).
   * @memberof ExpressionVisitor
   */
  constructor(
    parameterMapsStack: ReadonlyArray<ReadonlyMap<string, ParameterExpression>>,
    scopeParameters?: ReadonlyMap<string, Expression>
  ) {
    if (!parameterMapsStack || parameterMapsStack.length === 0) {
      throw new Error(
        "ExpressionVisitor requires at least one parameter map in the stack."
      );
    }
    this.parameterMapsStack = parameterMapsStack;
    this.scopeParameters = scopeParameters;
  }

  /**
   * Método dispatcher principal que visita um nó AST e retorna a Expression LINQ correspondente.
   *
   * @param {AstNode} node O nó AST a ser visitado.
   * @returns {Expression} A expressão LINQ resultante.
   * @throws {Error} Se encontrar um tipo de nó AST não suportado.
   * @memberof ExpressionVisitor
   */
  visit(node: AstNode): Expression {
    switch (node.type) {
      case "Identifier":
        return this.visitIdentifier(node as IdentifierNode);
      case "MemberExpression":
        return this.visitMemberExpression(node as MemberExpressionNode);
      case "Literal":
        return this.visitLiteral(node as LiteralNode);
      case "BinaryExpression": // Cobre operadores como +, -, ==, >, etc.
        return this.visitBinaryExpression(node as BinaryExpressionNode);
      case "LogicalExpression": // Cobre && e ||
        return this.visitLogicalExpression(node as LogicalExpressionNode);
      case "ObjectExpression":
        return this.visitObjectExpression(node as ObjectExpressionNode);
      case "CallExpression":
        return this.visitCallExpression(node as CallExpressionNode);
      case "ExpressionStatement":
        // Se o nó for uma ExpressionStatement, visita a expressão interna.
        return this.visit((node as ExpressionStatementNode).expression);
      default:
        console.error("Unsupported AST Node:", node);
        throw new Error(`Unsupported AST node type: ${node.type}`);
    }
  }

  /**
   * Visita um nó Identificador. Procura o nome na pilha de parâmetros de lambda
   * e depois no escopo externo.
   *
   * @param {IdentifierNode} node O nó Identificador.
   * @returns {Expression} O ParameterExpression correspondente ou a Expression do escopo.
   * @throws {Error} Se o identificador não for encontrado.
   * @memberof ExpressionVisitor
   */
  visitIdentifier(node: IdentifierNode): Expression {
    const name = node.name;
    // Procura da lambda mais interna para a mais externa
    for (let i = this.parameterMapsStack.length - 1; i >= 0; i--) {
      const map = this.parameterMapsStack[i];
      if (map.has(name)) {
        return map.get(name)!; // Retorna o ParameterExpression da lambda
      }
    }
    // Se não encontrou na lambda, procura no escopo externo (provideScope)
    if (this.scopeParameters?.has(name)) {
      return this.scopeParameters.get(name)!; // Retorna a Expression associada no escopo
    }

    // Se não encontrou em lugar nenhum, é um erro.
    console.error(`Unknown identifier encountered during parsing: ${name}`);
    console.error(
      " Current Lambda Param Stack:",
      this.parameterMapsStack.map((m) => Array.from(m.keys()))
    );
    console.error(
      " Provided Scope Params:",
      Array.from(this.scopeParameters?.keys() ?? [])
    );
    throw new Error(
      `Unknown identifier: '${name}'. Not a lambda parameter or scope variable.`
    );
  }

  /**
   * Visita um nó MemberExpression (acesso a propriedade, ex: user.name).
   *
   * @param {MemberExpressionNode} node O nó MemberExpression.
   * @returns {MemberExpression} A expressão LINQ MemberExpression correspondente.
   * @throws {Error} Se for acesso computado (ex: obj[prop]).
   * @memberof ExpressionVisitor
   */
  visitMemberExpression(node: MemberExpressionNode): MemberExpression {
    if (node.computed) {
      throw new Error("Computed member access (obj[prop]) not supported.");
    }
    const objectExpr = this.visit(node.object); // Visita o objeto base
    const memberName = node.property.name; // Obtém o nome da propriedade
    return new MemberExpression(objectExpr, memberName);
  }

  /**
   * Visita um nó Literal (string, número, booleano, null).
   *
   * @param {LiteralNode} node O nó Literal.
   * @returns {LiteralExpression} A expressão LINQ LiteralExpression.
   * @memberof ExpressionVisitor
   */
  visitLiteral(node: LiteralNode): LiteralExpression {
    return new LiteralExpression(node.value);
  }

  /**
   * Visita um nó BinaryExpression (operadores binários como +, -, ==, >).
   *
   * @param {BinaryExpressionNode} node O nó BinaryExpression.
   * @returns {BinaryExpression} A expressão LINQ BinaryExpression.
   * @memberof ExpressionVisitor
   */
  visitBinaryExpression(node: BinaryExpressionNode): BinaryExpression {
    const left = this.visit(node.left); // Visita o operando esquerdo
    const right = this.visit(node.right); // Visita o operando direito
    const operator = this.mapOperator(node.operator); // Mapeia o operador string para OperatorType
    return new BinaryExpression(left, operator, right);
  }

  /**
   * Visita um nó LogicalExpression (&& ou ||).
   *
   * @param {LogicalExpressionNode} node O nó LogicalExpression.
   * @returns {BinaryExpression} A expressão LINQ BinaryExpression correspondente.
   * @memberof ExpressionVisitor
   */
  visitLogicalExpression(node: LogicalExpressionNode): BinaryExpression {
    const left = this.visit(node.left);
    const right = this.visit(node.right);
    const operator = this.mapLogicalOperator(node.operator); // Mapeia '&&' ou '||'
    return new BinaryExpression(left, operator, right);
  }

  /**
   * Visita um nó ObjectExpression (criação de objeto literal, ex: { a: 1, b: x }).
   *
   * @param {ObjectExpressionNode} node O nó ObjectExpression.
   * @returns {NewObjectExpression} A expressão LINQ NewObjectExpression.
   * @throws {Error} Se encontrar tipos de propriedade não suportados.
   * @memberof ExpressionVisitor
   */
  visitObjectExpression(node: ObjectExpressionNode): NewObjectExpression {
    const properties = new Map<string, Expression>();
    for (const prop of node.properties) {
      // Suporta apenas propriedades simples { key: value }
      if (prop.kind !== "init" || prop.method || prop.computed) {
        throw new Error(
          `Unsupported property kind in ObjectExpression: ${prop.kind}`
        );
      }
      let propertyName: string;
      // Obtém o nome da propriedade (pode ser identificador ou literal string)
      if (prop.key.type === "Identifier") {
        propertyName = (prop.key as IdentifierNode).name;
      } else if (
        prop.key.type === "Literal" &&
        typeof (prop.key as LiteralNode).value === "string"
      ) {
        propertyName = (prop.key as LiteralNode).value;
      } else {
        throw new Error(`Unsupported property key type: ${prop.key.type}`);
      }
      // Visita a expressão do valor da propriedade.
      // Trata shorthand properties (ex: { x }) como { x: x }.
      const valueExpression = prop.shorthand
        ? this.visitIdentifier(prop.key as IdentifierNode)
        : this.visit(prop.value);
      properties.set(propertyName, valueExpression);
    }
    return new NewObjectExpression(properties);
  }

  /**
   * Visita um nó CallExpression (chamada de função/método).
   * Principalmente focado em chamadas de método em objetos (ex: query.where(...)).
   *
   * @param {CallExpressionNode} node O nó CallExpression.
   * @returns {MethodCallExpression} A expressão LINQ MethodCallExpression.
   * @throws {Error} Se a chamada não for um acesso a membro ou argumentos não suportados.
   * @memberof ExpressionVisitor
   */
  visitCallExpression(node: CallExpressionNode): MethodCallExpression {
    const callee = node.callee;
    // Espera que a chamada seja um acesso a membro (ex: object.method)
    if (callee.type !== "MemberExpression") {
      throw new Error(
        `Unsupported CallExpression callee type: ${callee.type}. Expected MemberExpression.`
      );
    }
    const memberCallee = callee as MemberExpressionNode;
    const sourceExpr = this.visit(memberCallee.object); // Visita o objeto fonte da chamada
    const methodName = memberCallee.property.name; // Obtém o nome do método

    // Visita cada argumento da chamada
    const args: Expression[] = node.arguments.map((argNode) => {
      // Se o argumento for uma Arrow Function (lambda)
      if (argNode.type === "ArrowFunctionExpression") {
        const arrowFuncNode = argNode as ArrowFunctionExpressionNode;
        const innerParamsMap = new Map<string, ParameterExpression>();
        const innerParamsArray: ParameterExpression[] = [];
        // Processa os parâmetros da lambda interna
        for (const paramNode of arrowFuncNode.params) {
          if (paramNode.type !== "Identifier") {
            throw new Error("Lambda parameters must be identifiers.");
          }
          const paramName = (paramNode as IdentifierNode).name;
          const parameter = new ParameterExpression(paramName);
          innerParamsArray.push(parameter);
          innerParamsMap.set(paramName, parameter);
        }
        // Cria uma nova pilha de parâmetros para o visitor interno
        const newParameterMapsStack = [
          ...this.parameterMapsStack,
          innerParamsMap, // Adiciona o mapa da lambda interna
        ];
        // Cria um visitor interno com a nova pilha e o escopo externo
        const innerVisitor = new ExpressionVisitor(
          newParameterMapsStack,
          this.scopeParameters
        );
        // Visita o corpo da lambda interna
        const bodyExpr = innerVisitor.visit(arrowFuncNode.body);
        // Retorna a LambdaExpression LINQ
        return new LambdaExpression(bodyExpr, innerParamsArray);
      } else {
        // Se não for lambda, visita o argumento normalmente
        return this.visit(argNode);
      }
    });
    // Retorna a MethodCallExpression LINQ
    return new MethodCallExpression(methodName, sourceExpr, args);
  }

  /**
   * Mapeia operadores string do AST (como '==', '>', '+') para o enum OperatorType.
   * **ATUALIZADO:** Adiciona mapeamento para operadores aritméticos.
   *
   * @private
   * @param {string} op O operador string do AST.
   * @returns {OperatorType} O OperatorType correspondente.
   * @throws {Error} Se o operador não for suportado.
   * @memberof ExpressionVisitor
   */
  private mapOperator(op: string): OperatorType {
    switch (op) {
      // Comparação
      case "===": // Trata estrito e não estrito como iguais para mapeamento SQL
      case "==":
        return OperatorType.Equal;
      case "!==":
      case "!=":
        return OperatorType.NotEqual;
      case ">":
        return OperatorType.GreaterThan;
      case ">=":
        return OperatorType.GreaterThanOrEqual;
      case "<":
        return OperatorType.LessThan;
      case "<=":
        return OperatorType.LessThanOrEqual;
      // ** NOVO: Aritméticos **
      case "+":
        return OperatorType.Add;
      case "-":
        return OperatorType.Subtract;
      case "*":
        return OperatorType.Multiply;
      case "/":
        return OperatorType.Divide;
      // Operadores lógicos (&&, ||) são tratados por mapLogicalOperator
      default:
        throw new Error(`Unsupported binary operator: ${op}`);
    }
  }

  /**
   * Mapeia operadores lógicos string do AST ('&&', '||') para o enum OperatorType.
   *
   * @private
   * @param {("&&" | "||")} op O operador lógico string ('&&' ou '||').
   * @returns {OperatorType} O OperatorType correspondente (And ou Or).
   * @throws {Error} Se o operador não for '&&' ou '||'.
   * @memberof ExpressionVisitor
   */
  private mapLogicalOperator(op: "&&" | "||"): OperatorType {
    switch (op) {
      case "&&":
        return OperatorType.And;
      case "||":
        return OperatorType.Or;
      // O default não é estritamente necessário devido ao tipo de 'op',
      // mas é bom para robustez caso o tipo mude.
      default:
        const exhaustiveCheck: never = op; // Garante que todos os casos sejam tratados
        throw new Error(`Unsupported logical operator: ${exhaustiveCheck}`);
    }
  }
}
// --- END OF FILE src/parsing/ExpressionVisitor.ts ---
