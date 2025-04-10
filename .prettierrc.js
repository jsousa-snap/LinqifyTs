// .prettierrc.js
module.exports = {
  printWidth: 120, // <<<< AUMENTE ESTE VALOR! O padrão é 80. 100 ou 120 são comuns. Experimente!

  tabWidth: 2, // Largura da tabulação (ou espaços equivalentes)
  useTabs: false, // Usar espaços em vez de tabs
  semi: true, // Usar ponto e vírgula no final das declarações
  singleQuote: false, // Usar aspas duplas para strings (true para aspas simples)
  trailingComma: "es5", // Adicionar vírgula final onde válido no ES5 (arrays, objetos, etc.)
  bracketSpacing: true, // Espaços entre chaves em literais de objeto: { foo: bar }
  arrowParens: "always", // Sempre colocar parênteses em parâmetros de arrow functions: (x) => x
  // jsxBracketSameLine: false, // (Relevante para React/JSX) Coloca o > de tags JSX multi-linha na próxima linha
};
