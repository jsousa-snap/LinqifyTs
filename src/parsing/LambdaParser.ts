/* eslint-disable @typescript-eslint/no-explicit-any */
import * as acorn from "acorn";
import { Expression, ParameterExpression, LambdaExpression } from "../expressions";
import { ExpressionVisitor } from "./ExpressionVisitor";

interface AstNode {
  type: string;
  [key: string]: any;
}
interface IdentifierNode extends AstNode {
  type: "Identifier";
  name: string;
}
interface ArrowFunctionExpressionNode extends AstNode {
  type: "ArrowFunctionExpression";
  params: AstNode[];
  body: AstNode;
}

export class LambdaParser {
  parse(
    lambda: (...args: any[]) => any,
    initialParameterMapsStack: ReadonlyArray<ReadonlyMap<string, ParameterExpression>> = [],
    scopeMap?: ReadonlyMap<string, Expression> // Escopo do provideScope
  ): LambdaExpression {
    const lambdaString = lambda.toString();
    try {
      const ast = acorn.parse(lambdaString, { ecmaVersion: 2020 }) as any;
      let arrowFunctionNode: ArrowFunctionExpressionNode | null = null;

      if (ast.body[0]?.type === "ExpressionStatement" && ast.body[0].expression?.type === "ArrowFunctionExpression") {
        arrowFunctionNode = ast.body[0].expression;
      } else if (ast.body[0]?.type === "ArrowFunctionExpression") {
        arrowFunctionNode = ast.body[0];
      }
      if (!arrowFunctionNode) {
        throw new Error("Could not find ArrowFunctionExpression.");
      }

      const parameters: ParameterExpression[] = [];
      const currentParameterMap = new Map<string, ParameterExpression>();
      for (const paramNode of arrowFunctionNode.params) {
        if (paramNode.type !== "Identifier") {
          throw new Error("Lambda parameters must be identifiers.");
        }
        const paramName = (paramNode as IdentifierNode).name;
        const parameter = new ParameterExpression(paramName);
        parameters.push(parameter);
        currentParameterMap.set(paramName, parameter);
      }

      // ** CORREÇÃO: Cria a pilha para o visitor **
      // Combina a pilha inicial recebida com o mapa de parâmetros desta lambda
      const visitorParameterMapsStack = [...initialParameterMapsStack, currentParameterMap];

      // Cria o visitor passando a pilha completa e o scopeMap (provideScope)
      const visitor = new ExpressionVisitor(visitorParameterMapsStack, scopeMap);
      const bodyExpression = visitor.visit(arrowFunctionNode.body); // Visita o corpo da lambda

      return new LambdaExpression(bodyExpression, parameters);
    } catch (e: any) {
      console.error("Error parsing lambda:", lambdaString);
      console.error("Original Error:", e);
      throw new Error(`Failed to parse lambda: ${e.message || e}`);
    }
  }
}
