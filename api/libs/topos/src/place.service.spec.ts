import { NotFoundException } from '@nestjs/common';
import { aetherEventSchema, type Actor } from '@aether-zone/organon';

import { TestDatabase } from '../../test-database';
import { PlaceEntity } from './place.entity';
import { PlaceService } from './place.service';

/** A publisher that records instead of connecting. */
class RecordingPublisher {
  readonly published: { routingKey: string; event: any }[] = [];

  publish(routingKey: string, event: unknown) {
    this.published.push({ routingKey, event });

    return Promise.resolve();
  }
}

let publisher: RecordingPublisher;
let database: TestDatabase;

const actorIn = (organizationId: string): Actor =>
  ({
    id: 'caller-1',
    clientId: 'aether',
    scopes: [],
    organizations: {},
    organizationId,
    role: 'member',
    organizationName: 'Test',
  }) as Actor;

const lokal = actorIn('org-1');
const other = actorIn('org-2');

const sieraad = {
  name: 'Het Sieraad',
  description: 'A converted school building.',
  address: 'Postjesweg 1, 1057 DT Amsterdam',
  lat: 52.3676,
  lng: 4.8776,
};

const depot = {
  name: 'Het Depot',
  address: 'Museumpark 18, 3015 CX Rotterdam',
  lat: 51.9145,
  lng: 4.4726,
};

let places: PlaceService;

beforeEach(async () => {
  database = await TestDatabase.open(PlaceEntity);
  publisher = new RecordingPublisher();
  places = new PlaceService(database.repository(PlaceEntity), publisher as any);
});

describe('creating', () => {
  it('assigns the id rather than taking one', async () => {
    const created = await places.create(lokal, sieraad);

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(created).toMatchObject(sieraad);
  });

  it('keeps the organization out of the body', async () => {
    // It is in the URL of every route that can reach the record, so returning
    // it would restate what the caller already said.
    expect(await places.create(lokal, sieraad)).not.toHaveProperty(
      'organizationId',
    );
  });

  it('allows two places with the same name', async () => {
    // Unlike people, nothing here is a natural key: two rooms may both be
    // called "Meeting Room", and two places may share an address.
    await places.create(lokal, sieraad);

    await expect(
      places.create(lokal, { ...depot, name: sieraad.name }),
    ).resolves.toBeDefined();
    expect(await places.list(lokal)).toHaveLength(2);
  });

  it('keeps a place without a description', async () => {
    // Parenthesised deliberately: `await x.create(…).description` awaits the
    // *property* of the promise, which is undefined — so the assertion passed
    // while proving nothing. Typecheck caught it; the test never would.
    const created = await places.create(lokal, depot);

    expect(created.description).toBeUndefined();
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s places', async () => {
    await places.create(lokal, sieraad);
    await places.create(other, depot);

    expect((await places.list(lokal)).map((p) => p.name)).toEqual([
      'Het Sieraad',
    ]);
    expect((await places.list(other)).map((p) => p.name)).toEqual([
      'Het Depot',
    ]);
  });

  it('answers 404 for someone else’s place', async () => {
    // The same 404 as one that does not exist: telling them apart would answer
    // "does this id exist somewhere" for anyone who cared to ask.
    const created = await places.create(lokal, sieraad);

    await expect(places.get(other, created.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update or delete across the boundary', async () => {
    const created = await places.create(lokal, sieraad);

    await expect(
      places.update(other, created.id, { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
    await expect(places.remove(other, created.id)).rejects.toThrow(
      NotFoundException,
    );

    // Still there, and unchanged.
    expect(await places.get(lokal, created.id)).toEqual(created);
  });
});

describe('reading', () => {
  it('lists in the order places were added', async () => {
    // The clock is advanced so the two rows do not share a millisecond; see
    // the note on `recordedAt` for why that matters.
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T09:00:00.000Z'));

    await places.create(lokal, sieraad);

    jest.advanceTimersByTime(1000);

    await places.create(lokal, depot);

    expect((await places.list(lokal)).map((p) => p.name)).toEqual([
      'Het Sieraad',
      'Het Depot',
    ]);
  });

  it('is empty before anything is added', async () => {
    expect(await places.list(lokal)).toEqual([]);
  });
});

describe('updating', () => {
  it('changes only what it was given', async () => {
    const created = await places.create(lokal, sieraad);
    const updated = await places.update(lokal, created.id, { lng: 4.8777 });

    expect(updated).toEqual({ ...created, lng: 4.8777 });
  });

  it('does not move the place in the list', async () => {
    /*
     * An edit is not a reordering; a list that reshuffled on every save would
     * make the console jump under the reader.
     *
     * The clock is advanced between the two creates because the order key is a
     * millisecond timestamp, and two rows written in the same millisecond tie
     * — broken by id, so the order is stable but arbitrary between them. What
     * this test is about is that *updating* does not change it, and that has
     * to be asserted against a known order rather than a coin toss.
     */
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T09:00:00.000Z'));

    await places.create(lokal, sieraad);

    jest.advanceTimersByTime(1000);

    const second = await places.create(lokal, depot);

    await places.update(lokal, second.id, { name: 'Renamed' });

    expect((await places.list(lokal)).map((p) => p.name)).toEqual([
      'Het Sieraad',
      'Renamed',
    ]);
  });

  it('accepts an empty change', async () => {
    const created = await places.create(lokal, sieraad);

    expect(await places.update(lokal, created.id, {})).toEqual(created);
  });

  it('answers 404 for an id it does not hold', async () => {
    await expect(
      places.update(lokal, '7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33', {
        name: 'X',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets the place and leaves the rest alone', async () => {
    const first = await places.create(lokal, sieraad);
    await places.create(lokal, depot);

    await places.remove(lokal, first.id);

    expect((await places.list(lokal)).map((p) => p.name)).toEqual([
      'Het Depot',
    ]);
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    // Reporting success would hide a caller working from a stale list.
    await expect(
      places.remove(lokal, '7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('the events a place announces', () => {
  it('announces a creation naming the tenant', async () => {
    const created = await places.create(lokal, sieraad);
    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('place.created');
    expect(event.type).toBe('aether:ResourceCreated');
    expect(event.organizationId).toBe('org-1');
    expect(event.subject).toBe(`urn:aether:place:${created.id}`);
  });

  it('carries the place as JSON-LD rather than the api DTO', async () => {
    await places.create(lokal, sieraad);

    expect(publisher.published[0].event.data).toMatchObject({
      '@type': 'aether:Place',
      name: 'Het Sieraad',
      address: 'Postjesweg 1, 1057 DT Amsterdam',
      // Spelled out: `lat`/`lng` are aether's own shorthand, and a consumer
      // reading a shared vocabulary should not have to guess at them.
      latitude: 52.3676,
      longitude: 4.8776,
    });
  });

  it('omits a description the place does not have', async () => {
    // Absent means "not stated"; null would assert it has no description.
    await places.create(lokal, depot);

    expect(publisher.published[0].event.data).not.toHaveProperty('description');
  });

  it('states the subject and the document @id identically', async () => {
    await places.create(lokal, sieraad);
    const { event } = publisher.published[0];

    expect(event.data['@id']).toBe(event.subject);
  });

  it('announces an update with the whole document', async () => {
    const created = await places.create(lokal, sieraad);
    publisher.published.length = 0;

    await places.update(lokal, created.id, { name: 'Renamed' });
    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('place.updated');
    expect(event.type).toBe('aether:ResourceUpdated');
    expect(event.data).toMatchObject({ name: 'Renamed', latitude: 52.3676 });
  });

  it('announces a delete carrying no document', async () => {
    const created = await places.create(lokal, sieraad);
    publisher.published.length = 0;

    await places.remove(lokal, created.id);
    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('place.deleted');
    expect(event.type).toBe('aether:ResourceDeleted');
    expect(event).not.toHaveProperty('data');
    expect(event.subject).toBe(`urn:aether:place:${created.id}`);
  });

  it('announces nothing when nothing changed', async () => {
    await expect(
      places.remove(lokal, '7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33'),
    ).rejects.toThrow(NotFoundException);

    expect(publisher.published).toEqual([]);
  });

  it('still records the place when the broker is down', async () => {
    // The place *was* recorded; answering 500 would invite a retry that
    // creates a second one.
    publisher.publish = () => Promise.reject(new Error('broker unreachable'));

    await expect(places.create(lokal, sieraad)).resolves.toMatchObject(sieraad);
    expect(await places.list(lokal)).toHaveLength(1);
  });

  it('publishes only events organon’s schema accepts', async () => {
    // An event that fails it is one arachni, mneme and akouo all drop,
    // silently and identically.
    const created = await places.create(lokal, sieraad);
    await places.update(lokal, created.id, { name: 'Renamed' });
    await places.remove(lokal, created.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});

afterEach(async () => {
  // Two tests install a fake clock; leaving one in place would make whichever
  // spec ran next depend on the order jest happened to choose.
  jest.useRealTimers();
  await database.close();
});
