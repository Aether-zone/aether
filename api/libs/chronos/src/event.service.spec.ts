import {
  aetherEventSchema,
  EventPublisher,
  type Actor,
} from '@aether-zone/organon';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PlaceService } from '@aether/topos';
import { UserService } from '@aether/prosopone';

import { TestDatabase } from '../../test-database';
import { UserEntity } from '@aether/prosopone/user.entity';
import { PlaceEntity } from '@aether/topos/place.entity';
import { EventEntity } from './event.entity';
import { EventService } from './event.service';

class RecordingPublisher {
  readonly published: { routingKey: string; event: any }[] = [];

  publish(routingKey: string, event: unknown) {
    this.published.push({ routingKey, event });

    return Promise.resolve();
  }
}

const actor = {
  id: 'caller-1',
  clientId: 'aether',
  scopes: [],
  organizations: {},
  organizationId: 'org-1',
  role: 'member',
  organizationName: 'Test',
} as Actor;

const ada = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneNumber: '+31612345678',
};

const sieraad = {
  name: 'Het Sieraad',
  address: 'Postjesweg 1, 1057 DT Amsterdam',
  lat: 52.3676,
  lng: 4.8776,
};

let publisher: RecordingPublisher;
let people: UserService;
let places: PlaceService;
let events: EventService;
let database: TestDatabase;
let adaId: string;
let placeId: string;

beforeEach(async () => {
  database = await TestDatabase.open(EventEntity, UserEntity, PlaceEntity);
  publisher = new RecordingPublisher();
  /* The real services on a real store: what an event points at has to exist. */
  people = new UserService(
    database.repository(UserEntity),
    publisher as unknown as EventPublisher,
  );
  places = new PlaceService(
    database.repository(PlaceEntity),
    publisher as unknown as EventPublisher,
  );
  events = new EventService(
    database.repository(EventEntity),
    publisher as unknown as EventPublisher,
    people,
    places,
  );

  adaId = (await people.create(actor, ada)).id;
  placeId = (await places.create(actor, sieraad)).id;
  publisher.published.length = 0;
});

const meeting = () => ({
  type: 'MEETING' as const,
  title: 'Quarterly planning',
  startsAt: '2026-01-01T09:00:00.000Z',
  endsAt: '2026-01-01T10:00:00.000Z',
  locationId: placeId,
  attendeeIds: [adaId],
});

describe('creating', () => {
  it('fills in the people and the place it was given ids for', async () => {
    // Stored as ids, resolved on the way out: a name corrected in prosopone
    // must not stay wrong on every event that mentioned that person.
    const created = await events.create(actor, meeting());

    expect(created.attendees[0]).toMatchObject({ firstName: 'Ada' });
    expect(created.location).toMatchObject({ name: 'Het Sieraad' });
    expect(created.status).toBe('SCHEDULED');
  });

  it('refuses an attendee this organization does not have', async () => {
    // Checked before anything is stored, so this is a 404 rather than an
    // event that exists and cannot be read back.
    await expect(
      events.create(actor, {
        ...meeting(),
        attendeeIds: ['3f1a7c22-8f4a-4c3e-9b21-6d5e0a7f1c88'],
      }),
    ).rejects.toThrow(NotFoundException);

    expect(await events.list(actor)).toEqual([]);
  });

  it('refuses a place this organization does not have', async () => {
    await expect(
      events.create(actor, {
        ...meeting(),
        locationId: '7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('keeps a kind that is a moment, with no end', async () => {
    const created = await events.create(actor, {
      type: 'DEADLINE',
      title: 'Tax return due',
      startsAt: '2026-01-31T23:59:00.000Z',
      attendeeIds: [],
    });

    expect(created.endsAt).toBeUndefined();
    expect(created.attendees).toEqual([]);
  });
});

describe('reading it back', () => {
  it('drops an attendee who has since left prosopone', async () => {
    /*
     * An event whose attendee has gone is still an event; refusing to show it
     * would let one deletion hide a calendar.
     */
    const created = await events.create(actor, meeting());

    await people.remove(actor, adaId);

    expect((await events.get(actor, created.id)).attendees).toEqual([]);
  });

  it('leaves the place unstated when it was deleted since', async () => {
    const created = await events.create(actor, meeting());

    await places.remove(actor, placeId);

    expect((await events.get(actor, created.id)).location).toBeUndefined();
  });
});

describe('updating', () => {
  it('compares the times after merging, not before', async () => {
    /*
     * The schema cannot do this: a partial update may carry only one of them,
     * and the other is known only once merged with what is stored.
     */
    const created = await events.create(actor, meeting());

    await expect(
      events.update(actor, created.id, {
        endsAt: '2026-01-01T08:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('tells "nowhere" from "leave it alone"', async () => {
    const created = await events.create(actor, meeting());

    const untouched = await events.update(actor, created.id, {
      title: 'Renamed',
    });

    expect(untouched.location).toMatchObject({ name: 'Het Sieraad' });

    const cleared = await events.update(actor, created.id, {
      locationId: null,
    });

    expect(cleared.location).toBeUndefined();
  });
});

describe('the events it announces', () => {
  it('announces a creation naming the tenant', async () => {
    const created = await events.create(actor, meeting());
    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('event.created');
    expect(event.type).toBe('aether:ResourceCreated');
    expect(event.organizationId).toBe('org-1');
    expect(event.subject).toBe(`urn:aether:event:${created.id}`);
  });

  it('carries both an Event type and the kind', async () => {
    /*
     * arachni turns `@type` into labels, so "everything on Tuesday" and "every
     * meeting" are each one query. It also lands on the same `Meeting` label
     * akouo publishes, so a consumer asking for meetings gets both.
     */
    await events.create(actor, meeting());

    expect(publisher.published[0].event.data['@type']).toEqual([
      'aether:Event',
      'aether:Meeting',
    ]);
  });

  it('points at people and place rather than nesting them', async () => {
    /*
     * References, not nested resources. arachni cascades a delete through
     * nested ones — so nesting here would take a person out of the graph when
     * a meeting was cancelled.
     */
    await events.create(actor, meeting());
    const { data } = publisher.published[0].event;

    expect(data.attendee).toEqual([{ '@id': `urn:aether:person:${adaId}` }]);
    expect(data.location).toEqual({ '@id': `urn:aether:place:${placeId}` });
  });

  it('announces an update and a delete', async () => {
    const created = await events.create(actor, meeting());
    publisher.published.length = 0;

    await events.update(actor, created.id, { status: 'CANCELLED' });
    await events.remove(actor, created.id);

    expect(publisher.published.map((p) => p.routingKey)).toEqual([
      'event.updated',
      'event.deleted',
    ]);
    // A delete carries no document: there is nothing left to describe.
    expect(publisher.published[1].event).not.toHaveProperty('data');
  });

  it('announces nothing when the create was refused', async () => {
    await expect(
      events.create(actor, { ...meeting(), attendeeIds: ['not-a-uuid'] }),
    ).rejects.toThrow();

    expect(publisher.published).toEqual([]);
  });

  it('publishes only events organon’s schema accepts', async () => {
    const created = await events.create(actor, meeting());
    await events.update(actor, created.id, { title: 'Renamed' });
    await events.remove(actor, created.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});

afterEach(() => database.close());
