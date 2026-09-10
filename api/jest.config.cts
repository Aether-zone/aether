/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@aether/api',
  preset: '../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // The `@aether/*` aliases are a TypeScript path mapping, which Jest does not
  // read — without this every spec importing a lib fails to resolve it. Keep in
  // step with `paths` in tsconfig.app.json.
  moduleNameMapper: {
    '^@aether/(chronos|oikonomos|prosopone|tekmerion|telos|topos)$':
      '<rootDir>/libs/$1/src',
    '^@aether/(chronos|oikonomos|prosopone|tekmerion|telos|topos)/(.*)$':
      '<rootDir>/libs/$1/src/$2',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
