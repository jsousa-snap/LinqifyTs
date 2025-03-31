// --- START OF FILE src/query/generation/index.ts ---

export * from "./QueryBuilderContext";
// Remover exports dos visitors antigos (visit*.ts)
export * from "./SqlServerQuerySqlGenerator"; // <-- Exporta o novo gerador
export * from "./types";
export * from "./utils/sqlUtils";

// --- END OF FILE src/query/generation/index.ts ---
