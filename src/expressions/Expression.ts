export enum ExpressionType {
  Parameter = "Parameter",
  MemberAccess = "MemberAccess",
  Constant = "Constant",
  Call = "Call",
  Lambda = "Lambda",
  Binary = "Binary",
  Literal = "Literal",
  NewObject = "NewObject",
  Scope = "Scope",
}

export abstract class Expression {
  abstract readonly type: ExpressionType;
  abstract toString(): string;
}
