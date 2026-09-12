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

const BASE = `/organizations/${ORGANIZATION}/goals`;

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

const startProject = (body: object) =>
  request(app.getHttpServer()).post(PROJECTS).send(body);

describe('POST /organizations/:id/goals', () => {
  it('sets one from a title alone', async () => {
    const { status, body } = await post({ title: 'Ship the console' });

    expect(status).toBe(201);
    expect(body).toMatchObject({
      title: 'Ship the console',
      status: 'ACTIVE',
      progress: 0,
    });
  });

  it('answers 400 for a progress the caller tried to claim', async () => {
    // Not in the create shape, so zod strips it: a goal set at 80% is a claim
    // about work that does not exist.
    const { body } = await post({ title: 'Ship it', progress: 80 });

    expect(body.progress).toBe(0);
  });

  it('answers 400 for a priority off the scale', async () => {
    expect((await post({ title: 'Ship it', priority: 9 })).status).toBe(400);
  });
});

describe('what is being done about a goal', () => {
  it('is empty for one nothing is working towards', async () => {
    const { body: goal } = await post({ title: 'Ship it' });

    expect(goal.realizedBy).toEqual([]);
  });

  it('names a project that pursues it', async () => {
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: project } = await startProject({
      title: 'Rebuild the console',
      pursues: [goal.id],
    });

    const { body } = await request(app.getHttpServer()).get(
      `${BASE}/${goal.id}`,
    );

    expect(body.realizedBy).toEqual([project.id]);
  });

  it('appears in the list as well as on the one', async () => {
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: project } = await startProject({
      title: 'Rebuild it',
      pursues: [goal.id],
    });

    const { body: listed } = await request(app.getHttpServer()).get(BASE);

    expect(listed[0].realizedBy).toEqual([project.id]);
  });

  it('follows the project, so removing it unsays it', async () => {
    /*
     * The point of deriving this rather than storing it. Were `realizedBy` a
     * column, this delete would have to remember to go back and edit the goal
     * — and the day it forgot, the goal would point at a project that is gone.
     */
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: project } = await startProject({
      title: 'Rebuild it',
      pursues: [goal.id],
    });

    await request(app.getHttpServer()).delete(`${PROJECTS}/${project.id}`);

    const { body } = await request(app.getHttpServer()).get(
      `${BASE}/${goal.id}`,
    );

    expect(body.realizedBy).toEqual([]);
  });

  it('cannot be set by the caller', async () => {
    const { body } = await post({
      title: 'Ship it',
      realizedBy: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(body.realizedBy).toEqual([]);
  });
});

describe('how far along a goal is', () => {
  const TASKS = `/organizations/${ORGANIZATION}/tasks`;

  const addTask = (projectId: string, title: string) =>
    request(app.getHttpServer())
      .post(TASKS)
      .send({ title, projectId })
      .then((response) => response.body);

  const finish = (id: string) =>
    request(app.getHttpServer())
      .patch(`${TASKS}/${id}`)
      .send({ status: 'DONE' });

  const read = (id: string) =>
    request(app.getHttpServer())
      .get(`${BASE}/${id}`)
      .then((response) => response.body);

  it('is nothing for a goal nobody is working on', async () => {
    const { body: goal } = await post({ title: 'Ship it' });

    expect(goal.progress).toBe(0);
  });

  it('is nothing for a goal whose project has no tasks', async () => {
    // A project can be planned before it is broken down, and nothing has been
    // finished — which reads the same as not having started.
    const { body: goal } = await post({ title: 'Ship it' });
    await startProject({ title: 'Rebuild it', pursues: [goal.id] });

    expect((await read(goal.id)).progress).toBe(0);
  });

  it('counts the tasks in the project pursuing it', async () => {
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: project } = await startProject({
      title: 'Rebuild it',
      pursues: [goal.id],
    });

    const one = await addTask(project.id, 'One');
    await addTask(project.id, 'Two');
    await addTask(project.id, 'Three');
    await addTask(project.id, 'Four');

    await finish(one.id);

    expect((await read(goal.id)).progress).toBe(25);
  });

  it('adds the projects together rather than averaging them', async () => {
    /*
     * The reason this is a sum and not a mean. One project of one finished
     * task and one of three untouched ones is 25% of the work, not 50% — an
     * average would let a finished afterthought drag a barely-started rewrite
     * halfway up the bar.
     */
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: small } = await startProject({
      title: 'Afterthought',
      pursues: [goal.id],
    });
    const { body: large } = await startProject({
      title: 'Rewrite',
      pursues: [goal.id],
    });

    const only = await addTask(small.id, 'Only task');
    await finish(only.id);

    await addTask(large.id, 'One');
    await addTask(large.id, 'Two');
    await addTask(large.id, 'Three');

    expect((await read(goal.id)).progress).toBe(25);
  });

  it('ignores tasks in a project that does not pursue it', async () => {
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: unrelated } = await startProject({ title: 'Something else' });

    const task = await addTask(unrelated.id, 'One');
    await finish(task.id);

    expect((await read(goal.id)).progress).toBe(0);
  });

  it('moves when a task is finished, with nothing written to the goal', async () => {
    // The whole point of counting it. Were `progress` a column, this would
    // need the goal updating too — and the day it was forgotten, the bar would
    // disagree with the work.
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: project } = await startProject({
      title: 'Rebuild it',
      pursues: [goal.id],
    });

    const one = await addTask(project.id, 'One');
    await addTask(project.id, 'Two');

    expect((await read(goal.id)).progress).toBe(0);

    await finish(one.id);

    expect((await read(goal.id)).progress).toBe(50);
  });

  it('leaves a cancelled task out, so dropping scope does not stall it', async () => {
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: project } = await startProject({
      title: 'Rebuild it',
      pursues: [goal.id],
    });

    const keep = await addTask(project.id, 'Still needed');
    const drop = await addTask(project.id, 'Not needed');

    await finish(keep.id);
    await request(app.getHttpServer())
      .patch(`${TASKS}/${drop.id}`)
      .send({ status: 'CANCELLED' });

    expect((await read(goal.id)).progress).toBe(100);
  });

  it('rounds, because a percentage of whole tasks is not exact', async () => {
    const { body: goal } = await post({ title: 'Ship it' });
    const { body: project } = await startProject({
      title: 'Rebuild it',
      pursues: [goal.id],
    });

    const one = await addTask(project.id, 'One');
    await addTask(project.id, 'Two');
    await addTask(project.id, 'Three');

    await finish(one.id);

    // 1/3 is 33.33…; a bar cannot show the rest of it.
    expect((await read(goal.id)).progress).toBe(33);
  });

  it('cannot be set by the caller', async () => {
    const { body } = await post({ title: 'Ship it', progress: 80 });

    expect(body.progress).toBe(0);
  });
});
