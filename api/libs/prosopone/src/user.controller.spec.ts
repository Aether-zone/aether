import {
  ACTOR_KEY,
  EventPublisher,
  OrganizationGuard,
  type Actor,
} from '@aether-zone/organon';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

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

const BASE = `/organizations/${ORGANIZATION}/users`;
const ada = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneNumber: '+31612345678',
};

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
    imports: [TestBrokerModule, ProsoponeModule],
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

describe('POST /organizations/:id/users', () => {
  it('creates a person and gives back the id it assigned', async () => {
    const { status, body } = await post(ada);

    expect(status).toBe(201);
    expect(body).toMatchObject(ada);
    expect(body.id).toEqual(expect.any(String));
  });

  it('strips an id the caller tried to choose', async () => {
    // zod removes unknown keys, so a client cannot pick where its record
    // lands by guessing an id.
    const chosen = '3f1a7c22-8f4a-4c3e-9b21-6d5e0a7f1c88';
    const { body } = await post({ ...ada, id: chosen });

    expect(body.id).not.toBe(chosen);
  });

  it('lowercases the email on the way in', async () => {
    const { body } = await post({ ...ada, email: 'Ada@Example.COM' });

    expect(body.email).toBe('ada@example.com');
  });

  it('answers 400 with the field that was wrong', async () => {
    const { status, body } = await post({ ...ada, phoneNumber: '0612345678' });

    expect(status).toBe(400);
    // `objectContaining`: organon's pipe reports a `code` alongside the path
    // and message, and pinning the whole issue would break on a zod upgrade
    // that added a field.
    expect(body.errors).toContainEqual(
      expect.objectContaining({
        path: 'phoneNumber',
        message: expect.stringMatching(/international format/),
      }),
    );
  });

  it('answers 409 for an email already taken', async () => {
    await post(ada);

    const { status } = await post({ ...ada, firstName: 'Someone' });

    expect(status).toBe(409);
  });
});

describe('GET /organizations/:id/users', () => {
  it('is empty to begin with', async () => {
    const { status, body } = await request(app.getHttpServer()).get(BASE);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns one person by id', async () => {
    const { body: created } = await post(ada);

    const { status, body } = await request(app.getHttpServer()).get(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(200);
    expect(body).toEqual(created);
  });

  it('answers 404 for a well-formed id nobody holds', async () => {
    const { status } = await request(app.getHttpServer()).get(
      `${BASE}/3f1a7c22-8f4a-4c3e-9b21-6d5e0a7f1c88`,
    );

    expect(status).toBe(404);
  });

  it('answers 400 for an id that could never have been one', async () => {
    // 400 rather than 404: "no such person" would be misleading about
    // something that is not an id at all.
    const { status } = await request(app.getHttpServer()).get(`${BASE}/42`);

    expect(status).toBe(400);
  });
});

describe('PATCH /organizations/:id/users/:id', () => {
  it('changes only the fields sent', async () => {
    const { body: created } = await post(ada);

    const { status, body } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ lastName: 'Byron' });

    expect(status).toBe(200);
    expect(body).toEqual({ ...created, lastName: 'Byron' });
  });

  it('validates what it is given', async () => {
    const { body: created } = await post(ada);

    const { status } = await request(app.getHttpServer())
      .patch(`${BASE}/${created.id}`)
      .send({ email: 'nope' });

    expect(status).toBe(400);
  });
});

describe('DELETE /organizations/:id/users/:id', () => {
  it('answers 204 and forgets the person', async () => {
    const { body: created } = await post(ada);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(204);

    const { body } = await request(app.getHttpServer()).get(BASE);

    expect(body).toEqual([]);
  });

  it('answers 404 for someone already gone', async () => {
    const { body: created } = await post(ada);
    await request(app.getHttpServer()).delete(`${BASE}/${created.id}`);

    const { status } = await request(app.getHttpServer()).delete(
      `${BASE}/${created.id}`,
    );

    expect(status).toBe(404);
  });
});

describe('the event a create announces', () => {
  it('is published under person.created', async () => {
    await post(ada);

    expect(published).toHaveLength(1);
    expect(published[0].routingKey).toBe('person.created');
  });

  it('is an aether:ResourceCreated naming the person', async () => {
    const { body: created } = await post(ada);
    const { event } = published[0];

    expect(event.type).toBe('aether:ResourceCreated');
    expect(event.source).toBe('https://aether.zone/aether');
    expect(event.subject).toBe(`urn:aether:person:${created.id}`);
  });

  it('states the subject and the document @id identically', () => {
    // organon's schema refuses an event where they disagree: they are the same
    // fact twice, and a consumer would file the document under the wrong node.
    return post(ada).then(() => {
      const { event } = published[0];

      expect(event.data['@id']).toBe(event.subject);
    });
  });

  it('carries the person as JSON-LD rather than the api DTO', async () => {
    await post(ada);

    expect(published[0].event.data).toMatchObject({
      '@type': 'aether:Person',
      givenName: 'Ada',
      familyName: 'Lovelace',
      email: 'ada@example.com',
      telephone: '+31612345678',
    });
    // The context travels with the document, so a consumer needs no network
    // to read it.
    expect(published[0].event.data['@context']).toMatchObject({
      aether: 'https://aether.zone/vocab/',
    });
  });

  it('announces nothing when the create was refused', async () => {
    await post(ada);
    published.length = 0;

    await post({ ...ada, firstName: 'Someone' });

    // A 409 is not a person, and a consumer that heard about one would build a
    // node for something that does not exist.
    expect(published).toEqual([]);
  });

  it('announces nothing for a body that failed validation', async () => {
    await post({ ...ada, phoneNumber: '0612345678' });

    expect(published).toEqual([]);
  });
});
