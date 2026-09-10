import {
  aetherEventSchema,
  EventPublisher,
  type Actor,
} from '@aether-zone/organon';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { UserService } from './user.service';

/**
 * A publisher that records instead of connecting.
 *
 * The real one needs a broker, and what these specs are about is *what* gets
 * announced rather than that RabbitMQ works.
 */
class RecordingPublisher {
  readonly published: { routingKey: string; event: any }[] = [];

  publish(routingKey: string, event: unknown) {
    this.published.push({ routingKey, event });

    return Promise.resolve();
  }
}

/** The actor `OrganizationGuard` would have produced for a request. */
const actorIn = (organizationId: string, id = 'caller-1'): Actor =>
  ({
    id,
    clientId: 'aether',
    scopes: [],
    organizations: {},
    organizationId,
    role: 'member',
    organizationName: 'Test',
  }) as Actor;

const lokal = actorIn('org-1');
const other = actorIn('org-2');

const ada = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneNumber: '+31612345678',
};

const grace = {
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  phoneNumber: '+12025550143',
};

let publisher: RecordingPublisher;
let users: UserService;

beforeEach(() => {
  publisher = new RecordingPublisher();
  users = new UserService(publisher as unknown as EventPublisher);
});

describe('creating', () => {
  it('assigns the id rather than taking one', async () => {
    const created = await users.create(lokal, ada);

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(created).toMatchObject(ada);
  });

  it('keeps the organization out of the body', async () => {
    // It is in the URL of every route that can reach the record, so returning
    // it would restate what the caller already said — and a client that read
    // it from the body might start sending it *as* the body.
    const created = await users.create(lokal, ada);

    expect(created).not.toHaveProperty('organizationId');
  });

  it('refuses a second person with the same email in one organization', async () => {
    await users.create(lokal, ada);

    await expect(
      users.create(lokal, { ...grace, email: ada.email }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows that address again in another organization', async () => {
    // Across tenants the same address is a different person; scoping the check
    // is what stops one organization's directory constraining another's.
    await users.create(lokal, ada);

    await expect(users.create(other, ada)).resolves.toMatchObject(ada);
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s people', async () => {
    await users.create(lokal, ada);
    await users.create(other, grace);

    expect(users.list(lokal).map((u) => u.firstName)).toEqual(['Ada']);
    expect(users.list(other).map((u) => u.firstName)).toEqual(['Grace']);
  });

  it('answers 404 for someone else’s person', async () => {
    // The same 404 as one that does not exist: telling them apart would answer
    // "does this id exist somewhere" for anyone who cared to ask.
    const created = await users.create(lokal, ada);

    expect(() => users.get(other, created.id)).toThrow(NotFoundException);
  });

  it('refuses to update or delete across the boundary', async () => {
    const created = await users.create(lokal, ada);

    await expect(
      users.update(other, created.id, { lastName: 'X' }),
    ).rejects.toThrow(NotFoundException);
    await expect(users.remove(other, created.id)).rejects.toThrow(
      NotFoundException,
    );

    // Still there, and unchanged.
    expect(users.get(lokal, created.id)).toEqual(created);
  });
});

describe('updating', () => {
  it('changes only what it was given', async () => {
    const created = await users.create(lokal, ada);
    const updated = await users.update(lokal, created.id, {
      lastName: 'Byron',
    });

    expect(updated).toEqual({ ...created, lastName: 'Byron' });
  });

  it('lets a person keep their own email', async () => {
    const created = await users.create(lokal, ada);

    await expect(
      users.update(lokal, created.id, { email: ada.email }),
    ).resolves.toEqual(created);
  });

  it('refuses an email that belongs to someone else here', async () => {
    const created = await users.create(lokal, ada);
    await users.create(lokal, grace);

    await expect(
      users.update(lokal, created.id, { email: grace.email }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('removing', () => {
  it('forgets the person and frees their email', async () => {
    const created = await users.create(lokal, ada);

    await users.remove(lokal, created.id);

    expect(users.list(lokal)).toEqual([]);
    await expect(users.create(lokal, ada)).resolves.toBeDefined();
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    // Reporting success would hide a caller working from a stale list.
    await expect(
      users.remove(lokal, '3f1a7c22-8f4a-4c3e-9b21-6d5e0a7f1c88'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('the event a create announces', () => {
  it('names the organization, without which every consumer drops it', async () => {
    // arachni refuses to write a node it cannot scope, mneme refuses to index
    // text it cannot file, and akouo's organizationId column is NOT NULL.
    const created = await users.create(lokal, ada);
    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('person.created');
    expect(event.organizationId).toBe('org-1');
    expect(event.type).toBe('aether:ResourceCreated');
    expect(event.subject).toBe(`urn:aether:person:${created.id}`);
  });

  it('states the subject and the document @id identically', async () => {
    // organon's schema refuses an event where they disagree: the same fact
    // twice, and a consumer would file the document under the wrong node.
    await users.create(lokal, ada);
    const { event } = publisher.published[0];

    expect(event.data['@id']).toBe(event.subject);
  });

  it('records who caused it, as provenance', async () => {
    await users.create(lokal, ada);

    expect(publisher.published[0].event.actor).toEqual({
      id: 'caller-1',
      type: 'User',
    });
  });

  it('announces nothing when the create was refused', async () => {
    await users.create(lokal, ada);
    publisher.published.length = 0;

    await expect(users.create(lokal, ada)).rejects.toThrow(ConflictException);

    // A 409 is not a person, and a consumer that heard about one would build a
    // node for something that does not exist.
    expect(publisher.published).toEqual([]);
  });

  it('still creates the person when the broker is down', async () => {
    // The person *was* created; answering 500 would invite a retry that makes
    // a second one.
    publisher.publish = () => Promise.reject(new Error('broker unreachable'));

    await expect(users.create(lokal, ada)).resolves.toMatchObject(ada);
    expect(users.list(lokal)).toHaveLength(1);
  });
});

describe('the events an update and a delete announce', () => {
  it('announces an update with the whole document, not the change', async () => {
    /*
     * An Aether event describes the resource as it now is. A consumer holding
     * a copy replaces it, and one hearing about this person for the first time
     * — because it missed the create, or was deployed yesterday — still ends
     * up with everything. A patch would only work for consumers that already
     * agreed with us.
     */
    const created = await users.create(lokal, ada);
    publisher.published.length = 0;

    await users.update(lokal, created.id, { lastName: 'Byron' });

    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('person.updated');
    expect(event.type).toBe('aether:ResourceUpdated');
    expect(event.organizationId).toBe('org-1');
    expect(event.data).toMatchObject({
      familyName: 'Byron',
      // Unchanged fields travel too — this is the resource, not a diff.
      givenName: 'Ada',
      email: 'ada@example.com',
    });
  });

  it('announces a delete carrying no document', async () => {
    // organon's schema has no `data` on that variant: there is nothing left to
    // describe, and the subject is all a consumer needs to find its copy.
    const created = await users.create(lokal, ada);
    publisher.published.length = 0;

    await users.remove(lokal, created.id);

    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('person.deleted');
    expect(event.type).toBe('aether:ResourceDeleted');
    expect(event).not.toHaveProperty('data');
    expect(event.subject).toBe(`urn:aether:person:${created.id}`);
    expect(event.organizationId).toBe('org-1');
  });

  it('announces nothing when the update was refused', async () => {
    const created = await users.create(lokal, ada);
    await users.create(lokal, grace);
    publisher.published.length = 0;

    await expect(
      users.update(lokal, created.id, { email: grace.email }),
    ).rejects.toThrow(ConflictException);

    expect(publisher.published).toEqual([]);
  });

  it('announces nothing when the delete found nobody', async () => {
    await expect(
      users.remove(lokal, '3f1a7c22-8f4a-4c3e-9b21-6d5e0a7f1c88'),
    ).rejects.toThrow(NotFoundException);

    expect(publisher.published).toEqual([]);
  });

  it('still deletes the person when the broker is down', async () => {
    const created = await users.create(lokal, ada);
    publisher.publish = () => Promise.reject(new Error('broker unreachable'));

    await expect(users.remove(lokal, created.id)).resolves.toBeUndefined();
    expect(users.list(lokal)).toEqual([]);
  });
});

describe('every event satisfies organon’s schema', () => {
  it.each([
    ['created', async () => { await users.create(lokal, ada); }],
    ['updated', async () => {
      const u = await users.create(lokal, ada);
      await users.update(lokal, u.id, { lastName: 'Byron' });
    }],
    ['deleted', async () => {
      const u = await users.create(lokal, ada);
      await users.remove(lokal, u.id);
    }],
  ])('%s', async (_name, act) => {
    // The schema is what every consumer parses with; an event that fails it is
    // one arachni, mneme and akouo all drop, silently and identically.
    await act();

    for (const { event } of publisher.published) {
      const parsed = aetherEventSchema.safeParse(event);

      expect(parsed.success).toBe(true);
    }
  });
});
