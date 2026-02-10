module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 120000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/data/**'
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['./tests/setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/vendor/']
};
