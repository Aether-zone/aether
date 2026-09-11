# @aether/api

aether's NestJS server.

```sh
pnpm install
cp .env.example .env
pnpm --filter @aether/api start:dev   # or ../dev.sh style: pnpm start:server
```

| | |
| --- | --- |
| api | <http://localhost:3040> |
| console | <http://localhost:3042> |

## Layout

One library per domain, under `libs/`:

| | | |
| --- | --- | --- |
| `@aether/telos` | purpose | Idea, Goal, Project, Task |
| `@aether/prosopone` | people | Person, Relationship |
| `@aether/chronos` | time | Calendar, Event, Schedule |
| `@aether/oikonomos` | what is owned and paid for | Asset, Subscription, Contract, Expense |
| `@aether/topos` | place | Place, Address, Location |
| `@aether/tekmerion` | evidence | Resource |

One library that is not a domain:

| | |
| --- | --- |
| `@aether/events` | putting a resource change on the exchange |

**Libraries rather than folders**, because a dependency between two domains
then has to be written as an import of a published entry point. `@aether/telos`
can reach `@aether/prosopone` only through its barrel; reaching into its
internals does not typecheck. Six directories under `src/` would have made the
same coupling invisible.

`telos`, `topos`, `prosopone`, `chronos` and `tekmerion` have controllers and
services; `oikonomos` is still the seam and the list of resources it owns.
Every service holds its records in memory — a placeholder for a repository,
not a cache in front of one.

`@aether/events` exists because a second domain needed the same forty lines.
`telos` and `tekmerion` announce through it; `prosopone`, `topos` and `chronos`
still each keep a private copy, and should move to it when someone next has
reason to touch them.

`mneme` and `arachni` appear in the console's sidebar but have **no library
here**: they are separate services with their own repositories, so what aether
needs of them is a client, not a domain.

### Adding one

```sh
pnpm exec nest generate library <name>   # prefix: @aether
```

Then check four things the generator gets wrong for this repo: it re-adds
`"webpack": true` to `nest-cli.json`, it writes `paths` into `tsconfig.json`
(which compiles nothing — they belong in `tsconfig.app.json`, which the build
extends), it does not touch `moduleNameMapper` in `jest.config.cts`, which has
to stay in step or specs cannot resolve the alias, and it misses `paths` in
`tsconfig.spec.json`, which keeps its own copy.

Those last two fail in different ways and neither implies the other: jest reads
`moduleNameMapper` and not `paths`, tsc reads `paths` and not
`moduleNameMapper`. A library wired in one but not the other has passing tests
that do not typecheck, or the reverse. `src/domains.spec.ts` catches it for a
domain library; a library that is not a domain needs a spec of its own that
imports through the alias, which is what `libs/events/src/announce.spec.ts`
does.

Paths must be written `./libs/<name>/src` — a bare `libs/…` is TS5090, since
`baseUrl` is not set.

## The database

SQLite, through TypeORM. `DatabaseModule` opens the one connection with
`forRoot`; each domain library asks for the repositories of its own entities
with `TypeOrmModule.forFeature`. That split is what stops a domain reaching
outside itself — `@aether/telos` cannot obtain a `Repository<UserEntity>` at
all, where a single module registering every entity would have handed each
domain the whole schema.

Entities are found by `autoLoadEntities`, so adding one means writing the file
and adding it to that library's `forFeature`. There is no central list to
forget.

`DATABASE_SYNCHRONIZE` defaults on outside production, which is what makes a
fresh checkout runnable. **It is not a migration strategy**: it drops columns
whose entity fields disappear, and their data with them. When aether has data
anyone would miss, this goes off and migrations go in.

Two things that bite when adding an entity:

- A column whose TypeScript type is a **union of string literals** needs an
  explicit `type: 'text'`. `emitDecoratorMetadata` emits `Object` for any
  union, so TypeORM has nothing to infer from and refuses to build the schema
  — the error is a connection failure, which says nothing about the cause.
- `simple-array` is a comma-joined string. Safe for uuids, which cannot
  contain a comma; anything holding free text needs `simple-json`.

Specs get a real database rather than a fake repository: `libs/test-database.ts`
opens SQLite in memory from the entities themselves. A stub would agree with
whatever its author assumed, and these services depend on what the store
actually does with a `null`, a `simple-array` and a unique index.

## What is wired

The part every service in the workspace shares, taken from
`@aether-zone/organon` rather than restated:

- **Environment validation** (`src/env.ts`), which fails the boot on anything
  missing or malformed instead of letting it surface as `undefined` deep
  inside a request.
- **A request id and a line per request**, with the health probes excluded so
  an orchestrator polling every few seconds is not most of the log.
- **`/health`, `/health/live`, `/health/ready`.**
- **RFC 9457 problem documents** for every failure, carrying the request id —
  a 500 tells the client nothing else, so that id is the only way from a report
  of a failure to the trace explaining it.
- **pistis token verification.** aether is a resource server: it checks tokens
  against pistis's published keys and issues none. organon registers the guard
  as an `APP_GUARD`, so the default is closed and a new controller is
  authenticated because nobody did anything.

## Commands

```sh
pnpm build        # nest build → dist/main.js
pnpm start        # nest start
pnpm start:dev    # nest start --watch
pnpm test         # jest
pnpm typecheck    # tsc --build, declarations only
pnpm lint
```

## Two build configs, on purpose

`tsconfig.app.json` inherits the workspace base, which is written for the
**typecheck** pass: `composite` with `emitDeclarationOnly`, so `tsc --build`
produces declarations and project-reference metadata and no JavaScript at all.

`tsconfig.build.json` is the other half — the one pass that emits something
runnable — and turns those off. Without it `pnpm build` produced no `dist` and
failed; that is what it was doing before this existed.
