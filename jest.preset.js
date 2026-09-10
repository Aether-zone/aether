/**
 * Shared Jest defaults, extended by each project's `jest.config.cts` through
 * `preset: '../jest.preset.js'`.
 *
 * Projects override `transform`, `testEnvironment` and `moduleFileExtensions`
 * for themselves; what lives here is only what they all agree on.
 */
module.exports = {
  // One of Jest's own default patterns, widened to the .mts/.cts spellings.
  testMatch: ['**/?(*.)+(spec|test).?([mc])[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'js', 'mts', 'mjs', 'cts', 'cjs', 'html'],
  coverageReporters: ['html'],
  // Build output holds a second copy of every module; without this Jest offers
  // both to `require` and warns about the duplicate haste names.
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/out-tsc/'],
  // `@aether/contract` is ESM under `nodenext`, so its relative imports carry
  // a `.js` extension that points at a file only TypeScript can see. Strip it
  // so Jest resolves the `.ts` source instead. This lived in the Nx jest
  // resolver, which every project inherited; it belongs here now.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Jest runs CommonJS, so packages are resolved through their `require`/`node`
  // export conditions rather than the `browser`/`import` ones a bundler picks.
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require', 'default'],
  },
};
