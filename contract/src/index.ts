/**
 * Types and schemas shared by `@aether/api` and `@aether/web`.
 *
 * One folder per domain, matching the libraries under `api/libs`. What lives
 * here is only what both sides need to agree on — the shape of a request and
 * the shape of a resource. Anything only the server needs stays in its
 * library.
 *
 * Relative imports carry a `.js` extension because the workspace compiles
 * under `nodenext`, where the extension is part of the specifier. It points at
 * the built file, which is what ends up in `dist` beside it.
 */
export * from './chronos/index.js';
export * from './prosopone/index.js';
export * from './telos/index.js';
export * from './topos/index.js';
