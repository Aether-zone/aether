import {
  ACTOR_KEY,
  EventPublisher,
  OrganizationGuard,
  type Actor,
} from '@aether-zone/organon';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { testDatabaseModule } from '../../test-database';
import { ProsoponeModule } from './prosopone.module';

/**
 * The controller over real HTTP, so the pieces that only exist at the edge get
 * exercised: the zod pipe on the body, `ParseUUIDPipe` on the parameter, and
 * the status codes the service's exceptions turn into.
 *
 * `ProsoponeModule` alone rather than `AppModule` — that would pull in
 * organon's global token guard and every request here would be a 401. What is
 * under test is what the routes do *once* a caller is through it; that they
 * are guarded at all is a property of the application, checked where the
 * module is registered.
 *
 * `EventPublisher` comes from organon's `@Global` RabbitMQ module, which is
 * not in that graph either, so it is provided here as a double. It records
 * rather than connects: what these specs are about is what gets announced, not
 * that RabbitMQ works.
 *
 * `OrganizationGuard` is overridden for the same reason — it narrows a
 * `Principal` the global token guard would have put on the request, and there
 * is no token here. The stand-in leaves the `Actor` where the real one does,
 * so the handlers are exercised exactly as they run.
 */

const ORGANIZATION = '22222222-2222-4222-8222-222222222222';

const TEST_ACTOR = {
  id: 'caller-1',
  clientId: 'aether',
  scopes: [],
  organizations: {},
  organizationId: ORGANIZATION,
  role: 'member',
  organizationName: 'Test',
} as Actor;

const BASE = `/organizations/${ORGANIZATION}/groups`;
let app: INestApplication;

const published: { routingKey: string; event: any }[] = [];

/*
 * Supplied the way organon supplies the real one — a `@Global` module — rather
 * than through `overrideProvider`, which can only replace a provider already
 * in the graph and so adds nothing when the module under test never had one.
 * This also keeps `ProsoponeModule`'s own wiring under test instead of
 * restating it here.
 */
@Global()
@Module({
  providers: [
    {
      provide: EventPublisher,
      useValue: {
        publish: (routingKey: string, event: unknown) => {
          published.push({ routingKey, event });

          return Promise.resolve();
        },
      },
    },
  ],
  exports: [EventPublisher],
})
class TestBrokerModule {}

beforeEach(async () => {
  published.length = 0;

  const module = await Test.createTestingModule({
    imports: [testDatabaseModule(), TestBrokerModule, ProsoponeModule],
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

// `object` rather than `unknown`: supertest's `send` accepts a body it can
// serialise, and the specs below deliberately pass invalid *values* — not
// invalid shapes.
const post = (body: object) =>
  request(app.getHttpServer()).post(BASE).send(body);

describe('POST /organizations/:organizationId/groups', () => {
  it('records one from a name alone', async () => {
    const { status, body } = await post({ name: 'The choir' });

    expect(status).toBe(201);
    expect(body).toMatchObject({ name: 'The choir' });
  });

  it('answers 400 for a name that is only whitespace', async () => {
    expect((await post({ name: '   ' })).status).toBe(400);
  });

  it('answers 400 for a kind outside the six', async () => {
    const { status, body } = await post({ name: 'A group', type: 'CHARITY' });

    expect(status).toBe(400);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ path: 'type' }),
    );
  });

  it('ignores an id the caller tried to choose', async () => {
    const { body } = await post({
      name: 'A group',
      id: '99999999-9999-4999-8999-999999999999',
    });

    expect(body.id).not.toBe('99999999-9999-4999-8999-999999999999');
  });

  it('does not return the tenant in the body', async () => {
    // It is in the URL of every route that can reach the record.
    const { body } = await post({ name: 'A group' });

    expect(body).not.toHaveProperty('organizationId');
  });
});

describe('GET /organizations/:organizationId/groups', () => {
  it('is empty to begin with', async () => {
    const { status, body } = await request(app.getHttpServer()).get(BASE);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns one by id', async () => {
    const { body: created } = await post({ name: 'A group' });

    const { status, body } = await request(app.getHttpServer()).get(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(200);
    expect(body).toEqual(created);
  });

  it('answers 404 for a well-formed id nobody holds', async () => {
    const { status } = await request(app.getHttpServer()).get(
      `${BASE}/11111111-1111-4111-8111-111111111111`,
    );

    expect(status).toBe(404);
  });

  it('answers 400 for an id that could never have been one', async () => {
    // 400 rather than 404: "no such group" would mislead about
    // something that is not an id at all.
    expect((await request(app.getHttpServer()).get(`${BASE}/42`)).status).toBe(
      400,
    );
  });
});

describe('PATCH /organizations/:organizationId/groups/:id', () => {
  it('changes one', async () => {
    const { body: created } = await post({ name: 'A group' });

    const { status, body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ type: 'COMMUNITY' });

    expect(status).toBe(200);
    expect(body.type).toBe('COMMUNITY');
  });

  it('takes the kind back with null', async () => {
    const { body: created } = await post({ name: 'A group', type: 'COMPANY' });

    const { body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ type: null });

    expect(body.type).toBeUndefined();
  });

  it('refuses to remove the name', async () => {
    const { body: created } = await post({ name: 'A group' });

    const { status } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ name: null });

    expect(status).toBe(400);
  });
});

describe('DELETE /organizations/:organizationId/groups/:id', () => {
  it('answers 204 and forgets it', async () => {
    const { body: created } = await post({ name: 'A group' });

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(204);
    expect((await request(app.getHttpServer()).get(BASE)).body).toEqual([]);
  });

  it('answers 404 for one already gone', async () => {
    const { body: created } = await post({ name: 'A group' });
    await request(app.getHttpServer()).delete(`${BASE}/${created.id}`);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(404);
  });
});
