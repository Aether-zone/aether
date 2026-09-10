import {
  ACTOR_KEY,
  EventPublisher,
  OrganizationGuard,
  type Actor,
} from '@aether-zone/organon';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ToposModule } from './topos.module';

/**
 * The controller over real HTTP, so the pieces that only exist at the edge get
 * exercised: the zod pipe on the body, `ParseUUIDPipe` on the parameter, and
 * the status codes the service's exceptions turn into.
 *
 * `OrganizationGuard` is overridden — it narrows a `Principal` the global
 * token guard would have put on the request, and there is no token here. The
 * stand-in leaves the `Actor` where the real one does, so the handlers are
 * exercised exactly as they run.
 *
 * `EventPublisher` comes from organon's `@Global` RabbitMQ module, which is
 * not in this graph either, so it is supplied the same way — a global module
 * rather than `overrideProvider`, which can only replace a provider the graph
 * already has.
 */

@Global()
@Module({
  providers: [{ provide: EventPublisher, useValue: { publish: () => Promise.resolve() } }],
  exports: [EventPublisher],
})
class TestBrokerModule {}
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

const BASE = `/organizations/${ORGANIZATION}/places`;

const sieraad = {
  name: 'Het Sieraad',
  address: 'Postjesweg 1, 1057 DT Amsterdam',
  lat: 52.3676,
  lng: 4.8776,
};

let app: INestApplication;

beforeEach(async () => {
  const module = await Test.createTestingModule({
    imports: [TestBrokerModule, ToposModule],
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

describe('POST /organizations/:id/places', () => {
  it('creates a place and gives back the id it assigned', async () => {
    const { status, body } = await post(sieraad);

    expect(status).toBe(201);
    expect(body).toMatchObject(sieraad);
    expect(body.id).toEqual(expect.any(String));
  });

  it('strips an id the caller tried to choose', async () => {
    const chosen = '7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33';
    const { body } = await post({ ...sieraad, id: chosen });

    expect(body.id).not.toBe(chosen);
  });

  it('trims the text on the way in', async () => {
    const { body } = await post({ ...sieraad, name: '  Het Sieraad  ' });

    expect(body.name).toBe('Het Sieraad');
  });

  it('answers 400 for a latitude that does not exist', async () => {
    // Usually a longitude in the wrong field — the commonest way coordinates
    // get entered wrongly, and one of the few a schema can catch.
    const { status, body } = await post({ ...sieraad, lat: 200 });

    expect(status).toBe(400);
    expect(body.errors).toContainEqual(
      expect.objectContaining({
        path: 'lat',
        message: expect.stringMatching(/-90 to 90/),
      }),
    );
  });

  it('answers 400 for a coordinate sent as a string', async () => {
    // No coercion: the conversion belongs where the form is read, and a
    // failure there is visible.
    const { status } = await post({ ...sieraad, lat: '52.3676' });

    expect(status).toBe(400);
  });
});

describe('GET /organizations/:id/places', () => {
  it('is empty to begin with', async () => {
    const { status, body } = await request(app.getHttpServer()).get(BASE);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns one place by id', async () => {
    const { body: created } = await post(sieraad);

    const { status, body } = await request(app.getHttpServer()).get(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(200);
    expect(body).toEqual(created);
  });

  it('answers 404 for a well-formed id nobody holds', async () => {
    const { status } = await request(app.getHttpServer()).get(
      `${BASE}/7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33`,
    );

    expect(status).toBe(404);
  });

  it('answers 400 for an id that could never have been one', async () => {
    // 400 rather than 404: "no such place" would mislead about something that
    // is not an id at all.
    const { status } = await request(app.getHttpServer()).get(`${BASE}/42`);

    expect(status).toBe(400);
  });
});

describe('PATCH /organizations/:id/places/:id', () => {
  it('changes only the fields sent', async () => {
    const { body: created } = await post(sieraad);

    const { status, body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ description: 'A converted school building.' });

    expect(status).toBe(200);
    expect(body).toEqual({
      ...created,
      description: 'A converted school building.',
    });
  });

  it('validates what it is given', async () => {
    const { body: created } = await post(sieraad);

    const { status } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ lng: 400 });

    expect(status).toBe(400);
  });
});

describe('DELETE /organizations/:id/places/:id', () => {
  it('answers 204 and forgets the place', async () => {
    const { body: created } = await post(sieraad);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(204);

    const { body } = await request(app.getHttpServer()).get(BASE);

    expect(body).toEqual([]);
  });

  it('answers 404 for one already gone', async () => {
    const { body: created } = await post(sieraad);
    await request(app.getHttpServer()).delete(`${BASE}/${created.id}`);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(404);
  });
});
