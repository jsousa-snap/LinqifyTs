/**
 * Gera aliases únicos para fontes SQL (tabelas, subconsultas).
 * O primeiro alias para um prefixo é apenas a letra (e.g., u, p, s).
 * Aliases subsequentes são numerados a partir de 1 (e.g., u1, p1, s1).
 * Garante unicidade dentro de uma única instância do gerador.
 *
 * @export
 * @class AliasGenerator
 */
export class AliasGenerator {
  /**
   * Mapeia um prefixo (primeira letra minúscula) para o próximo número sequencial a ser usado.
   * O valor armazenado representa o *próximo* número a ser usado (começando em 1 para o segundo alias).
   * @private
   * @type {Map<string, number>}
   * @memberof AliasGenerator
   */
  private prefixCounts: Map<string, number> = new Map<string, number>();

  /**
   * Gera um novo alias único com base no nome fornecido.
   *
   * @param {string | undefined | null} baseName O nome base para derivar o prefixo (ex: "Users", "Posts", "select", "join").
   * @returns {string} O alias gerado (ex: "u", "p", "s", "u1", "p1", "s1").
   * @memberof AliasGenerator
   */
  public generateAlias(baseName: string | undefined | null): string {
    let prefix = "t"; // Prefixo padrão

    if (baseName && typeof baseName === "string" && baseName.length > 0) {
      const match = baseName.match(/[a-zA-Z]/);
      if (match) {
        prefix = match[0].toLowerCase();
      }
    }

    if (!this.prefixCounts.has(prefix)) {
      this.prefixCounts.set(prefix, 1);
      return prefix;
    } else {
      const count = this.prefixCounts.get(prefix)!;
      this.prefixCounts.set(prefix, count + 1);
      return `${prefix}${count}`;
    }
  }

  /**
   * Reseta os contadores internos.
   * @memberof AliasGenerator
   */
  public reset(): void {
    this.prefixCounts.clear();
  }
}
