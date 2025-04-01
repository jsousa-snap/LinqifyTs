/* jest.config.js */
// --- START OF FILE jest.config.js ---
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // **** ADICIONADO: Especifica explicitamente os arquivos de teste ****
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)", // Apenas arquivos .test.ts/js em __tests__
    // Você pode adicionar "**/?(*.)+(spec).[jt]s?(x)" se também usar .spec.ts/js
  ],
  // **** FIM DA ADIÇÃO ****

  // Opcional: Mapeamento de caminhos
  // moduleNameMapper: {
  //   '^@/(.*)$': '<rootDir>/src/$1'
  // },
  // Opcional: Diretórios a serem ignorados
  // testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
// --- END OF FILE jest.config.js ---
