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

const BASE = `/organizations/${ORGANIZATION}/projects`;

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

const TASKS = `/organizations/${ORGANIZATION}/tasks`;

const addTask = (body: object) =>
  request(app.getHttpServer()).post(TASKS).send(body);

const finish = (id: string) =>
  request(app.getHttpServer()).patch(`${TASKS}/${id}`).send({ status: 'DONE' });

describe('POST /organizations/:id/projects', () => {
  it('starts one from a title alone', async () => {
    const { status, body } = await post({ title: 'Rebuild the console' });

    expect(status).toBe(201);
    expect(body).toMatchObject({
      title: 'Rebuild the console',
      status: 'PLANNED',
    });
  });

  it('has no tasks to begin with', async () => {
    const { body } = await post({ title: 'Rebuild it' });

    expect(body.tasks).toEqual({ done: 0, total: 0 });
  });
});

describe('how much of a project is done', () => {
  it('counts the tasks filed under it', async () => {
    const { body: project } = await post({ title: 'Rebuild it' });

    await addTask({ title: 'One', projectId: project.id });
    await addTask({ title: 'Two', projectId: project.id });

    const { body } = await request(app.getHttpServer()).get(
      `${BASE}/${project.id}`,
    );

    expect(body.tasks).toEqual({ done: 0, total: 2 });
  });

  it('counts a finished one as done', async () => {
    const { body: project } = await post({ title: 'Rebuild it' });
    const { body: task } = await addTask({
      title: 'One',
      projectId: project.id,
    });
    await addTask({ title: 'Two', projectId: project.id });

    await finish(task.id);

    const { body } = await request(app.getHttpServer()).get(
      `${BASE}/${project.id}`,
    );

    expect(body.tasks).toEqual({ done: 1, total: 2 });
  });

  it('leaves a cancelled task out of the count entirely', async () => {
    /*
     * It is work that turned out not to be needed. Leaving it in the
     * denominator would make a project that dropped half its scope look
     * permanently half-done.
     */
    const { body: project } = await post({ title: 'Rebuild it' });
    const { body: dropped } = await addTask({
      title: 'Not needed',
      projectId: project.id,
    });
    await addTask({ title: 'Still needed', projectId: project.id });

    await request(app.getHttpServer())
      .patch(`${TASKS}/${dropped.id}`)
      .send({ status: 'CANCELLED' });

    const { body } = await request(app.getHttpServer()).get(
      `${BASE}/${project.id}`,
    );

    expect(body.tasks).toEqual({ done: 0, total: 1 });
  });

  it('ignores tasks belonging to another project', async () => {
    const { body: mine } = await post({ title: 'Mine' });
    const { body: theirs } = await post({ title: 'Theirs' });

    await addTask({ title: 'One', projectId: theirs.id });

    const { body } = await request(app.getHttpServer()).get(
      `${BASE}/${mine.id}`,
    );

    expect(body.tasks.total).toBe(0);
  });

  it('ignores a loose task belonging to no project', async () => {
    const { body: project } = await post({ title: 'Rebuild it' });

    await addTask({ title: 'Loose' });

    const { body } = await request(app.getHttpServer()).get(
      `${BASE}/${project.id}`,
    );

    expect(body.tasks.total).toBe(0);
  });

  it('appears in the list as well as on the one', async () => {
    const { body: project } = await post({ title: 'Rebuild it' });
    await addTask({ title: 'One', projectId: project.id });

    const { body: listed } = await request(app.getHttpServer()).get(BASE);

    expect(listed[0].tasks).toEqual({ done: 0, total: 1 });
  });

  it('cannot be claimed by the caller', async () => {
    const { body } = await post({
      title: 'Rebuild it',
      tasks: { done: 9, total: 9 },
    });

    expect(body.tasks).toEqual({ done: 0, total: 0 });
  });
});
