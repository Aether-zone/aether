import {
  ACTOR_KEY,
  ENV,
  EventPublisher,
  OrganizationGuard,
  type Actor,
} from '@aether-zone/organon';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { testDatabaseModule } from '../../test-database';
import { TekmerionModule } from './tekmerion.module';

/**
 * The controller over real HTTP, so the pieces that only exist at the edge get
 * exercised: the zod pipe on the body, `ParseUUIDPipe` on the parameter, and
 * the status codes the service's exceptions turn into.
 *
 * `OrganizationGuard` is overridden — it narrows a `Principal` the global
 * token guard would have put on the request, and there is no token here. The
 * stand-in leaves the `Actor` where the real one does.
 *
 * `EventPublisher` comes from organon's `@Global` RabbitMQ module, which is
 * not in this graph either, so it is supplied the same way — a global module
 * rather than `overrideProvider`, which can only replace a provider the graph
 * already has.
 */

@Global()
@Module({
  providers: [
    { provide: EventPublisher, useValue: { publish: () => Promise.resolve() } },
    /*
     * `ENV` comes from organon's config module in the running app, and
     * `TekmerionModule` now reads loculus's address out of it. The value is
     * never reached here: nothing in these specs uploads, and a `LoculusClient`
     * that is never called does not care what its base URL is.
     */
    {
      provide: ENV,
      useValue: {
        LOCULUS_URL: 'http://loculus.test',
        LOCULUS_TIMEOUT_MS: 1000,
      },
    },
  ],
  exports: [EventPublisher, ENV],
})
class TestBrokerModule {}

const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const CALLER = '33333333-3333-4333-8333-333333333333';

const TEST_ACTOR = {
  id: CALLER,
  clientId: 'aether',
  scopes: [],
  organizations: {},
  organizationId: ORGANIZATION,
  role: 'member',
  organizationName: 'Test',
} as Actor;

const BASE = `/organizations/${ORGANIZATION}/resources`;

let app: INestApplication;

beforeEach(async () => {
  const module = await Test.createTestingModule({
    imports: [testDatabaseModule(), TestBrokerModule, TekmerionModule],
  })
    .overrideGuard(OrganizationGuard)
    .useValue({
      canActivate: (context: any) => {
        context.switchToHttp().getRequest()[ACTOR_KEY] = TEST_ACTOR;

        return true;
      },
    })
    .compile();

  app = module.createNestApplication();
  await app.init();
});

afterEach(async () => {
  await app.close();
});

const post = (body: object) =>
  request(app.getHttpServer()).post(BASE).send(body);

const get = (query = '') => request(app.getHttpServer()).get(`${BASE}${query}`);

describe('POST /organizations/:id/resources', () => {
  it('files one from a kind alone', async () => {
    const { status, body } = await post({ type: 'NOTE' });

    expect(status).toBe(201);
    expect(body).toMatchObject({ type: 'NOTE' });
    expect(body.id).toBeDefined();
  });

  it('answers 400 without a kind', async () => {
    // Something whose kind is unknown cannot be rendered, indexed or routed.
    const { status, body } = await post({ title: 'A thing' });

    expect(status).toBe(400);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ path: 'type' }),
    );
  });

  it('answers 400 for a kind outside the list', async () => {
    expect((await post({ type: 'SPREADSHEET' })).status).toBe(400);
  });

  it('answers 400 for a url that is not one', async () => {
    const { status } = await post({ type: 'WEB_PAGE', url: 'not a url' });

    expect(status).toBe(400);
  });

  it('answers 400 for a source that will not say what it is', async () => {
    const { status } = await post({
      type: 'EMAIL',
      source: { name: 'Somewhere' },
    });

    expect(status).toBe(400);
  });

  it('takes a source it has never heard of', async () => {
    // The set of systems is open on purpose: a closed list would need a
    // release of the contract before anything new could be filed.
    const { status, body } = await post({
      type: 'DOCUMENT',
      source: { type: 'a-system-nobody-has-heard-of', name: 'Mystery' },
    });

    expect(status).toBe(201);
    expect(body.source.type).toBe('a-system-nobody-has-heard-of');
  });

  it('ignores an id and timestamps the caller tried to choose', async () => {
    const { body } = await post({
      type: 'NOTE',
      id: '99999999-9999-4999-8999-999999999999',
      createdAt: '2000-01-01T00:00:00.000Z',
    });

    expect(body.id).not.toBe('99999999-9999-4999-8999-999999999999');
    expect(body.createdAt).not.toBe('2000-01-01T00:00:00.000Z');
  });

  it('keeps content exactly as sent', async () => {
    const indented = '    const x = 1;\n';
    const { body } = await post({ type: 'FILE', content: indented });

    expect(body.content).toBe(indented);
  });
});

describe('GET /organizations/:id/resources', () => {
  it('is empty to begin with', async () => {
    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns one by id', async () => {
    const { body: filed } = await post({ type: 'NOTE' });

    const { status, body } = await request(app.getHttpServer()).get(
      `${BASE}/${filed.id}`,
    );

    expect(status).toBe(200);
    expect(body).toEqual(filed);
  });

  it('answers 404 for a well-formed id nobody holds', async () => {
    const { status } = await request(app.getHttpServer()).get(
      `${BASE}/11111111-1111-4111-8111-111111111111`,
    );

    expect(status).toBe(404);
  });

  it('answers 400 for an id that could never have been one', async () => {
    expect((await request(app.getHttpServer()).get(`${BASE}/42`)).status).toBe(
      400,
    );
  });
});

describe('looking one up by what a system calls it', () => {
  const filed = () =>
    post({
      type: 'EMAIL',
      source: { type: 'gmail', id: 'work@example.test' },
      externalId: 'msg-4471',
    });

  it('answers with the one match', async () => {
    const { body: created } = await filed();

    const { status, body } = await get('?source=gmail&externalId=msg-4471');

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(created.id);
  });

  it('answers with an empty list rather than a 404', async () => {
    /*
     * A caller checking before it files something should not have to treat
     * "not seen before" as an error — that is the ordinary case, and the
     * whole reason to ask.
     */
    await filed();

    const { status, body } = await get('?source=gmail&externalId=msg-9999');

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('does not match the same id from another system', async () => {
    await filed();

    expect((await get('?source=notion&externalId=msg-4471')).body).toEqual([]);
  });

  it('answers 400 when given only half the pair', async () => {
    // Either alone is a question with no answer, and returning the whole list
    // would look like a match.
    expect((await get('?source=gmail')).status).toBe(400);
    expect((await get('?externalId=msg-4471')).status).toBe(400);
  });
});

describe('PATCH /organizations/:id/resources/:id', () => {
  it('changes one', async () => {
    const { body: filed } = await post({ type: 'NOTE' });

    const { status, body } = await request(app.getHttpServer())
      .patch(`${BASE}/${filed.id}`)
      .send({ title: 'Named at last' });

    expect(status).toBe(200);
    expect(body.title).toBe('Named at last');
  });

  it('takes a value back with null', async () => {
    const { body: filed } = await post({ type: 'NOTE', title: 'Wrong' });

    const { body } = await request(app.getHttpServer())
      .patch(`${BASE}/${filed.id}`)
      .send({ title: null });

    expect(body.title).toBeUndefined();
  });

  it('refuses to remove the kind', async () => {
    const { body: filed } = await post({ type: 'NOTE' });

    const { status } = await request(app.getHttpServer())
      .patch(`${BASE}/${filed.id}`)
      .send({ type: null });

    expect(status).toBe(400);
  });
});

describe('DELETE /organizations/:id/resources/:id', () => {
  it('answers 204 and forgets it', async () => {
    const { body: filed } = await post({ type: 'NOTE' });

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${filed.id}`,
    );

    expect(status).toBe(204);
    expect((await get()).body).toEqual([]);
  });

  it('answers 404 for one already gone', async () => {
    const { body: filed } = await post({ type: 'NOTE' });
    await request(app.getHttpServer()).delete(`${BASE}/${filed.id}`);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${filed.id}`,
    );

    expect(status).toBe(404);
  });
});

describe('files', () => {
  it('answers 400 for a file id that could never have been one', async () => {
    expect(
      (await request(app.getHttpServer()).get(`${BASE}/files/42`)).status,
    ).toBe(400);
  });

  it('answers 404 for a well-formed id nobody holds', async () => {
    const { status } = await request(app.getHttpServer()).get(
      `${BASE}/files/11111111-1111-4111-8111-111111111111`,
    );

    expect(status).toBe(404);
  });

  it('does not collide with the route that reads a resource by id', async () => {
    /*
     * `files/:fileId` and `:id` are both one segment after the base, and Nest
     * matches in declaration order. If they were the other way round, "files"
     * would be parsed as a resource id and every file request would answer 400
     * from `ParseUUIDPipe` — a failure that reads as a bad id rather than as a
     * routing mistake.
     */
    const { body: filed } = await post({ type: 'NOTE', title: 'A note' });

    const { status, body } = await request(app.getHttpServer()).get(
      `${BASE}/${filed.id}`,
    );

    expect(status).toBe(200);
    expect(body.id).toBe(filed.id);
  });
});
