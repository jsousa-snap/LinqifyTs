// --- START OF FILE expressions/Expression.ts ---

export enum ExpressionType {
  Parameter = "Parameter",
  MemberAccess = "MemberAccess",
  Constant = "Constant",
  Call = "Call",
  Lambda = "Lambda",
  Binary = "Binary",
  Literal = "Literal",
  NewObject = "NewObject",
  Scope = "Scope", // **** NOVO TIPO ****
  // ...
}

export abstract class Expression {
  abstract readonly type: ExpressionType;
  abstract toString(): string;
}
// --- END OF FILE expressions/Expression.ts ---
