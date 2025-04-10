// src/query/translation/visitors/fundamental/MemberVisitor.ts

import {
  MemberExpression as LinqMemberExpression,
  ExpressionType as LinqExpressionType,
} from "../../../../expressions";
import {
  SqlExpression,
  TableExpressionBase,
  ColumnExpression,
  SqlFunctionCallExpression,
  SqlConstantExpression,
  TableExpression,
  SelectExpression,
  SqlExpressionType,
  CompositeUnionExpression,
  SqlBinaryExpression,
} from "../../../../sql-expressions";
import { OperatorType } from "../../../generation/utils/sqlUtils";
import { BaseExpressionVisitor } from "../base/BaseExpressionVisitor";
import { TranslationContext } from "../../TranslationContext"; // Importar se usado para criar contexto filho

/**
 * Traduz uma MemberExpression LINQ (acesso a propriedade, ex: 'u.Name', ou métodos
 * implícitos como '.length', ou propriedades de data/hora).
 */
export class MemberVisitor extends BaseExpressionVisitor<LinqMemberExpression, SqlExpression> {
  /** Traduz a MemberExpression. */
  translate(expression: LinqMemberExpression): SqlExpression {
    const memberName = expression.memberName;

    // 1. Visita a expressão do objeto passando o contexto atual
    // <<< CORREÇÃO: Passar this.context >>>
    const sourceSqlBase = this.visitSubexpression(expression.objectExpression, this.context);

    if (!sourceSqlBase) {
      throw new Error(
        `Não foi possível resolver a fonte SQL para o acesso ao membro '${memberName}'. Expressão do objeto: ${expression.objectExpression?.toString()}`
      );
    }

    // 2. Tratamento Especial para Placeholders de GroupBy
    // (A lógica interna permanece a mesma)
    if ((sourceSqlBase as any).isGroupKeyPlaceholder) {
      const keySql = (sourceSqlBase as any).getSqlForKeyAccess(memberName);
      if (keySql) return keySql;
      throw new Error(
        `Erro interno: Não foi possível resolver membro da chave '${memberName}' no placeholder groupBy.`
      );
    }
    if (
      (sourceSqlBase as any).isGroupKeyPlaceholder &&
      (sourceSqlBase as any).keySqlMapping?.size === 1 &&
      !memberName
    ) {
      const keySql = (sourceSqlBase as any).getSqlForKeyAccess();
      if (keySql) return keySql;
    }
    // --- Fim GroupBy ---

    // 3. Acesso a Membros em Fontes de Tabela/Select/Union
    if (sourceSqlBase instanceof TableExpressionBase) {
      const sourceAlias = sourceSqlBase.alias;
      if (!sourceAlias) throw new Error(`Erro interno: Fonte SQL para membro '${memberName}' sem alias.`);

      if (sourceSqlBase instanceof TableExpression) {
        return new ColumnExpression(memberName, sourceSqlBase);
      } else if (sourceSqlBase instanceof SelectExpression) {
        const projection = sourceSqlBase.projection.find((p) => p.alias === memberName);
        if (projection) return projection.expression;

        const tablePlaceholderAlias = memberName + "_all";
        const tableProjection = sourceSqlBase.projection.find(
          (p) =>
            p.alias === tablePlaceholderAlias &&
            p.expression instanceof ColumnExpression &&
            p.expression.name === "*" &&
            p.expression.table
        );
        if (
          tableProjection &&
          tableProjection.expression instanceof ColumnExpression &&
          tableProjection.expression.table
        ) {
          return tableProjection.expression.table;
        }

        const starProjection = sourceSqlBase.projection.find(
          (p) =>
            p.alias === "*" &&
            p.expression instanceof ColumnExpression &&
            p.expression.name === "*" &&
            p.expression.table?.alias === sourceSqlBase.alias
        );
        if (
          starProjection &&
          starProjection.expression instanceof ColumnExpression &&
          starProjection.expression.table
        ) {
          console.warn(`Acesso a membro '${memberName}' via projeção '*' em [${sourceAlias}]. Pode ser ambíguo.`);
          return new ColumnExpression(memberName, starProjection.expression.table);
        }

        console.warn(
          `Membro '${memberName}' não encontrado em projeções de [${sourceAlias}]. Assumindo acesso direto.`
        );
        const tempTable = new TableExpression(`(<select>)`, sourceAlias);
        return new ColumnExpression(memberName, tempTable);
      } else if (sourceSqlBase instanceof CompositeUnionExpression) {
        const tempTable = new TableExpression(`(<union>)`, sourceAlias);
        return new ColumnExpression(memberName, tempTable);
      } else {
        throw new Error(`Tipo inesperado TableExpressionBase: ${sourceSqlBase.constructor.name}`);
      }
    }
    // 4. Acesso a Membros Especiais (ex: .length)
    else if (
      memberName === "length" &&
      (sourceSqlBase instanceof ColumnExpression ||
        sourceSqlBase instanceof SqlFunctionCallExpression ||
        sourceSqlBase instanceof SqlConstantExpression)
    ) {
      return new SqlFunctionCallExpression("LEN", [sourceSqlBase]);
    }
    // 5. Acesso a Propriedades de Data/Hora (em Colunas)
    else if (sourceSqlBase instanceof ColumnExpression) {
      const funcName = mapPropertyToSqlFunction(memberName);
      if (funcName) {
        if (funcName.startsWith("DATEPART")) {
          const datePart = funcName.substring(9, funcName.indexOf(","));
          if (!datePart) throw new Error(`Erro ao extrair parte da data de '${funcName}'`);
          return new SqlFunctionCallExpression("DATEPART", [new SqlConstantExpression(datePart), sourceSqlBase]);
        }
        return new SqlFunctionCallExpression(funcName, [sourceSqlBase]);
      }
      throw new Error(
        `Acesso a membro '${memberName}' em ColumnExpression ('${sourceSqlBase.name}') não suportado diretamente.`
      );
    }
    // 6. Acesso a Membros em Constantes SQL
    else if (sourceSqlBase instanceof SqlConstantExpression) {
      throw new Error(`Acesso a membro '${memberName}' em SqlConstantExpression não suportado.`);
    }
    // 7. Outros Casos Não Tratados
    else {
      throw new Error(`Não é possível acessar membro '${memberName}' em ${sourceSqlBase.constructor.name}`);
    }
  }
}

/** Mapeia nomes de propriedades JS comuns (Date) para funções SQL ou marcadores. */
function mapPropertyToSqlFunction(propertyName: string): string | null {
  // (Função mapPropertyToSqlFunction permanece a mesma)
  switch (propertyName.toLowerCase()) {
    case "year":
      return "YEAR";
    case "month":
      return "MONTH";
    case "day":
    case "date":
      return "DAY";
    case "hour":
    case "hours":
      return "DATEPART(hour,...)";
    case "minute":
    case "minutes":
      return "DATEPART(minute,...)";
    case "second":
    case "seconds":
      return "DATEPART(second,...)";
    default:
      return null;
  }
}
