// --- START OF FILE src/__tests__/utils/testUtils.ts ---

/**
 * Normaliza uma string SQL removendo espaços/quebras de linha extras
 * *apenas* no início e no fim, conforme padrão especificado.
 * @param sql A string SQL de entrada.
 * @returns A string SQL normalizada.
 */
export const normalizeSql = (sql: string): string => {
  let result = sql;

  // Remove espaços em branco seguidos pela primeira quebra de linha no início
  result = result.replace(/^\s*\n/, "");

  // Remove a última quebra de linha seguida por espaços em branco no final
  result = result.replace(/\n\s*$/, "");

  return result;
};

// --- END OF FILE src/__tests__/utils/testUtils.ts ---
