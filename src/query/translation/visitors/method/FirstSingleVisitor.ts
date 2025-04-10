import {
  Expression as LinqExpression,
  ExpressionType as LinqExpressionType,
  MethodCallExpression as LinqMethodCallExpression,
  LambdaExpression as LinqLambdaExpression,
  ConstantExpression as LinqConstantExpression,
} from "../../../../expressions";
import { SqlExpression, SelectExpression, ProjectionExpression } from "../../../../sql-expressions";
import { TranslationContext, SqlDataSource } from "../../TranslationContext";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { MethodVisitor } from "../base/MethodVisitor"; // <<< Herda de MethodVisitor
import { WhereVisitor } from "./WhereVisitor"; // <<< Reutiliza WhereVisitor
import { TakeVisitor } from "./TakeVisitor"; // <<< Reutiliza TakeVisitor

/**
 * Traduz chamadas de método LINQ como `first`, `firstOrDefault`, `single`, `singleOrDefault` (e Async).
 * Aplica o predicado (se houver) usando WhereVisitor e define LIMIT/FETCH apropriado usando TakeVisitor.
 * Marca a projeção com um alias especial para identificação pelo executor da query.
 *
 * Herda de `MethodVisitor`.
 */
export class FirstSingleVisitor extends MethodVisitor<LinqMethodCallExpression, SelectExpression> {
  // Precisa de visitInContext (para WhereVisitor) e visitDelegate (para TakeVisitor)
  // Ambos são recebidos e armazenados pela base MethodVisitor.

  /** Cria uma instância de FirstSingleVisitor. */
  constructor(
    context: TranslationContext,
    aliasGenerator: AliasGenerator,
    visitDelegate: VisitFn, // Para TakeVisitor e super()
    visitInContext: (expression: LinqExpression, context: TranslationContext) => SqlExpression | null // Para WhereVisitor e super()
  ) {
    super(context, aliasGenerator, visitDelegate, visitInContext);
  }

  /** Aplica a lógica do first/single. */
  apply(
    expression: LinqMethodCallExpression,
    currentSelect: SelectExpression,
    // <<< Usa SqlDataSource importado de TranslationContext >>>
    sourceForLambda: SqlDataSource // Necessário se houver predicado
  ): SelectExpression {
    const methodName = expression.methodName.replace(/Async$/, ""); // Remove Async suffix
    const supportedMethods = ["first", "firstOrDefault", "single", "singleOrDefault"];
    if (!supportedMethods.includes(methodName)) {
      throw new Error(`FirstSingleVisitor não suporta o método '${expression.methodName}'.`);
    }

    let selectAfterPredicate = currentSelect; // Começa com o select atual

    // --- 1. Aplicar Predicado (se houver) ---
    // Verifica se foi passado um argumento lambda (o predicado)
    if (expression.args.length > 0) {
      if (expression.args.length !== 1 || expression.args[0].type !== LinqExpressionType.Lambda) {
        throw new Error(`Argumento inválido para '${methodName}' com predicado. Esperada uma lambda.`);
      }
      const predicateLambda = expression.args[0] as LinqLambdaExpression;

      // Instancia e usa o WhereVisitor para aplicar o predicado
      // Passa os delegates necessários que foram armazenados no construtor
      const whereVisitor = new WhereVisitor(
        this.context,
        this.aliasGenerator,
        this.visitSubexpression,
        this.visitInContext
      );

      // Cria uma chamada 'where' *virtual* para passar ao visitor.
      // É crucial usar a *fonte LINQ original* da chamada first/single (expression.source)
      // para que o contexto da lambda seja resolvido corretamente pelo WhereVisitor.
      const virtualWhereCall = new LinqMethodCallExpression("where", expression.source!, [predicateLambda]);

      // Aplica o where na SelectExpression atual
      selectAfterPredicate = whereVisitor.apply(virtualWhereCall, currentSelect, sourceForLambda);
    }

    // --- 2. Aplicar Take/Limit ---
    const isSingle = methodName.startsWith("single");
    // single/singleOrDefault precisam buscar 2 registros para verificar unicidade no lado do cliente.
    // first/firstOrDefault precisam buscar apenas 1 registro.
    const takeCount = isSingle ? 2 : 1;

    // Instancia e usa o TakeVisitor para aplicar o LIMIT
    // Passa os delegates necessários que foram armazenados no construtor
    const takeVisitor = new TakeVisitor(
      this.context,
      this.aliasGenerator,
      this.visitSubexpression,
      this.visitInContext
    );

    // Cria uma chamada 'take' *virtual*.
    // A fonte aqui é novamente a fonte LINQ original, embora o TakeVisitor
    // na verdade opere sobre a *SelectExpression resultante* (selectAfterPredicate).
    const virtualTakeCall = new LinqMethodCallExpression("take", expression.source!, [
      new LinqConstantExpression(takeCount),
    ]);

    // Aplica o take na SelectExpression (que já pode ter o predicado aplicado)
    const selectAfterTake = takeVisitor.apply(virtualTakeCall, selectAfterPredicate, sourceForLambda); // sourceForLambda não é usado por Take

    // --- 3. Marcar Projeção com Alias Especial ---
    // O alias "_result" ajuda o executor da query a identificar a intenção final
    // (ex: lançar exceção se First/Single não encontrar, retornar default, verificar unicidade).
    const resultAliasMap: { [key: string]: string } = {
      first: "first_result",
      firstOrDefault: "firstOrDefault_result",
      single: "single_result",
      singleOrDefault: "singleOrDefault_result",
    };
    // Usa o nome base (sem Async) para buscar o alias de resultado
    const resultAlias = resultAliasMap[methodName];

    // Garante que todas as projeções tenham um alias significativo ou o alias especial.
    // Se for SELECT *, o alias '*' é mantido internamente, mas o alias externo indicará a operação.
    const finalProjections = selectAfterTake.projection.map((p) => {
      // Se a projeção já tem um alias explícito (e não é '*'), mantém.
      // Caso contrário (é '*' ou não tem alias), usa o alias especial de resultado.
      const useExistingAlias = p.alias && p.alias !== "*";
      return new ProjectionExpression(
        p.expression,
        useExistingAlias ? p.alias : resultAlias // Define o alias
      );
    });

    // Gera um alias para a SelectExpression externa que incorpora a intenção (opcional, mas informativo)
    const finalSelectAlias = this.aliasGenerator.generateAlias(methodName);

    // Retorna a SelectExpression final modificada com predicado (se houver), limit, e alias marcados
    return new SelectExpression(
      finalSelectAlias, // Alias indicando a operação (first, single)
      finalProjections, // <<< Projeções (potencialmente marcadas com _result)
      selectAfterTake.from, // FROM (inalterado)
      selectAfterTake.predicate, // WHERE (inclui predicado do método, se houver)
      selectAfterTake.having, // HAVING (inalterado)
      selectAfterTake.joins, // Joins (inalterado)
      selectAfterTake.orderBy, // OrderBy (essencial para First/FirstOrDefault ser determinístico)
      selectAfterTake.offset, // Offset (pode ter vindo de um Skip anterior)
      selectAfterTake.limit, // <<< LIMIT (definido como 1 ou 2 pelo TakeVisitor)
      selectAfterTake.groupBy // GroupBy (inalterado)
    );
  }
}
