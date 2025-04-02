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
export * from "./SqlCaseExpression";
export * from "./SqlInExpression"; // <<< EXPORTAR SqlInExpression
export * from "./JoinExpressionBase";
export * from "./InnerJoinExpression";
export * from "./LeftJoinExpression";
// Adicionar outros tipos de Join aqui (RightJoin, etc.) se implementados
export * from "./SqlExistsExpression";
export * from "./SqlScalarSubqueryAsJsonExpression";
export * from "./SqlScalarSubqueryExpression";
export * from "./SqlOrdering";
export * from "./SqlFunctionCallExpression";
export * from "./CompositeUnionExpression";

// --- END OF FILE src/sql-expressions/index.ts ---
