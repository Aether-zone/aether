import { baseEnvSchema } from '@aether-zone/organon';
import { z } from 'zod';

/**
 * What aether needs, on top of the `NODE_ENV`, `PORT` and `LOG_LEVEL` every
 * service in the workspace has.
 *
 * Nothing here is about *issuing* credentials. This file replaced one copied
 * from pistis that described a signing key, token lifetimes and a development
 * seed — aether is a resource server, so it verifies pistis's tokens and mints
 * none of its own. A signing key it never uses would be a secret to leak for
 * nothing.
 */
export const envSchema = baseEnvSchema.extend({
  /** organon's base defaults this to 3000; the workspace gives aether 3040. */
  PORT: z.coerce.number().int().positive().default(3040),

  /** Public origin of pistis. Must equal the `iss` claim of its tokens exactly. */
  OAUTH_ISSUER: z.url().default('http://localhost:3001'),
  /**
   * `aud` every accepted token must carry. pistis defaults its audience to its
   * own issuer, so this defaults to OAUTH_ISSUER rather than to a literal.
   */
  OAUTH_AUDIENCE: z.string().min(1).optional(),
  /**
   * Where pistis publishes its public signing keys. Derived from the issuer
   * per RFC 8414 when unset, which is what a normal deployment wants.
   */
  OAUTH_JWKS_URI: z.url().optional(),

  /*
   * RabbitMQ.
   *
   * **The broker is shared, not per-service.** Every aether-zone service
   * publishes to one exchange, which is the only arrangement in which an event
   * from here reaches arachni or mneme. A broker of aether's own would route
   * its events to nobody. The default matches the workspace compose file,
   * credentials included, because a default that cannot reach the workspace's
   * own broker is not a useful default.
   */
  RABBITMQ_URI: z
    .string()
    .min(1)
    .default('amqp://aether-zone:Ch4nG3M3!@localhost:5682'),
  /** The shared topic exchange. Must match every other service's. */
  RABBITMQ_EXCHANGE: z.string().min(1).default('aether-zone'),
  /**
   * Wait this long for the broker before finishing the boot, in milliseconds.
   *
   * `0` starts anyway and connects in the background, which is what a
   * development machine without a broker wants: aether only *publishes*, so it
   * still serves every request that does not announce something — and a person
   * still gets created when the broker is down, with the failure logged.
   */
  RABBITMQ_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(0).default(0),

  /*
   * The database.
   *
   * SQLite, in a file beside the process. It is a real store rather than the
   * arrays these services used to hold — records survive a restart and two
   * requests see the same data — and it is the right size for a workspace
   * where every service runs on one machine. The day aether needs more than
   * one instance, this is the line that changes.
   */
  DATABASE_PATH: z.string().min(1).default('./aether.sqlite'),

  /**
   * Let TypeORM create and alter tables to match the entities.
   *
   * On by default outside production, which is what makes a checkout runnable
   * without a migration step. **It is not a migration strategy**: it drops
   * columns whose entity fields disappear, taking their data with them. When
   * aether has data anyone would miss, this goes off and migrations go in.
   */
  DATABASE_SYNCHRONIZE: z.coerce.boolean().optional(),

  /*
   * loculus, the object store service.
   *
   * Reached server to server, so this is an internal address — unlike the
   * store endpoint loculus signs into the URLs it hands out, which has to be
   * one the browser can resolve. aether never sees a bucket credential: it
   * asks loculus where a file may go and relays the caller's own token, so it
   * can obtain nothing the person could not have obtained themselves.
   */
  LOCULUS_URL: z.url().default('http://localhost:3111'),
  /**
   * How long to wait for loculus, in milliseconds.
   *
   * Signing is arithmetic, so a slow answer means loculus or its store is
   * unwell — and a request that hangs holds an aether connection open for a
   * browser that has already stopped waiting.
   */
  LOCULUS_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
});

export type Env = z.infer<typeof envSchema>;
