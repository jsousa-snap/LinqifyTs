// --- START OF FILE src/sql-expressions/SelectExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import {
  ProjectionExpression,
  ProjectionExpressionMetadata,
} from "./ProjectionExpression";
import {
  TableExpressionBase,
  TableExpressionBaseMetadata,
} from "./TableExpressionBase";
import {
  JoinExpressionBase,
  JoinExpressionBaseMetadata,
} from "./JoinExpressionBase";
import { SqlOrdering, SortDirection } from "./SqlOrdering";
import {
  SqlConstantExpressionMetadata,
  SqlConstantExpression,
} from "./SqlConstantExpression";
import { SqlExpressionType } from "./SqlExpressionType";

// Nova interface de metadados para SelectExpression
export interface SelectExpressionMetadata extends SqlExpressionMetadata {
  $type: SqlExpressionType.Select;
  projection: ProjectionExpressionMetadata[];
  from: TableExpressionBaseMetadata;
  predicate: SqlExpressionMetadata | null;
  joins: JoinExpressionBaseMetadata[];
  orderBy: { expression: SqlExpressionMetadata; direction: SortDirection }[];
  // Mantém os tipos específicos esperados para offset/limit
  offset: SqlConstantExpressionMetadata | null;
  limit: SqlConstantExpressionMetadata | null;
  groupBy: SqlExpressionMetadata[];
}

/**
 * Representa uma consulta SELECT completa ou uma subconsulta SELECT.
 *
 * @class SelectExpression
 * @extends {SqlExpression}
 */
export class SelectExpression extends SqlExpression {
  public readonly type = SqlExpressionType.Select;

  constructor(
    public readonly projection: ReadonlyArray<ProjectionExpression>,
    public readonly from: TableExpressionBase,
    public readonly predicate: SqlExpression | null = null,
    public readonly joins: ReadonlyArray<JoinExpressionBase> = [],
    public readonly orderBy: ReadonlyArray<SqlOrdering> = [],
    // Garante que offset/limit sejam SqlConstantExpression ou null no construtor
    public readonly offset: SqlConstantExpression | null = null,
    public readonly limit: SqlConstantExpression | null = null,
    public readonly groupBy: ReadonlyArray<SqlExpression> = []
  ) {
    super();
    if (!projection || projection.length === 0)
      throw new Error("Select must have at least one projection.");
    if (!from) throw new Error("Select must have a FROM source.");
    if (!joins) throw new Error("Joins array cannot be null.");
    if (!orderBy) throw new Error("OrderBy array cannot be null.");
    if (!groupBy) throw new Error("GroupBy array cannot be null.");

    // Removido o warning sobre tipo não constante, pois agora o tipo é forçado
    // if (offset && offset.type !== SqlExpressionType.Constant) { ... }
    // if (limit && limit.type !== SqlExpressionType.Constant) { ... }
  }

  toString(): string {
    // ... (inalterado) ...
    const projStr = this.projection.map((p) => p.toString()).join(", ");
    const fromStr = this.from.toString();
    const joinStr = this.joins.map((j) => ` ${j.toString()}`).join("");
    const whereStr = this.predicate
      ? ` WHERE ${this.predicate.toString()}`
      : "";
    const groupByStr =
      this.groupBy.length > 0
        ? ` GROUP BY ${this.groupBy.map((g) => g.toString()).join(", ")}`
        : "";
    const orderByStr =
      this.orderBy.length > 0
        ? ` ORDER BY ${this.orderBy
            .map((o) => `${o.expression.toString()} ${o.direction}`)
            .join(", ")}`
        : "";
    const offsetStr = this.offset
      ? ` OFFSET ${this.offset.toString()} ROWS`
      : "";
    const limitStr = this.limit
      ? ` FETCH NEXT ${this.limit.toString()} ROWS ONLY`
      : "";

    return `SELECT ${projStr} FROM ${fromStr}${joinStr}${whereStr}${groupByStr}${orderByStr}${offsetStr}${limitStr}`;
  }

  toMetadata(): SelectExpressionMetadata {
    // *** CORREÇÃO: Adicionar asserção de tipo para offset e limit ***
    const offsetMetadata = this.offset?.toMetadata() ?? null;
    const limitMetadata = this.limit?.toMetadata() ?? null;

    return {
      $type: SqlExpressionType.Select,
      projection: this.projection.map((p) => p.toMetadata()),
      from: this.from.toMetadata(),
      predicate: this.predicate?.toMetadata() ?? null,
      joins: this.joins.map((j) => j.toMetadata()),
      orderBy: this.orderBy.map((o) => ({
        expression: o.expression.toMetadata(),
        direction: o.direction,
      })),
      // Usa asserção de tipo para satisfazer a interface
      offset: offsetMetadata as SqlConstantExpressionMetadata | null,
      limit: limitMetadata as SqlConstantExpressionMetadata | null,
      groupBy: this.groupBy.map((g) => g.toMetadata()),
    };
  }
}

// --- END OF FILE src/sql-expressions/SelectExpression.ts ---
