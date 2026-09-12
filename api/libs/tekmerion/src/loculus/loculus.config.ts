export const LOCULUS_CONFIG = 'LOCULUS_CONFIG';

/**
 * What `StoredFile.backend` carries for every file aether stores.
 *
 * The column names the store rather than a bucket. There is only one now, but
 * the value is written anyway: it is what a second store would be told apart
 * by, and what a row written before one existed would lack.
 */
export const LOCULUS_BACKEND = 'loculus';

/** Where loculus is, and how patient aether is with it. */
export interface LoculusConfig {
  /**
   * Origin of the loculus api, without a trailing slash.
   *
   * Reached server to server, so this is an *internal* address — unlike the
   * store endpoint loculus signs into its URLs, which has to be one the
   * browser can resolve.
   */
  baseUrl: string;
  /**
   * How long to wait for loculus, in milliseconds.
   *
   * Signing is arithmetic and a `HeadObject` is one round trip, so a slow
   * answer means loculus or its store is unwell — and a request that hangs
   * holds an aether connection open for a browser that stopped waiting.
   */
  timeoutMs: number;
}
