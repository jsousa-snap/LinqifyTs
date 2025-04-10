/* eslint-disable @typescript-eslint/no-explicit-any */
// src/query/translation/visitors/method/GroupByVisitor.ts

import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
  ParameterExpression as LinqParameterExpression,
  NewObjectExpression as LinqNewObjectExpression,
  MemberExpression as LinqMemberExpression,
  LiteralExpression as LinqLiteralExpression,
  ConstantExpression as LinqConstantExpression,
} from "../../../../expressions";
import {
  SqlExpression,
  SelectExpression,
  ColumnExpression,
  ProjectionExpression,
  SqlFunctionCallExpression,
  SqlConstantExpression,
} from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor";

/**
 * Traduz groupBy(keySelector, resultSelector).
 */
export class GroupByVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /** Cria instância de GroupByVisitor. */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn,
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /** Aplica a lógica do groupBy. */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    sourceForOuterLambda: SqlDataSource
  ): SelectExpression {
    // --- Validações Iniciais ---
    if (expression.methodName !== "groupBy") throw new Error("GroupByVisitor só traduz 'groupBy'.");
    if (expression.args.length !== 2) throw new Error("Tradução 'groupBy' sem resultSelector não suportada.");
    const keyLambda = expression.args[0] as LinqLambdaExpression;
    const resultLambda = expression.args[1] as LinqLambdaExpression;
    if (keyLambda.parameters.length !== 1 || resultLambda.parameters.length !== 2)
      throw new Error("Parâmetros lambda 'groupBy' inválidos.");
    const keyEntityParam = keyLambda.parameters[0];
    const resultKeyParam = resultLambda.parameters[0];
    const resultGroupParam = resultLambda.parameters[1];

    // --- 1. Traduzir Chaves de Agrupamento (GROUP BY clause) ---
    const keyContext = this.context.createChildContext([keyEntityParam], [sourceForOuterLambda]);
    const keySqlExpressions: SqlExpression[] = [];
    const keyMapping = new Map<string | symbol, SqlExpression>();
    const keyBody = keyLambda.body;
    if (keyBody.type === LinqExpressionType.NewObject) {
      const newObjectKey = keyBody as LinqNewObjectExpression;
      for (const [propName, propExpr] of newObjectKey.properties.entries()) {
        const keyPartSql = this.visitInContext(propExpr, keyContext);
        if (!keyPartSql || !this.isValidGroupByColumn(keyPartSql))
          throw new Error(`Chave groupBy inválida '${String(propName)}': ${propExpr.toString()}`);
        keySqlExpressions.push(keyPartSql);
        keyMapping.set(propName, keyPartSql);
      }
    } else {
      const keyPartSql = this.visitInContext(keyBody, keyContext);
      if (!keyPartSql || !this.isValidGroupByColumn(keyPartSql))
        throw new Error(`Chave groupBy simples inválida: ${keyBody.toString()}`);
      keySqlExpressions.push(keyPartSql);
      keyMapping.set(resultKeyParam.name, keyPartSql);
    }
    if (keySqlExpressions.length === 0) throw new Error("groupBy resultou em zero chaves.");

    // --- 2. Criar Projeções a partir do Result Selector (Lógica Interna) ---
    const finalProjections = this.createGroupByResultProjections(
      resultLambda.body,
      resultKeyParam,
      resultGroupParam,
      keyMapping,
      sourceForOuterLambda
    );
    if (finalProjections.length === 0)
      throw new Error(`resultSelector groupBy resultou zero projeções: ${resultLambda.body.toString()}`);

    // --- 3. Construir a SelectExpression final ---
    const groupByAlias = this.aliasGenerator.generateAlias("group");
    return new SelectExpression(
      groupByAlias,
      finalProjections,
      currentSelect.from,
      currentSelect.predicate,
      currentSelect.having,
      currentSelect.joins,
      [],
      null,
      null,
      keySqlExpressions
    );
  }

  /** Verifica se expressão SQL é válida para GROUP BY. */
  private isValidGroupByColumn(sqlExpr: SqlExpression): boolean {
    return (
      sqlExpr instanceof ColumnExpression ||
      sqlExpr instanceof SqlConstantExpression ||
      sqlExpr instanceof SqlFunctionCallExpression
    );
  }

  /** Cria as projeções SQL percorrendo o corpo da lambda de resultado `(k, g) => ...`. */
  private createGroupByResultProjections(
    resultBody: LinqExpression,
    keyParam: LinqParameterExpression, // O parâmetro 'k'
    groupParam: LinqParameterExpression, // O parâmetro 'g'
    keyMapping: Map<string | symbol, SqlExpression>, // Mapeamento da chave para SQL
    originalSource: SqlDataSource // Fonte original para resolver 'g.Sum(x=>x.Prop)'
  ): ProjectionExpression[] {
    const projections: ProjectionExpression[] = [];

    // Função interna para traduzir UMA expressão do corpo do resultSelector
    const translateSingleResultExpression = (expr: LinqExpression): SqlExpression | null => {
      // Caso 1: Acesso direto à chave simples (k)
      if (expr === keyParam) {
        const keySql = keyMapping.get(keyParam.name);
        if (!keySql) throw new Error("Falha ao resolver chave simples 'k' no resultSelector.");
        return keySql;
      }
      // Caso 2: Acesso a membro da chave composta (k.Prop)
      // <<< CORREÇÃO: Verifica tipo antes de acessar objectExpression >>>
      if (expr.type === LinqExpressionType.MemberAccess) {
        const memberExpr = expr as LinqMemberExpression; // Cast seguro após verificar tipo
        if (memberExpr.objectExpression === keyParam) {
          const memberName = memberExpr.memberName;
          const keySql = keyMapping.get(memberName);
          if (!keySql) throw new Error(`Membro da chave groupBy '${memberName}' não encontrado no mapeamento.`);
          return keySql;
        }
      }
      // Caso 3: Chamada de agregação no grupo (g.Count(), g.Sum(x => x.Price))
      // <<< CORREÇÃO: Verifica tipo antes de acessar source >>>
      if (expr.type === LinqExpressionType.Call) {
        const callExpr = expr as LinqMethodCallExpression; // Cast seguro
        if (callExpr.source === groupParam) {
          // Verifica se a fonte da chamada é o parâmetro 'g'
          const sqlFunctionName = this.mapLinqAggregateToSql(callExpr.methodName);
          let aggregateArgSql: SqlExpression;

          if (callExpr.methodName.toLowerCase() === "count" && callExpr.args.length === 0) {
            aggregateArgSql = new SqlConstantExpression(1);
          } else if (callExpr.args.length === 1 && callExpr.args[0].type === LinqExpressionType.Lambda) {
            const innerLambda = callExpr.args[0] as LinqLambdaExpression;
            if (innerLambda.parameters.length !== 1)
              throw new Error(`Lambda agregação ${callExpr.methodName} inválida.`);
            const innerParam = innerLambda.parameters[0];
            const innerContext = this.context.createChildContext([innerParam], [originalSource]);
            const innerValueSql = this.visitInContext(innerLambda.body, innerContext);
            if (!innerValueSql)
              throw new Error(
                `Falha traduzir seletor agregação ${callExpr.methodName}: ${innerLambda.body.toString()}`
              );
            aggregateArgSql = innerValueSql;
          } else {
            throw new Error(`Argumentos inválidos agregação ${callExpr.methodName} groupBy.`);
          }
          return new SqlFunctionCallExpression(sqlFunctionName, [aggregateArgSql]);
        }
      }

      // Caso 4: Constantes Literais
      if (expr.type === LinqExpressionType.Literal) {
        return new SqlConstantExpression((expr as LinqLiteralExpression).value);
      }
      // Caso 5: Constantes (Cuidado com Table)
      if (expr.type === LinqExpressionType.Constant) {
        const constVal = (expr as LinqConstantExpression).value;
        if (constVal && typeof constVal === "object" && (constVal as any).type === "Table") {
          throw new Error("Tabela constante não suportada no resultSelector groupBy.");
        }
        return new SqlConstantExpression(constVal);
      }

      // Outros casos: Se chegou aqui, é uma expressão não tratada especificamente acima.
      // Poderíamos tentar uma visita genérica, mas é arriscado no contexto groupBy.
      // Lança erro por segurança.
      console.error("Expressão não suportada diretamente no resultSelector groupBy:", expr);
      throw new Error(
        `Expressão tipo '${expr.type}' não suportada diretamente no resultSelector groupBy (sem ser acesso chave 'k' ou agregação 'g'). Expr: ${expr.toString()}`
      );
    };

    // Processa o corpo do resultSelector
    if (resultBody.type === LinqExpressionType.NewObject) {
      const newObjectResult = resultBody as LinqNewObjectExpression;
      for (const [alias, expr] of newObjectResult.properties.entries()) {
        const sqlExpr = translateSingleResultExpression(expr);
        if (!sqlExpr) throw new Error(`Falha ao traduzir propriedade '${String(alias)}' no resultSelector groupBy.`);
        projections.push(new ProjectionExpression(sqlExpr, String(alias)));
      }
    } else {
      // Resultado é uma expressão simples
      const sqlExpr = translateSingleResultExpression(resultBody);
      if (!sqlExpr) throw new Error(`Falha ao traduzir corpo do resultSelector groupBy: ${resultBody.toString()}`);
      const alias = `groupResult${projections.length}`;
      projections.push(new ProjectionExpression(sqlExpr, alias));
    }

    return projections;
  }

  /** Mapeia nome de método LINQ agregado para nome de função SQL. */
  private mapLinqAggregateToSql(methodName: string): string {
    switch (methodName.toLowerCase()) {
      case "count":
        return "COUNT";
      case "sum":
        return "SUM";
      case "avg":
        return "AVG";
      case "min":
        return "MIN";
      case "max":
        return "MAX";
      default:
        throw new Error(`Agregação LINQ não suportada no groupBy: ${methodName}`);
    }
  }
} // Fim GroupByVisitor
