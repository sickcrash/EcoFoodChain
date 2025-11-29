module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 10000,
  coveragePathIgnorePatterns: ['/node_modules/'],
  roots: ['<rootDir>/src', '<rootDir>/../tests'],
  testMatch: ['**/*.test.js'],
  // Permette ai test fuori da <rootDir> di risolvere moduli installati nel backend
  moduleNameMapper: {
    '^(supertest)$': '<rootDir>/node_modules/supertest',
    '^(node-mocks-http)$': '<rootDir>/node_modules/node-mocks-http'
  },
  setupFiles: ['<rootDir>/jest.setup.js']
};
