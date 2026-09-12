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

const BASE = `/organizations/${ORGANIZATION}/tasks`;

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

const PROJECTS = `/organizations/${ORGANIZATION}/projects`;

const startProject = (title: string) =>
  request(app.getHttpServer()).post(PROJECTS).send({ title });

describe('POST /organizations/:id/tasks', () => {
  it('writes one down from a title alone', async () => {
    const { status, body } = await post({ title: 'Do the thing' });

    expect(status).toBe(201);
    expect(body).toMatchObject({ title: 'Do the thing', status: 'TODO' });
  });

  it('ignores a status the caller tried to choose', async () => {
    // Not in the create shape, so zod strips it before the handler sees it.
    const { body } = await post({ title: 'Do the thing', status: 'DONE' });

    expect(body.status).toBe('TODO');
  });

  it('ignores a closing time the caller tried to set', async () => {
    const { body } = await post({
      title: 'Do the thing',
      closedAt: '2020-01-01T09:00:00.000Z',
    });

    expect(body.closedAt).toBeUndefined();
  });

  it('answers 400 for a priority off the scale', async () => {
    const { status, body } = await post({ title: 'Do the thing', priority: 9 });

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

  it('answers 400 for a project reference that is not an id', async () => {
    const { status } = await post({
      title: 'Do the thing',
      projectId: 'the console rebuild',
    });

    expect(status).toBe(400);
  });

  it('answers 404 for a project nobody holds', async () => {
    /*
     * 404 and not 400: the id is well formed and the shape is right, so this
     * is a statement about something that does not exist rather than a
     * malformed request.
     */
    const { status } = await post({
      title: 'Do the thing',
      projectId: '11111111-1111-4111-8111-111111111111',
    });

    expect(status).toBe(404);
  });

  it('files it under a project that does exist', async () => {
    const { body: project } = await startProject('Rebuild the console');

    const { status, body } = await post({
      title: 'Do the thing',
      projectId: project.id,
    });

    expect(status).toBe(201);
    expect(body.projectId).toBe(project.id);
  });
});

describe('GET /organizations/:id/tasks', () => {
  it('is empty to begin with', async () => {
    const { status, body } = await request(app.getHttpServer()).get(BASE);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns one by id', async () => {
    const { body: created } = await post({ title: 'Do the thing' });

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
    // 400 rather than 404: "no such task" would mislead about something that
    // is not an id at all.
    expect((await request(app.getHttpServer()).get(`${BASE}/42`)).status).toBe(
      400,
    );
  });
});

describe('PATCH /organizations/:id/tasks/:id', () => {
  it('moves one along', async () => {
    const { body: created } = await post({ title: 'Do the thing' });

    const { status, body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ status: 'IN_PROGRESS' });

    expect(status).toBe(200);
    expect(body.status).toBe('IN_PROGRESS');
  });

  it('closes one, and says when', async () => {
    const { body: created } = await post({ title: 'Do the thing' });

    const { body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ status: 'DONE' });

    expect(body.closedAt).toBeDefined();
  });

  it('validates what it is given', async () => {
    const { body: created } = await post({ title: 'Do the thing' });

    const { status } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ status: 'FINISHED' });

    expect(status).toBe(400);
  });

  it('takes a value back with null', async () => {
    const { body: created } = await post({
      title: 'Do the thing',
      priority: 2,
    });

    const { body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ priority: null });

    expect(body.priority).toBeUndefined();
  });
});

describe('DELETE /organizations/:id/tasks/:id', () => {
  it('answers 204 and forgets it', async () => {
    const { body: created } = await post({ title: 'Do the thing' });

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(204);
    expect((await request(app.getHttpServer()).get(BASE)).body).toEqual([]);
  });

  it('answers 404 for one already gone', async () => {
    const { body: created } = await post({ title: 'Do the thing' });
    await request(app.getHttpServer()).delete(`${BASE}/${created.id}`);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(404);
  });
});
