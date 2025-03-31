// --- START OF FILE src/query/generation/types.ts ---

import { Expression, ParameterExpression } from "../../expressions";

// Define o tipo da função de visita principal para permitir chamadas recursivas
export type VisitFn = (expression: Expression, context: any) => any; // Usar 'any' para o contexto simplifica a passagem inicial

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
// --- END OF FILE src/query/generation/types.ts ---
