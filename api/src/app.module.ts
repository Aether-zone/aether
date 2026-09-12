import {
  ENV,
  jwksUriFor,
  OrganonModule,
  PistisAuthModule,
  RabbitMqModule,
} from '@aether-zone/organon';
import { Module } from '@nestjs/common';

import { ChronosModule } from '@aether/chronos';
import { OikonomosModule } from '@aether/oikonomos';
import { ProsoponeModule } from '@aether/prosopone';
import { TekmerionModule } from '@aether/tekmerion';
import { TelosModule } from '@aether/telos';
import { ToposModule } from '@aether/topos';

import { DatabaseModule } from './database.module';
import { envSchema, type Env } from './env';

/**
 * aether's api.
 *
 * Everything the workspace's services share — environment validation, the
 * request log, the health probes, RFC 9457 error rendering — comes from
 * organon rather than being restated here.
 *
 * The rest is one library per domain, under `libs/`. They are separate
 * libraries rather than folders so that a dependency between two of them has
 * to be written down as an import of a published entry point: `@aether/telos`
 * can reach `@aether/prosopone` only through its barrel, and reaching into its
 * internals does not typecheck. Six directories under `src/` would have made
 * that same coupling invisible.
 *
 * Each library owns its own tables. `DatabaseModule` opens the one connection
 * and every domain asks for what it needs through `TypeOrmModule.forFeature`,
 * so a domain cannot obtain a repository for a table it does not own.
 */
@Module({
  imports: [
    OrganonModule.forRoot({
      config: { schema: envSchema },
      logging: { base: { service: 'aether' } },
    }),

    /*
     * Identity comes from pistis. This registers aether as a resource server
     * for it — tokens are verified against pistis's published keys, and
     * nothing here issues, stores or refreshes a credential.
     *
     * Registered before there is anything to guard on purpose: an api that
     * grows its first endpoint with authentication already wired cannot ship
     * that endpoint unprotected by omission. organon's guard is an `APP_GUARD`,
     * so the default is closed and a new controller is authenticated because
     * nobody did anything.
     */
    PistisAuthModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        issuer: env.OAUTH_ISSUER,
        audience: env.OAUTH_AUDIENCE ?? env.OAUTH_ISSUER,
        jwksUri: env.OAUTH_JWKS_URI ?? jwksUriFor(env.OAUTH_ISSUER),
      }),
    }),

    /*
     * The shared exchange. aether announces what happens to its own resources
     * — a person created in prosopone — so that arachni can graph it and mneme
     * can index it without either being told about this api.
     *
     * `connectTimeoutMs: false` starts the app even with no broker reachable
     * and connects in the background. The api still serves every request
     * without one, and a failed publish is logged where it happens.
     *
     * It is no longer free, though: aether consumes as well as publishes now —
     * `ObjectUploadedListener` is how a file row learns its bytes arrived — so a
     * broker that stays down leaves uploads sitting `INITIAL` until the browser
     * confirms one or somebody looks. Starting anyway is still the right trade,
     * because refusing to boot would take the whole api down for it.
     */
    RabbitMqModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        uri: env.RABBITMQ_URI,
        exchange: env.RABBITMQ_EXCHANGE,
        connectTimeoutMs:
          env.RABBITMQ_CONNECT_TIMEOUT_MS === 0
            ? false
            : env.RABBITMQ_CONNECT_TIMEOUT_MS,
      }),
    }),

    /*
     * The domains. Imported here even while empty, so that the wiring is what
     * gets reviewed once rather than six times, and so a module that starts
     * providing something is reachable the moment it does.
     */
    DatabaseModule,
    ChronosModule,
    OikonomosModule,
    ProsoponeModule,
    TekmerionModule,
    TelosModule,
    ToposModule,
  ],
})
export class AppModule {}
