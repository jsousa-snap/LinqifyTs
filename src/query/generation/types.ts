import { Expression, ParameterExpression } from "../../expressions";
import { SqlExpression } from "../../sql-expressions";
import { TranslationContext } from "../translation";

/**
 * Representa a função principal de visita usada pelo orquestrador.
 * @param expression A expressão LINQ a ser visitada.
 * @param context O contexto de tradução atual a ser usado para esta visita.
 * @returns A expressão SQL resultante ou null.
 */
export type VisitFn = (expression: Expression | null, context: TranslationContext) => SqlExpression | null;

// Informações sobre uma fonte de dados (tabela base ou resultado de operação)
export interface SourceInfo {
  alias: string;
  expression: Expression; // A expressão que CRIOU esta fonte
  isBaseTable: boolean;
  providesAllColumns?: boolean; // Se representa todas as colunas da fonte base
  parameters?: ParameterExpression[]; // Parâmetros que REFERENCIAM esta fonte
  // Para fontes virtuais (Select/Join):
  projectionBody?: Expression; // O corpo da lambda de projeção
  projectionParameters?: ReadonlyArray<ParameterExpression>; // Os parâmetros da lambda de projeção
  projectionSourceInfos?: ReadonlyArray<SourceInfo>; // As fontes originais usadas na projeção
}

// Representa uma cláusula SELECT no SQL final
export interface SelectClause {
  sql: string;
  alias?: string;
}

// Resultado de uma resolução de membro (pode não ser necessário globalmente)
export interface ResolvedMember {
  finalBaseParam: ParameterExpression;
  finalMemberName: string;
}

// Resultado comum de um visitor que gera SQL diretamente
export interface SqlResult {
  sql: string;
}
