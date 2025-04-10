import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
} from "../../../../expressions";
import { SqlExpression, SelectExpression, SqlBinaryExpression } from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor
import { OperatorType } from "../../../generation/utils/sqlUtils"; // Para combinar predicados com AND

/**
 * Traduz uma chamada de método LINQ `where` que ocorre *após* um `groupBy`,
 * mapeando-a para a cláusula HAVING de uma SelectExpression SQL.
 *
 * Herda de `MethodVisitor` porque modifica um `SelectExpression` existente.
 */
export class HavingVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  /**
   * Cria uma instância de HavingVisitor.
   * @param context Contexto de tradução.
   * @param aliasGenerator Gerador de alias.
   * @param visitDelegate Função de visita principal (`visitSubexpression`).
   * @param visitInContext Função para visitar a lambda do predicado no contexto correto.
   */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // visitSubexpression (necessário para super)
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null
  ) {
    // Passa os delegates relevantes para MethodVisitor
    // HavingVisitor não usa createProjections ou createDefaultSelect diretamente
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /**
   * Aplica a lógica do `where` (como HAVING) à SelectExpression atual (resultado do GroupBy).
   * @param expression A expressão de chamada do método `where`.
   * @param currentSelect A SelectExpression SQL atual (resultado do GroupBy) a ser modificada.
   * @param sourceForLambda A fonte de dados SQL para resolver o parâmetro da lambda (geralmente representa o resultado do grupo: chave + agregados).
   * @returns A nova SelectExpression com a cláusula HAVING definida ou atualizada.
   * @throws {Error} Se argumentos inválidos ou falha na tradução do predicado.
   */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    sourceForLambda: SqlDataSource // Representa o grupo (k, g)
  ): SelectExpression {
    // Validações
    // Embora a chamada LINQ seja 'where', este visitor só deve ser chamado nesse contexto.
    if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
      throw new Error("Argumentos inválidos para 'where' (atuando como HAVING). Esperada uma LambdaExpression.");
    }
    const lambda = expression.args[0] as LinqLambdaExpression;
    // O parâmetro da lambda representa o resultado do GroupBy (ex: g => g.Key.Country == "USA" && g.Sum(x => x.Total) > 1000)
    if (lambda.parameters.length !== 1) {
      throw new Error(
        "A lambda do 'where' (atuando como HAVING) deve ter exatamente um parâmetro representando o grupo."
      );
    }
    const param = lambda.parameters[0]; // Parâmetro representando o resultado do group (ex: g)

    // Cria contexto filho para a lambda do predicado HAVING
    // A fonte para este contexto é o resultado do GroupBy (sourceForLambda)
    const predicateContext = this.context.createChildContext([param], [sourceForLambda]);

    // Visita o corpo da lambda (a condição HAVING) no contexto filho
    const predicateSql = this.visitInContext(lambda.body, predicateContext);

    if (!predicateSql) {
      throw new Error(`Não foi possível traduzir o predicado 'where' (atuando como HAVING): ${lambda.body.toString()}`);
    }

    // Combina o novo predicado com qualquer predicado HAVING já existente usando AND
    const newHaving = currentSelect.having
      ? new SqlBinaryExpression(currentSelect.having, OperatorType.And, predicateSql)
      : predicateSql;

    // Retorna uma *nova* instância de SelectExpression com a cláusula HAVING atualizada.
    // Mantém as outras partes da SelectExpression (projeções do GroupBy, FROM, WHERE original, etc.)
    return new SelectExpression(
      currentSelect.alias, // Mantém alias original
      currentSelect.projection, // Mantém projeções (do GroupBy)
      currentSelect.from, // Mantém FROM original
      currentSelect.predicate, // Mantém WHERE original (antes do GroupBy)
      newHaving,
      currentSelect.joins, // Mantém Joins originais
      currentSelect.orderBy, // Mantém OrderBy (pode ser relevante após GroupBy)
      currentSelect.offset, // Mantém Offset
      currentSelect.limit, // Mantém Limit
      currentSelect.groupBy // Mantém GroupBy (essencial!)
    );
  }
}
