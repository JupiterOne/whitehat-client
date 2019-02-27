module.exports = {
  testMatch: [
    '<rootDir>/**/*.test.js'
  ],
  collectCoverageFrom: ['src/**/*.js'],
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100
    }
  }
};
