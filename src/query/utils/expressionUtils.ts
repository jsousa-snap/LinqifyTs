/* eslint-disable @typescript-eslint/no-unused-vars */
// src/query/utils/expressionUtils.ts
/**
 * Utilitários para análise de árvores de expressão LINQ.
 */
import {
  Expression,
  ExpressionType,
  MethodCallExpression,
  LambdaExpression,
  ParameterExpression,
  ConstantExpression,
  ScopeExpression,
  NewObjectExpression, // Importar NewObjectExpression
} from "../../expressions";

/**
 * Verifica se o corpo de uma lambda representa uma projeção explícita.
 * Retorna false se o corpo for um ParameterExpression (representando uma entidade inteira).
 * Para NewObjectExpression, verifica recursivamente todas as suas propriedades.
 *
 * @param body A expressão do corpo da lambda.
 * @returns True se a projeção do corpo for explícita, False caso contrário.
 */
function isLambdaBodyExplicit(body: Expression): boolean {
  switch (body.type) {
    case ExpressionType.Parameter:
      // Selecionar o próprio parâmetro (ex: u => u, ou (u, p) => u) é implícito.
      return false;

    case ExpressionType.MemberAccess:
    case ExpressionType.Constant: // Uma constante na projeção é explícita
    case ExpressionType.Literal: // Um literal na projeção é explícito
    case ExpressionType.Call: // Resultado de método (ToUpper, etc.) é explícito
    case ExpressionType.Binary: // Resultado de operação binária é explícito
      // Acessar um membro (u.name), ou usar literais/constantes/métodos/operações é explícito.
      return true;

    case ExpressionType.NewObject: {
      // Adicionado bloco para eslint
      // Um novo objeto só é explícito se *TODAS* as suas propriedades forem explícitas.
      const newObjectExpr = body as NewObjectExpression;
      for (const [_key, valueExpr] of newObjectExpr.properties.entries()) {
        if (!isLambdaBodyExplicit(valueExpr)) {
          // Se qualquer valor de propriedade for implícito (ex: UserData: u), o objeto todo é implícito.
          return false;
        }
      }
      // Se todas as propriedades passaram na verificação, o objeto é explícito.
      return true;
    } // Fim do bloco

    case ExpressionType.Scope: {
      // Adicionado bloco para eslint
      // Scope apenas envolve, verifica a expressão interna.
      // Necessário garantir que a sourceExpression não seja null antes de chamar
      const sourceExpr = (body as ScopeExpression).sourceExpression;
      return sourceExpr ? isLambdaBodyExplicit(sourceExpr) : false; // Retorna false se sourceExpr for null
    } // Fim do bloco

    // Outros tipos (como Lambda dentro de Lambda - improvável aqui) são considerados implícitos ou erro.
    default:
      console.warn(`isLambdaBodyExplicit: Tipo de corpo de lambda inesperado ou não suportado: ${body.type}`);
      return false;
  }
}

/**
 * Verifica recursivamente se uma árvore de expressão LINQ termina
 * com uma operação que define explicitamente a projeção dos dados retornados.
 * Usa isLambdaBodyExplicit para analisar o corpo de lambdas relevantes (select, join).
 *
 * @param expression A expressão LINQ a ser analisada.
 * @returns True se a projeção for considerada explícita, False caso contrário.
 */
export function isProjectionExplicit(expression: Expression | null): boolean {
  if (!expression) {
    return false;
  }

  switch (expression.type) {
    case ExpressionType.Constant: {
      // Adicionado bloco para eslint
      const constExpr = expression as ConstantExpression;
      // É explícito apenas se NÃO for a constante inicial da tabela.
      return !(constExpr.value?.type === "Table");
    } // Fim do bloco

    case ExpressionType.Call: {
      // Adicionado bloco para eslint
      const callExpr = expression as MethodCallExpression;
      const source = callExpr.source;

      switch (callExpr.methodName) {
        // --- Métodos que definem a projeção ---
        case "select":
          if (callExpr.args.length === 1 && callExpr.args[0].type === ExpressionType.Lambda) {
            const lambda = callExpr.args[0] as LambdaExpression;
            // Caso especial: select(x => x) herda da fonte
            if (
              lambda.body.type === ExpressionType.Parameter &&
              lambda.parameters.length === 1 &&
              (lambda.body as ParameterExpression).name === lambda.parameters[0].name
            ) {
              return source ? isProjectionExplicit(source) : false;
            }
            // Outros selects: a explicitude depende do corpo da lambda
            return isLambdaBodyExplicit(lambda.body);
          }
          return false; // Select inválido

        case "join":
        case "leftJoin":
          // A explicitude depende do corpo do resultSelector
          if (callExpr.args.length === 4 && callExpr.args[3].type === ExpressionType.Lambda) {
            const resultLambda = callExpr.args[3] as LambdaExpression;
            return isLambdaBodyExplicit(resultLambda.body);
          }
          return false; // Join inválido

        case "groupBy":
          // CORREÇÃO: groupBy com resultSelector *SEMPRE* define a projeção explicitamente.
          // A estrutura da saída é definida pelo que o usuário retorna na lambda (k, g) => ...
          if (callExpr.args.length === 2 && callExpr.args[1].type === ExpressionType.Lambda) {
            // Possuir um resultSelector é suficiente para considerar explícito.
            return true;
          }
          // GroupBy sem resultSelector (não traduzido) ou inválido é implícito.
          return false;

        // --- Métodos que preservam a projeção ---
        case "where":
        case "orderBy":
        case "orderByDescending":
        case "thenBy":
        case "thenByDescending":
        case "skip":
        case "take":
        case "provideScope":
          return source ? isProjectionExplicit(source) : false;

        // --- Métodos que combinam fontes ---
        case "union":
        case "concat":
          if (source && callExpr.args.length === 1) {
            const secondSource = callExpr.args[0];
            // Precisamos garantir que secondSource não seja nulo antes de chamar isProjectionExplicit
            return secondSource ? isProjectionExplicit(source) && isProjectionExplicit(secondSource) : false;
          }
          return false;

        // --- Métodos Terminais / Agregados ---
        case "first":
        case "firstOrDefault":
        case "single":
        case "singleOrDefault":
        case "count":
        case "sum":
        case "avg":
        case "min":
        case "max":
        case "any":
        case "toList":
        case "firstAsync":
        case "firstOrDefaultAsync":
        case "singleAsync":
        case "singleOrDefaultAsync":
        case "countAsync":
        case "sumAsync":
        case "avgAsync":
        case "minAsync":
        case "maxAsync":
        case "anyAsync":
        case "toListAsync":
          return false; // A verificação acontece *antes* deles serem chamados.

        default:
          console.warn(`isProjectionExplicit: Método desconhecido '${callExpr.methodName}'. Assumindo que preserva.`);
          return source ? isProjectionExplicit(source) : false;
      }
    } // Fim do bloco

    case ExpressionType.Scope: {
      // Adicionado bloco para eslint
      const sourceExpr = (expression as ScopeExpression).sourceExpression;
      return sourceExpr ? isProjectionExplicit(sourceExpr) : false;
    } // Fim do bloco

    default:
      return false;
  }
}
