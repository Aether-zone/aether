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
import { TelosModule } from './telos.module';

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
  ],
  exports: [EventPublisher],
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

const BASE = `/organizations/${ORGANIZATION}/ideas`;

let app: INestApplication;

beforeEach(async () => {
  const module = await Test.createTestingModule({
    imports: [testDatabaseModule(), TestBrokerModule, TelosModule],
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

describe('POST /organizations/:id/ideas', () => {
  it('captures one from a title alone', async () => {
    const { status, body } = await post({ title: 'A thought' });

    expect(status).toBe(201);
    expect(body).toMatchObject({ title: 'A thought', status: 'CAPTURED' });
  });

  it('records the caller as the author, whatever the body says', async () => {
    /*
     * The field is not in the create shape, so zod strips it before the
     * handler sees it — which is what stops anyone filing an idea under
     * someone else's name.
     */
    const { body } = await post({
      title: 'A thought',
      createdBy: '44444444-4444-4444-8444-444444444444',
    });

    expect(body.createdBy).toBe(CALLER);
  });

  it('ignores a status the caller tried to choose', async () => {
    const { body } = await post({ title: 'A thought', status: 'PROMOTED' });

    expect(body.status).toBe('CAPTURED');
  });

  it('answers 400 for a priority off the scale', async () => {
    const { status, body } = await post({ title: 'A thought', priority: 9 });

    expect(status).toBe(400);
    expect(body.errors).toContainEqual(
      expect.objectContaining({
        path: 'priority',
        message: expect.stringMatching(/1 to 5/),
      }),
    );
  });

  it('answers 400 for a title that is only whitespace', async () => {
    expect((await post({ title: '   ' })).status).toBe(400);
  });
});

describe('GET /organizations/:id/ideas', () => {
  it('is empty to begin with', async () => {
    const { status, body } = await request(app.getHttpServer()).get(BASE);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns one by id', async () => {
    const { body: created } = await post({ title: 'A thought' });

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
    // 400 rather than 404: "no such idea" would mislead about something that
    // is not an id at all.
    expect((await request(app.getHttpServer()).get(`${BASE}/42`)).status).toBe(
      400,
    );
  });
});

describe('PATCH /organizations/:id/ideas/:id', () => {
  it('promotes one', async () => {
    const { body: created } = await post({ title: 'A thought' });

    const { status, body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ status: 'PROMOTED' });

    expect(status).toBe(200);
    expect(body.status).toBe('PROMOTED');
  });

  it('validates what it is given', async () => {
    const { body: created } = await post({ title: 'A thought' });

    const { status } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ status: 'DONE' });

    expect(status).toBe(400);
  });
});

describe('DELETE /organizations/:id/ideas/:id', () => {
  it('answers 204 and forgets it', async () => {
    const { body: created } = await post({ title: 'A thought' });

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(204);
    expect((await request(app.getHttpServer()).get(BASE)).body).toEqual([]);
  });

  it('answers 404 for one already gone', async () => {
    const { body: created } = await post({ title: 'A thought' });
    await request(app.getHttpServer()).delete(`${BASE}/${created.id}`);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(404);
  });
});

describe('what an idea led to', () => {
  const GOALS = `/organizations/${ORGANIZATION}/goals`;

  const setGoal = (body: object) =>
    request(app.getHttpServer()).post(GOALS).send(body);

  const get = (id: string) => request(app.getHttpServer()).get(`${BASE}/${id}`);

  it('is empty for one nothing came of', async () => {
    const { body: idea } = await post({ title: 'A thought' });

    expect(idea.inspired).toEqual([]);
    expect((await get(idea.id)).body.inspired).toEqual([]);
  });

  it('names a goal that was inspired by it', async () => {
    const { body: idea } = await post({ title: 'A thought' });
    const { body: goal } = await setGoal({
      title: 'Ship it',
      inspiredBy: [idea.id],
    });

    expect((await get(idea.id)).body.inspired).toEqual([goal.id]);
  });

  it('appears in the list as well as on the one', async () => {
    // The list is what the console reads first, and a link that only showed up
    // after you clicked through would look like it had just been created.
    const { body: idea } = await post({ title: 'A thought' });
    const { body: goal } = await setGoal({
      title: 'Ship it',
      inspiredBy: [idea.id],
    });

    const { body: listed } = await request(app.getHttpServer()).get(BASE);

    expect(listed[0].inspired).toEqual([goal.id]);
  });

  it('follows the goal, so removing the goal unsays it', async () => {
    /*
     * The point of deriving this rather than storing it. Were `inspired` a
     * column, this delete would have to remember to go back and edit the idea
     * — and the day it forgot, the idea would point at a goal that is gone.
     */
    const { body: idea } = await post({ title: 'A thought' });
    const { body: goal } = await setGoal({
      title: 'Ship it',
      inspiredBy: [idea.id],
    });

    await request(app.getHttpServer()).delete(`${GOALS}/${goal.id}`);

    expect((await get(idea.id)).body.inspired).toEqual([]);
  });

  it('answers 404 when a goal names an idea that does not exist', async () => {
    const { status } = await setGoal({
      title: 'Ship it',
      inspiredBy: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(status).toBe(404);
  });
});
