import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Base flat config, extended by every project's own `eslint.config.mjs`;
 * `pnpm lint` runs them all. A plain file at the workspace root rather than a
 * package — its plugins are declared in the root `package.json`, so each
 * project resolves them from here and none has to install the set itself.
 *
 * The rule severities below are the ones `@nx/eslint-plugin` used to supply
 * through `flat/typescript` and `flat/javascript`, kept deliberately: they are
 * what the code in this repository was written against, and tightening any of
 * them is a separate change from removing Nx. `@nx/enforce-module-boundaries`
 * is simply gone: it was configured to let every project depend on every
 * other, so it enforced nothing.
 *
 * `eslint-config-prettier` is deliberately not applied. Nx appended it only
 * when it could be resolved, and the pinned 10.0.0 ships no `main` and no
 * `exports` (a packaging bug in that release), so it never loaded here either.
 * Importing it now would turn a silent no-op into a crash.
 */

const shared = {
  '@typescript-eslint/explicit-member-accessibility': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/adjacent-overload-signatures': 'error',
  '@typescript-eslint/prefer-namespace-keyword': 'error',
  'no-empty-function': 'off',
  '@typescript-eslint/no-empty-function': 'error',
  '@typescript-eslint/no-inferrable-types': 'error',
  // A warning, not an error. `contract/src` deliberately keeps its zod schemas
  // module-private and exports only `z.infer` of them, which this rule reads as
  // "assigned a value but only used as a type"; that convention is documented
  // and load-bearing, so it must not fail a build.
  '@typescript-eslint/no-unused-vars': 'warn',
  '@typescript-eslint/no-empty-object-type': 'error',
  '@typescript-eslint/no-explicit-any': 'warn',
  // Config files here are CommonJS — `webpack.config.js`, `jest.config.cts`,
  // `next.config.js` — and `require` is the only import form they have.
  '@typescript-eslint/no-require-imports': 'off',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out-tsc/**',
      '**/test-output/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/*.d.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: shared,
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: shared,
  },
);
