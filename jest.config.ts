/** @type {import('ts-jest').JestConfigWithTsJest} **/

module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'json', 'ts'],

  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  maxWorkers: 1,

  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },

  testTimeout: 60 * 1000,

  globalSetup: '<rootDir>/test/jest/globalSetup.ts',
  globalTeardown: '<rootDir>/test/jest/globalTeardown.ts',
};
