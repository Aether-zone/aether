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
