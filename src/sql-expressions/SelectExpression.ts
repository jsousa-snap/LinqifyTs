// --- START OF FILE src/sql-expressions/SelectExpression.ts ---

// --- START OF FILE src/sql-expressions/SelectExpression.ts ---

import { SqlExpression, SqlExpressionMetadata } from "./SqlExpression";
import { ProjectionExpression, ProjectionExpressionMetadata } from "./ProjectionExpression";
import {
  TableExpressionBase, // Importa a classe base
  TableExpressionBaseMetadata,
} from "./TableExpressionBase"; // Importa metadados base
import { JoinExpressionBase, JoinExpressionBaseMetadata } from "./JoinExpressionBase";
import { SqlOrdering, SortDirection } from "./SqlOrdering";
import { SqlConstantExpressionMetadata, SqlConstantExpression } from "./SqlConstantExpression";
import { SqlExpressionType } from "./SqlExpressionType";

// *** CORREÇÃO: Estende metadados base ***
export interface SelectExpressionMetadata extends TableExpressionBaseMetadata {
  $type: SqlExpressionType.Select; // Redefine o tipo específico
  projection: ProjectionExpressionMetadata[];
  from: TableExpressionBaseMetadata;
  predicate: SqlExpressionMetadata | null; // WHERE clause
  having: SqlExpressionMetadata | null; // HAVING clause
  joins: JoinExpressionBaseMetadata[];
  orderBy: { expression: SqlExpressionMetadata; direction: SortDirection }[];
  offset: SqlConstantExpressionMetadata | null;
  limit: SqlConstantExpressionMetadata | null;
  groupBy: SqlExpressionMetadata[];
}

/**
 * Representa uma consulta SELECT completa ou uma subconsulta SELECT.
 * Agora estende TableExpressionBase para poder ser usada diretamente como fonte.
 *
 * @class SelectExpression
 * @extends {TableExpressionBase} // <<< ESTENDE TableExpressionBase
 */
export class SelectExpression extends TableExpressionBase {
  // <<< ESTENDE TableExpressionBase
  public override readonly type = SqlExpressionType.Select; // <<< Define o tipo

  constructor(
    alias: string, // <<< NOVO: Recebe o alias
    public readonly projection: ReadonlyArray<ProjectionExpression>,
    public readonly from: TableExpressionBase,
    public readonly predicate: SqlExpression | null = null,
    public readonly having: SqlExpression | null = null,
    public readonly joins: ReadonlyArray<JoinExpressionBase> = [],
    public readonly orderBy: ReadonlyArray<SqlOrdering> = [],
    public readonly offset: SqlConstantExpression | null = null,
    public readonly limit: SqlConstantExpression | null = null,
    public readonly groupBy: ReadonlyArray<SqlExpression> = []
  ) {
    super(alias); // <<< Passa o alias para a classe base
    if (!projection || projection.length === 0) throw new Error("Select must have at least one projection.");
    if (!from) throw new Error("Select must have a FROM source.");
    if (!joins) throw new Error("Joins array cannot be null.");
    if (!orderBy) throw new Error("OrderBy array cannot be null.");
    if (!groupBy) throw new Error("GroupBy array cannot be null.");
  }

  toString(): string {
    // toString da base já inclui o alias, então não precisamos dele aqui explicitamente
    // Apenas a lógica interna do SELECT
    const projStr = this.projection.map((p) => p.toString()).join(", ");
    const fromStr = this.from.toString(); // from também é TableExpressionBase
    const joinStr = this.joins.map((j) => ` ${j.toString()}`).join("");
    const whereStr = this.predicate ? ` WHERE ${this.predicate.toString()}` : "";
    const groupByStr = this.groupBy.length > 0 ? ` GROUP BY ${this.groupBy.map((g) => g.toString()).join(", ")}` : "";
    const havingStr = this.having ? ` HAVING ${this.having.toString()}` : "";
    const orderByStr =
      this.orderBy.length > 0
        ? ` ORDER BY ${this.orderBy.map((o) => `${o.expression.toString()} ${o.direction}`).join(", ")}`
        : "";
    const offsetStr = this.offset ? ` OFFSET ${this.offset.toString()} ROWS` : "";
    const limitStr = this.limit ? ` FETCH NEXT ${this.limit.toString()} ROWS ONLY` : "";

    // Retorna apenas o corpo do SELECT para debug, o gerador cuidará do alias/parênteses
    return `SELECT ${projStr} FROM ${fromStr}${joinStr}${whereStr}${groupByStr}${havingStr}${orderByStr}${offsetStr}${limitStr}`;
  }

  toMetadata(): SelectExpressionMetadata {
    const offsetMetadata = this.offset?.toMetadata() ?? null;
    const limitMetadata = this.limit?.toMetadata() ?? null;

    return {
      ...super.toMetadata(), // <<< Inclui alias e $type da base
      $type: SqlExpressionType.Select, // <<< Redefine para Select
      projection: this.projection.map((p) => p.toMetadata()),
      from: this.from.toMetadata(), // from também é TableExpressionBase
      predicate: this.predicate?.toMetadata() ?? null,
      having: this.having?.toMetadata() ?? null,
      joins: this.joins.map((j) => j.toMetadata()),
      orderBy: this.orderBy.map((o) => ({
        expression: o.expression.toMetadata(),
        direction: o.direction,
      })),
      offset: offsetMetadata as SqlConstantExpressionMetadata | null,
      limit: limitMetadata as SqlConstantExpressionMetadata | null,
      groupBy: this.groupBy.map((g) => g.toMetadata()),
    };
  }
}

// --- END OF FILE src/sql-expressions/SelectExpression.ts ---
