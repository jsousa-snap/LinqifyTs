// src/query/translation/visitors/method/TernaryVisitor.ts

import {
  MethodCallExpression as LinqMethodCallExpression,
  // Imports abaixo não usados diretamente, mas relevantes para o contexto
  // Expression as LinqExpression
} from "../../../../expressions";
import {
  SqlCaseExpression, // Tipo SQL para CASE WHEN THEN ELSE END
  // SqlConstantExpression, // Pode ser necessário se as partes resultarem nisso
  // ColumnExpression // Pode ser necessário se as partes resultarem nisso
} from "../../../../sql-expressions";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";

/**
 * Traduz a chamada de método placeholder `__internal_ternary__(test, consequent, alternate)`
 * para uma `SqlCaseExpression` (equivalente a `CASE WHEN test THEN consequent ELSE alternate END`).
 *
 * Herda de `BaseExpressionVisitor` porque retorna uma expressão SQL simples,
 * não modificando um `SelectExpression` existente.
 */
export class TernaryVisitor extends BaseExpressionVisitor<LinqMethodCallExpression, SqlCaseExpression> {
  /**
   * Traduz o placeholder do ternário para SqlCaseExpression.
   * @param expression A expressão de chamada do método `__internal_ternary__`.
   * @returns A SqlCaseExpression correspondente.
   * @throws {Error} Se o número de argumentos for inválido ou a tradução das partes falhar.
   */
  translate(expression: LinqMethodCallExpression): SqlCaseExpression {
    // Valida se é realmente a nossa chamada placeholder com 3 argumentos
    if (expression.methodName !== "__internal_ternary__" || expression.args.length !== 3) {
      throw new Error(
        `Erro Interno: Chamada inválida para TernaryVisitor. Esperado '__internal_ternary__' com 3 argumentos, recebido '${expression.methodName}' com ${expression.args.length} argumento(s).`
      );
    }
    const testLinq = expression.args[0]; // A condição (WHEN)
    const consequentLinq = expression.args[1]; // O resultado se verdadeiro (THEN)
    const alternateLinq = expression.args[2]; // O resultado se falso (ELSE)

    // Visita as três partes da expressão ternária, passando o contexto
    // <<< CORREÇÃO: Passa this.context >>>
    const testSql = this.visitSubexpression(testLinq, this.context);
    const consequentSql = this.visitSubexpression(consequentLinq, this.context);
    const alternateSql = this.visitSubexpression(alternateLinq, this.context);

    // Garante que todas as partes foram traduzidas com sucesso
    if (!testSql || !consequentSql || !alternateSql) {
      throw new Error(
        `Falha ao traduzir uma ou mais partes da expressão ternária para SQL. Teste: ${testLinq.toString()}, Consequente: ${consequentLinq.toString()}, Alternativa: ${alternateLinq.toString()}`
      );
    }

    // Cria a cláusula WHEN...THEN...
    // A estrutura SqlCaseExpression espera um array de {when: SqlExpr, then: SqlExpr}
    const whenClause = { when: testSql, then: consequentSql };

    // Retorna a expressão CASE
    // new SqlCaseExpression(whenClauses: Array<{when: SqlExpression, then: SqlExpression}>, elseExpression: SqlExpression | null)
    return new SqlCaseExpression([whenClause], alternateSql);
  }
}
