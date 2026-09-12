import { NotFoundException } from '@nestjs/common';
import { aetherEventSchema, type Actor } from '@aether-zone/organon';

import { TestDatabase } from '../../test-database';
import { GroupEntity } from './group.entity';
import { GroupService } from './group.service';

/** A publisher that records instead of connecting. */
class RecordingPublisher {
  readonly published: { routingKey: string; event: any }[] = [];

  publish(routingKey: string, event: unknown) {
    this.published.push({ routingKey, event });

    return Promise.resolve();
  }
}

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

/*
 * Two *tenants*. Neither is a `Group` — which is the distinction the rename
 * exists to keep: the tenant scopes the rows, and the rows are groups somebody
 * wrote down inside it.
 */
const lokal = actorIn('org-1');
const other = actorIn('org-2');

const aether = { name: 'Aether Zone', type: 'COMPANY' } as const;

let publisher: RecordingPublisher;
let database: TestDatabase;
let groups: GroupService;

beforeEach(async () => {
  database = await TestDatabase.open(GroupEntity);
  publisher = new RecordingPublisher();
  groups = new GroupService(database.repository(GroupEntity), publisher as any);
});

afterEach(() => database.close());

describe('recording one', () => {
  it('needs only a name', async () => {
    const recorded = await groups.create(lokal, { name: 'The choir' });

    expect(recorded.name).toBe('The choir');
    expect(recorded.type).toBeUndefined();
  });

  it('keeps the kind where one was given', async () => {
    expect((await groups.create(lokal, aether)).type).toBe('COMPANY');
  });

  it('gives each one an id of its own', async () => {
    const first = await groups.create(lokal, { name: 'First' });
    const second = await groups.create(lokal, { name: 'Second' });

    expect(first.id).not.toBe(second.id);
  });

  it('keeps the tenant out of what it returns', async () => {
    /*
     * The row has an `organizationId` — the tenant — and the DTO must not: it
     * is in the URL of every route that can reach the record, and a client
     * that read it from the body might start sending it *as* the body.
     */
    expect(await groups.create(lokal, aether)).not.toHaveProperty(
      'organizationId',
    );
  });
});

describe('who can see what', () => {
  it('shows a tenant only its own groups', async () => {
    await groups.create(lokal, { name: 'Ours' });
    await groups.create(other, { name: 'Theirs' });

    expect((await groups.list(lokal)).map((o) => o.name)).toEqual(['Ours']);
    expect((await groups.list(other)).map((o) => o.name)).toEqual(['Theirs']);
  });

  it('gives the same 404 for another tenant’s as for none', async () => {
    // Telling the two apart would answer "does this id exist somewhere".
    const theirs = await groups.create(other, aether);

    await expect(groups.get(lokal, theirs.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update or delete across the boundary', async () => {
    const theirs = await groups.create(other, aether);

    await expect(
      groups.update(lokal, theirs.id, { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
    await expect(groups.remove(lokal, theirs.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lets two tenants each record a group of the same name', async () => {
    // Nothing here is a natural key. Two companies called "Acme" in two
    // tenants are two records, and neither should block the other.
    await groups.create(lokal, { name: 'Acme' });

    await expect(groups.create(other, { name: 'Acme' })).resolves.toBeDefined();
  });
});

describe('listing', () => {
  it('is by name, which is how somebody looks for one', async () => {
    await groups.create(lokal, { name: 'Zebra' });
    await groups.create(lokal, { name: 'Acme' });

    expect((await groups.list(lokal)).map((o) => o.name)).toEqual([
      'Acme',
      'Zebra',
    ]);
  });
});

describe('changing one', () => {
  it('leaves the fields a change does not mention alone', async () => {
    const recorded = await groups.create(lokal, {
      ...aether,
      description: 'The workspace.',
    });

    const updated = await groups.update(lokal, recorded.id, {
      name: 'Renamed',
    });

    expect(updated).toMatchObject({
      name: 'Renamed',
      type: 'COMPANY',
      description: 'The workspace.',
    });
  });

  it('removes a value given null, rather than blanking it', async () => {
    const recorded = await groups.create(lokal, {
      ...aether,
      description: 'The workspace.',
    });

    const updated = await groups.update(lokal, recorded.id, {
      type: null,
      description: null,
    });

    expect(updated.type).toBeUndefined();
    expect(updated.description).toBeUndefined();
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      groups.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', async () => {
    const first = await groups.create(lokal, { name: 'First' });
    await groups.create(lokal, { name: 'Second' });

    await groups.remove(lokal, first.id);

    expect((await groups.list(lokal)).map((o) => o.name)).toEqual(['Second']);
  });

  it('answers 404 for one already gone', async () => {
    const recorded = await groups.create(lokal, aether);
    await groups.remove(lokal, recorded.id);

    await expect(groups.remove(lokal, recorded.id)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('announcing', () => {
  it('publishes under the created key', async () => {
    const recorded = await groups.create(lokal, aether);

    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('group.created');
    expect(event).toMatchObject({
      type: 'aether:ResourceCreated',
      subject: `urn:aether:group:${recorded.id}`,
    });
  });

  it('scopes the event by the tenant, not by the group it describes', async () => {
    /*
     * `organizationId` on an Aether event means "which tenant" to every
     * consumer in the workspace — arachni scopes its nodes by it, akouo has a
     * NOT NULL column for it. Putting the *group's* id there instead would be
     * syntactically perfect and would quietly file every record under a tenant
     * that does not exist. The two fields being named differently is what
     * makes that mistake visible.
     */
    const recorded = await groups.create(lokal, aether);

    expect(publisher.published[0].event.organizationId).toBe('org-1');
    expect(publisher.published[0].event.organizationId).not.toBe(recorded.id);
  });

  it('publishes a document anything can read, not the DTO', async () => {
    await groups.create(lokal, {
      ...aether,
      description: 'The workspace.',
    });

    expect(publisher.published[0].event.data).toMatchObject({
      '@type': 'aether:Group',
      name: 'Aether Zone',
      description: 'The workspace.',
      // `groupType`, not `type`: `@type` already means the node's
      // classes in JSON-LD, and a property called `type` beside it is a trap.
      groupType: 'COMPANY',
    });
  });

  it('leaves out what the record does not say', async () => {
    await groups.create(lokal, { name: 'The choir' });

    const { data } = publisher.published[0].event;

    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('groupType');
  });

  it('publishes a delete with no data', async () => {
    const recorded = await groups.create(lokal, aether);
    await groups.remove(lokal, recorded.id);

    const { routingKey, event } = publisher.published[1];

    expect(routingKey).toBe('group.deleted');
    expect(event).not.toHaveProperty('data');
  });

  it('says nothing when the change was refused', async () => {
    await expect(
      groups.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);

    expect(publisher.published).toHaveLength(0);
  });

  it('publishes events organon will accept', async () => {
    const recorded = await groups.create(lokal, aether);
    await groups.update(lokal, recorded.id, { name: 'Renamed' });
    await groups.remove(lokal, recorded.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});
