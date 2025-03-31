// jest.config.js
module.exports = {
  preset: "ts-jest", // Informa ao Jest para usar ts-jest para arquivos .ts/.tsx
  testEnvironment: "node", // Define o ambiente de teste (geralmente 'node' para backend/libs)
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"], // Extensões que o Jest deve procurar
  // Opcional: Mapeamento de caminhos (se você usa paths no tsconfig.json)
  // moduleNameMapper: {
  //   '^@/(.*)$': '<rootDir>/src/$1' // Exemplo
  // },
  // Opcional: Diretórios a serem ignorados
  // testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
