import { Expression as LinqExpression } from "../../../../expressions";
import { SqlExpression } from "../../../../sql-expressions";
import { AliasGenerator } from "../../../generation/AliasGenerator";
import { VisitFn } from "../../../generation/types";
import { TranslationContext } from "../../TranslationContext";

/**
 * Classe base abstrata para todos os visitors de nós de expressão LINQ específicos.
 * Fornece acesso ao contexto de tradução, gerador de alias e à função
 * principal de visita para processar sub-expressões.
 *
 * Os visitors que herdam diretamente desta classe são geralmente para nós LINQ
 * fundamentais (Constant, Literal, Parameter, Member, Binary) ou para métodos
 * que não operam modificando uma SelectExpression existente (Any, Union, Includes).
 *
 * @template TLinq Tipo da expressão LINQ que este visitor manipula.
 * @template TSql Tipo da expressão SQL resultante esperada.
 */
export abstract class BaseExpressionVisitor<TLinq extends LinqExpression, TSql extends SqlExpression> {
  /**
   * O contexto de tradução atual, mantendo o mapeamento de parâmetros LINQ para fontes SQL.
   */
  protected readonly context: TranslationContext;

  /**
   * O gerador de alias para criar nomes únicos para tabelas e subconsultas.
   */
  protected readonly aliasGenerator: AliasGenerator;

  /**
   * Uma delegação para a função de visita principal do orquestrador (`QueryExpressionVisitor.visit`).
   * Permite que este visitor visite recursivamente sub-expressões usando o contexto principal do orquestrador.
   */
  protected readonly visitSubexpression: VisitFn;

  /**
   * Inicializa uma nova instância de BaseExpressionVisitor.
   * @param context O contexto de tradução.
   * @param aliasGenerator O gerador de alias.
   * @param visitDelegate A função de visita principal do orquestrador (`QueryExpressionVisitor.visit.bind(orchestrator)`).
   */
  constructor(context: TranslationContext, aliasGenerator: AliasGenerator, visitDelegate: VisitFn) {
    // Validações básicas dos argumentos (opcional, mas bom)
    if (!context) throw new Error("BaseExpressionVisitor: TranslationContext é obrigatório.");
    if (!aliasGenerator) throw new Error("BaseExpressionVisitor: AliasGenerator é obrigatório.");
    if (!visitDelegate) throw new Error("BaseExpressionVisitor: visitDelegate é obrigatório.");

    this.context = context;
    this.aliasGenerator = aliasGenerator;
    this.visitSubexpression = visitDelegate;
  }

  /**
   * Método abstrato que deve ser implementado por cada visitor específico
   * para traduzir a expressão LINQ fornecida em sua contraparte SQL.
   * Este método é chamado pelo orquestrador (`QueryExpressionVisitor.visit`).
   * @param expression A expressão LINQ específica que este visitor manipula.
   * @returns A expressão SQL resultante da tradução.
   */
  abstract translate(expression: TLinq): TSql | null; // Permitir null para casos como IncludesArrayVisitor.tryTranslate

  // Nota: A função visitInContext foi movida para MethodVisitor e/ou gerenciada
  // pelo orquestrador, pois BaseExpressionVisitor geralmente não precisa dela,
  // e passar o delegate correto para ele era complexo aqui. Os visitors que
  // precisam de visitInContext (Where, Select, Join, etc.) herdarão de MethodVisitor
  // que recebe explicitamente o delegate visitInContext.
}
