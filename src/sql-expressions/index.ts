// --- START OF FILE src/sql-expressions/index.ts ---

// src/sql-expressions/index.ts

export * from "./SqlExpressionType";
export * from "./SqlExpression";
export * from "./TableExpressionBase"; // <<< EXPORTAR NOVA BASE
export * from "./TableExpression";
export * from "./ColumnExpression";
export * from "./ProjectionExpression";
export * from "./SelectExpression";
export * from "./SqlConstantExpression";
export * from "./SqlBinaryExpression";
export * from "./SqlLikeExpression";
export * from "./JoinExpressionBase";
export * from "./InnerJoinExpression";
// Adicionar outros tipos de Join aqui (LeftJoin, etc.) se implementados
export * from "./SqlExistsExpression";
export * from "./SqlScalarSubqueryAsJsonExpression";
export * from "./SqlScalarSubqueryExpression";
export * from "./SqlOrdering";
export * from "./SqlFunctionCallExpression";
export * from "./CompositeUnionExpression"; // <<< EXPORTAR NOVA CLASSE

// --- END OF FILE src/sql-expressions/index.ts ---
