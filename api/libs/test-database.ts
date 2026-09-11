import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, type EntityTarget, type Repository } from 'typeorm';

/**
 * A real database for a unit test.
 *
 * SQLite in memory, with the schema built from the entities themselves. The
 * alternative — a hand-written fake repository — would test the fake: every
 * one of these services now depends on what the store actually does with a
 * `null`, a `simple-array` and a unique index, and a stub agrees with whatever
 * the person writing it assumed.
 *
 * It costs a few milliseconds per spec and it is thrown away afterwards, so
 * nothing leaks between tests the way a shared file would.
 */
export class TestDatabase {
  private constructor(private readonly source: DataSource) {}

  static async open(
    ...entities: EntityTarget<unknown>[]
  ): Promise<TestDatabase> {
    const source = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: entities as never,
      synchronize: true,
    });

    await source.initialize();

    return new TestDatabase(source);
  }

  repository<T extends object>(entity: EntityTarget<T>): Repository<T> {
    return this.source.getRepository(entity);
  }

  close(): Promise<void> {
    return this.source.destroy();
  }
}

/**
 * A root connection for a spec that boots a whole domain module.
 *
 * Controller specs import `TelosModule` and friends, which ask for their
 * repositories with `TypeOrmModule.forFeature` — and `forFeature` needs a
 * `forRoot` somewhere above it. In the running app that is `DatabaseModule`
 * reading the environment; here it is this, on a fresh in-memory database per
 * spec file.
 *
 * `autoLoadEntities` picks up whatever the module under test registered, so
 * this does not have to be told which entities exist — the same arrangement
 * the real one uses, and for the same reason: a list is a second place to
 * remember.
 */
export const testDatabaseModule = () =>
  TypeOrmModule.forRoot({
    type: 'better-sqlite3',
    database: ':memory:',
    autoLoadEntities: true,
    synchronize: true,
    /*
     * No retries. In the app a database that is briefly unreachable is worth
     * waiting for; in a spec it is a bug, and ten three-second attempts turn a
     * one-line error into a timeout that says nothing about the cause.
     */
    retryAttempts: 0,
  });
