// src/query/translation/visitors/fundamental/ParameterVisitor.ts

import { ParameterExpression as LinqParameterExpression } from "../../../../expressions";
// SqlDataSource é um tipo importado de TranslationContext
import { SqlDataSource } from "../../TranslationContext";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";
// TranslationContext é acessado via this.context

/**
 * Traduz uma ParameterExpression LINQ (ex: 'u' em 'u => u.Name').
 * Busca a fonte de dados SQL (`SqlDataSource`) associada a este parâmetro
 * no contexto de tradução atual (`this.context`).
 */
export class ParameterVisitor extends BaseExpressionVisitor<LinqParameterExpression, SqlDataSource> {
  /**
   * Traduz a ParameterExpression buscando sua fonte SQL no contexto.
   * @param expression O parâmetro LINQ (ex: o 'u').
   * @returns A SqlDataSource (Table, Select, Union, ou um placeholder especial como de GroupBy) associada ao parâmetro.
   * @throws {Error} Se o parâmetro não estiver registrado no contexto (via `getDataSourceForParameterStrict`).
   */
  translate(expression: LinqParameterExpression): SqlDataSource {
    // Usa o método strict do contexto (acessível via this.context herdado da base)
    // para obter a fonte de dados SQL. Lança erro se não encontrar.
    return this.context.getDataSourceForParameterStrict(expression);
  }
}
