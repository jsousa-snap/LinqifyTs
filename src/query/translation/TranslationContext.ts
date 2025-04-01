// --- START OF FILE src/query/translation/TranslationContext.ts ---

// src/query/translation/TranslationContext.ts

import { ParameterExpression as LinqParameterExpression } from "../../expressions";
import {
  TableExpression as SqlTableExpression,
  SelectExpression as SqlSelectExpression,
  SqlExpression,
  TableExpressionBase,
  CompositeUnionExpression,
} from "../../sql-expressions";

export type SqlDataSource = TableExpressionBase | SqlSelectExpression;

/**
 * Mantém o estado durante o processo de tradução da árvore LINQ para SQL.
 * Mapeia parâmetros LINQ para suas fontes de dados SQL correspondentes (Tabela, Select, Union).
 * Suporta contextos aninhados para lambdas.
 *
 * @export
 * @class TranslationContext
 */
export class TranslationContext {
  // Mapeia o parâmetro da lambda (ex: 'u' em u => u.name) para sua fonte SQL
  private parameterMap = new Map<LinqParameterExpression, SqlDataSource>();
  // Referência ao contexto pai (para lambdas aninhadas)
  public readonly outerContext?: TranslationContext;

  // <<< REMOVIDO: aliasCounter e métodos relacionados >>>
  // private aliasCounter = 0;

  /**
   * Cria uma instância de TranslationContext.
   * @param {TranslationContext} [outerContext] O contexto pai, se este for um contexto aninhado.
   * @memberof TranslationContext
   */
  constructor(outerContext?: TranslationContext) {
    this.outerContext = outerContext;
    // <<< REMOVIDO: Herança de aliasCounter >>>
  }

  // <<< REMOVIDO: generateTableAlias() >>>

  /**
   * Registra o mapeamento entre um parâmetro LINQ e sua fonte de dados SQL.
   *
   * @param {LinqParameterExpression} parameter O parâmetro da expressão LINQ.
   * @param {SqlDataSource} source A fonte de dados SQL (Table, Select, Union) correspondente.
   * @memberof TranslationContext
   */
  public registerParameter(
    parameter: LinqParameterExpression,
    source: SqlDataSource
  ): void {
    if (
      this.parameterMap.has(parameter) &&
      this.parameterMap.get(parameter) !== source
    ) {
      console.warn(
        `TranslationContext: Parameter '${parameter.name}' is being re-registered.`
      );
    }
    this.parameterMap.set(parameter, source);
  }

  /**
   * Obtém a fonte de dados SQL associada a um parâmetro LINQ,
   * procurando no contexto atual e depois nos contextos pais recursivamente.
   *
   * @param {LinqParameterExpression} parameter O parâmetro LINQ a ser procurado.
   * @returns {(SqlDataSource | null)} A fonte de dados SQL encontrada ou null.
   * @memberof TranslationContext
   */
  public getDataSourceForParameter(
    parameter: LinqParameterExpression
  ): SqlDataSource | null {
    let current: TranslationContext | undefined = this;
    while (current) {
      const source = current.parameterMap.get(parameter);
      if (source) {
        return source; // Encontrou no contexto atual ou pai
      }
      current = current.outerContext; // Move para o contexto pai
    }
    return null; // Não encontrado em nenhum contexto
  }

  /**
   * Obtém a fonte de dados SQL associada a um parâmetro LINQ, lançando um erro se não encontrada.
   * Garante que o parâmetro esteja registrado em algum nível do contexto.
   *
   * @param {LinqParameterExpression} parameter O parâmetro LINQ a ser procurado.
   * @returns {SqlDataSource} A fonte de dados SQL encontrada.
   * @throws {Error} Se a fonte de dados para o parâmetro não for encontrada.
   * @memberof TranslationContext
   */
  public getDataSourceForParameterStrict(
    parameter: LinqParameterExpression
  ): SqlDataSource {
    const source = this.getDataSourceForParameter(parameter);
    if (!source) {
      console.error(
        "Context state when error occurred (getDataSourceForParameterStrict):"
      );
      let ctx: TranslationContext | undefined = this;
      let level = 0;
      while (ctx) {
        console.error(
          `  Context Level ${level} Map Keys:`,
          Array.from(ctx.parameterMap.keys()).map((p) => p.name)
        );
        ctx = ctx.outerContext;
        level++;
      }
      throw new Error(
        `Translation Error: Could not find SQL DataSource for LINQ parameter '${parameter.name}'. Was it registered?`
      );
    }
    return source;
  }

  /**
   * Cria um novo contexto filho, útil para visitar o corpo de lambdas.
   * O contexto filho herda o contador de alias do pai e registra os parâmetros
   * da lambda com suas fontes SQL correspondentes.
   *
   * @param {ReadonlyArray<LinqParameterExpression>} parameters Os parâmetros da lambda.
   * @param {ReadonlyArray<SqlDataSource>} sources As fontes de dados SQL para cada parâmetro.
   * @returns {TranslationContext} O novo contexto filho criado.
   * @throws {Error} Se o número de parâmetros e fontes não corresponder.
   * @memberof TranslationContext
   */
  public createChildContext(
    parameters: ReadonlyArray<LinqParameterExpression>,
    sources: ReadonlyArray<SqlDataSource>
  ): TranslationContext {
    if (parameters.length !== sources.length) {
      throw new Error(
        "Mismatch between number of lambda parameters and SQL data sources."
      );
    }
    const childContext = new TranslationContext(this); // Passa o contexto atual como pai
    // Registra cada parâmetro da lambda no contexto filho
    parameters.forEach((param, index) => {
      childContext.registerParameter(param, sources[index]);
    });
    return childContext;
  }

  // <<< REMOVIDO: updateAliasCounterFromChild() >>>
}

// --- END OF FILE src/query/translation/TranslationContext.ts ---
