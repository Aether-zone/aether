import { ENV } from '@aether-zone/organon';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { Env } from './env';

/**
 * The one connection every domain library shares.
 *
 * `forRoot` here and `forFeature` in each library, which is the split that
 * keeps a domain from reaching outside itself: `@aether/telos` asks for the
 * repositories of the four entities it owns and cannot obtain a `Repository<Person>`
 * at all. A single module registering every entity would have handed each
 * domain the whole schema and left "who may write to this table" as a matter
 * of manners.
 *
 * `autoLoadEntities` rather than a list: every entity a library registers with
 * `forFeature` is picked up automatically. A central list would be a second
 * place to remember, and the failure when someone forgets is a table that
 * silently does not exist.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        type: 'better-sqlite3' as const,
        database: env.DATABASE_PATH,
        autoLoadEntities: true,
        /*
         * Default on outside production, so a fresh checkout runs. See the
         * warning on `DATABASE_SYNCHRONIZE`: this is not a migration strategy.
         */
        synchronize: env.DATABASE_SYNCHRONIZE ?? env.NODE_ENV !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
