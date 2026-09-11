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
  /*
   * `@nestjs/typeorm` v12 ships ESM only — no CommonJS build at all — and
   * these specs run as CommonJS. Jest ignores `node_modules` by default, so
   * the file reached the runtime untransformed and failed on its first
   * `export`. This lets swc convert that one package.
   *
   * The negative lookahead matches the path anywhere rather than at the
   * segment after `node_modules`, because pnpm's layout puts the real file
   * under `.pnpm/@nestjs+typeorm@…/node_modules/@nestjs/typeorm` — two
   * `node_modules` segments, and the naive pattern only excuses the last one.
   */
  transformIgnorePatterns: ['/node_modules/(?!.*@nestjs[+/]typeorm)'],
  // The `@aether/*` aliases are a TypeScript path mapping, which Jest does not
  // read — without this every spec importing a lib fails to resolve it. Keep in
  // step with `paths` in tsconfig.app.json.
  moduleNameMapper: {
    '^@aether/(chronos|events|oikonomos|prosopone|tekmerion|telos|topos)$':
      '<rootDir>/libs/$1/src',
    '^@aether/(chronos|events|oikonomos|prosopone|tekmerion|telos|topos)/(.*)$':
      '<rootDir>/libs/$1/src/$2',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
