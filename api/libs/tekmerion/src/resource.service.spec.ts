import { NotFoundException } from '@nestjs/common';
import { aetherEventSchema, type Actor } from '@aether-zone/organon';

import { TestDatabase } from '../../test-database';
import { ResourceEntity } from './resource.entity';
import type { CreateResourceDTO } from '@aether/contract';

import { ResourceService } from './resource.service';

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

const page = {
  type: 'WEB_PAGE',
  title: 'The Twelve-Factor App',
  url: 'https://12factor.net/',
  source: { type: 'web', name: 'Web crawler' },
  externalId: 'page-4471',
} as const;

let resources: ResourceService;

/**
 * Files one the way the controller does.
 *
 * `tags`, `involves` and the three relation arrays have defaults in the
 * schema, so a request may leave them out — but the service is handed input
 * the pipe has already parsed, and by then the empty arrays are there.
 */
const file = (
  actor: Actor,
  input: Partial<CreateResourceDTO> & { type: CreateResourceDTO['type'] },
) =>
  resources.create(actor, {
    tags: [],
    involves: [],
    about: [],
    relatedTo: [],
    mentions: [],
    ...input,
  });

beforeEach(async () => {
  database = await TestDatabase.open(ResourceEntity);
  publisher = new RecordingPublisher();
  resources = new ResourceService(
    database.repository(ResourceEntity),
    publisher as any,
  );
});

describe('filing one', () => {
  it('needs only a kind', async () => {
    const filed = await file(lokal, { type: 'NOTE' });

    expect(filed.type).toBe('NOTE');
    expect(filed.title).toBeUndefined();
  });

  it('keeps everything it was given', async () => {
    const filed = await file(lokal, { ...page });

    expect(filed).toMatchObject(page);
  });

  it('gives each one an id and a pair of timestamps', async () => {
    const filed = await file(lokal, { type: 'NOTE' });

    expect(filed.id).toHaveLength(36);
    expect(filed.createdAt).toBe(filed.updatedAt);
  });

  it('gives each one an id of its own', async () => {
    expect((await file(lokal, { type: 'NOTE' })).id).not.toBe(
      (await file(lokal, { type: 'NOTE' })).id,
    );
  });
});

describe('finding the one a system already gave us', () => {
  it('matches on the source type and the external id together', async () => {
    const filed = await file(lokal, { ...page });

    expect((await resources.findExternal(lokal, 'web', 'page-4471'))?.id).toBe(
      filed.id,
    );
  });

  it('does not match the same id from a different system', async () => {
    /*
     * Two systems will both number their records from 1, so the external id
     * alone is not an identity — matching on it would merge two unrelated
     * things the first time the numbers collided.
     */
    await file(lokal, { ...page });

    expect(
      await resources.findExternal(lokal, 'notion', 'page-4471'),
    ).toBeUndefined();
  });

  it('ignores which instance of the system it came through', async () => {
    // `source.id` says which mailbox; a caller asking "have I filed message
    // 4471" usually knows the message without knowing the account.
    await file(lokal, {
      type: 'EMAIL',
      source: { type: 'gmail', id: 'work@example.test' },
      externalId: 'msg-1',
    });

    expect(await resources.findExternal(lokal, 'gmail', 'msg-1')).toBeDefined();
  });

  it('finds nothing for a resource with no source', async () => {
    await file(lokal, { type: 'NOTE', externalId: 'page-4471' });

    expect(
      await resources.findExternal(lokal, 'web', 'page-4471'),
    ).toBeUndefined();
  });

  it('does not reach across organizations', async () => {
    await file(other, { ...page });

    expect(
      await resources.findExternal(lokal, 'web', 'page-4471'),
    ).toBeUndefined();
  });
});

describe('changing one', () => {
  it('leaves the fields a change does not mention alone', async () => {
    const filed = await file(lokal, { ...page });

    const updated = await resources.update(lokal, filed.id, {
      title: 'Renamed',
    });

    expect(updated.title).toBe('Renamed');
    expect(updated.url).toBe(page.url);
    expect(updated.source).toEqual(page.source);
  });

  it('removes a value given null, rather than blanking it', async () => {
    const filed = await file(lokal, { ...page });

    const updated = await resources.update(lokal, filed.id, {
      title: null,
      url: null,
      source: null,
    });

    expect(updated.title).toBeUndefined();
    expect(updated.url).toBeUndefined();
    expect(updated.source).toBeUndefined();
  });

  it('replaces metadata whole rather than merging it', async () => {
    /*
     * A partial merge would make it impossible to remove a single key. A
     * caller who sends `metadata` has said what it should be; guessing they
     * meant "add to what is there" leaves a stale key behind forever.
     */
    const filed = await file(lokal, {
      type: 'NOTE',
      metadata: { a: 1, b: 2 },
    });

    expect(
      (await resources.update(lokal, filed.id, { metadata: { b: 3 } }))
        .metadata,
    ).toEqual({ b: 3 });
  });

  it('moves updatedAt and leaves createdAt where it was', async () => {
    const filed = await file(lokal, { type: 'NOTE' });

    const updated = await resources.update(lokal, filed.id, { title: 'Named' });

    expect(updated.createdAt).toBe(filed.createdAt);
    expect(updated.updatedAt >= filed.updatedAt).toBe(true);
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      resources.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('who can see what', () => {
  it('shows an organization only its own resources', async () => {
    await file(lokal, { type: 'NOTE', title: 'Ours' });
    await file(other, { type: 'NOTE', title: 'Theirs' });

    expect((await resources.list(lokal)).map((r) => r.title)).toEqual(['Ours']);
    expect((await resources.list(other)).map((r) => r.title)).toEqual([
      'Theirs',
    ]);
  });

  it('gives the same 404 for another organization’s resource as for none', async () => {
    // Telling the two apart would answer "does this id exist somewhere".
    const theirs = await file(other, { type: 'NOTE' });

    await expect(resources.get(lokal, theirs.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update or delete across the boundary', async () => {
    const theirs = await file(other, { type: 'NOTE' });

    await expect(
      resources.update(lokal, theirs.id, { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
    await expect(resources.remove(lokal, theirs.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('keeps the tenant out of what it returns', async () => {
    // It is in the URL of every route that can reach the record.
    expect(await file(lokal, { type: 'NOTE' })).not.toHaveProperty(
      'organizationId',
    );
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', async () => {
    const first = await file(lokal, {
      type: 'NOTE',
      title: 'First',
    });
    await file(lokal, { type: 'NOTE', title: 'Second' });

    await resources.remove(lokal, first.id);

    expect((await resources.list(lokal)).map((r) => r.title)).toEqual([
      'Second',
    ]);
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      resources.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('announcing', () => {
  it('publishes a filed resource under the created key', async () => {
    const filed = await file(lokal, { ...page });

    expect(publisher.published).toHaveLength(1);

    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('resource.created');
    expect(event).toMatchObject({
      type: 'aether:ResourceCreated',
      subject: `urn:aether:resource:${filed.id}`,
      organizationId: 'org-1',
    });
  });

  it('gives the kind as a second @type, not a property', async () => {
    /*
     * So a consumer building a graph gets an `:Email` node it can match on
     * directly, rather than every artefact being a `:Resource` that has to be
     * filtered by a property afterwards.
     */
    await file(lokal, { type: 'EMAIL' });

    expect(publisher.published[0].event.data['@type']).toEqual([
      'aether:Resource',
      'aether:Email',
    ]);
  });

  it('carries the content, which is the whole reason mneme is listening', async () => {
    await file(lokal, {
      type: 'CONVERSATION',
      content: 'So what did we decide?',
    });

    expect(publisher.published[0].event.data.content).toBe(
      'So what did we decide?',
    );
  });

  it('flattens the source rather than nesting it', async () => {
    /*
     * A nested object with no `@id` is a blank node in JSON-LD, not a
     * resource: arachni would give it an invented identity and relate this to
     * a node nothing else can ever match.
     */
    await file(lokal, {
      type: 'EMAIL',
      source: { type: 'gmail', id: 'work@example.test', name: 'Work mail' },
    });

    const { data } = publisher.published[0].event;

    expect(data).toMatchObject({
      sourceType: 'gmail',
      sourceId: 'work@example.test',
      sourceName: 'Work mail',
    });
    expect(data).not.toHaveProperty('source');
  });

  it('keeps metadata off the bus', async () => {
    /*
     * It holds whatever the source wanted, in no agreed vocabulary. Publishing
     * it would put arbitrary keys into a shared graph; it stays available over
     * HTTP to anything that knows what it means.
     */
    await file(lokal, {
      type: 'NOTE',
      metadata: { whatever: 'the source wanted' },
    });

    expect(publisher.published[0].event.data).not.toHaveProperty('metadata');
  });

  it('leaves out what the resource does not say', async () => {
    await file(lokal, { type: 'NOTE' });

    const { data } = publisher.published[0].event;

    expect(data).not.toHaveProperty('title');
    expect(data).not.toHaveProperty('content');
    expect(data).not.toHaveProperty('sourceType');
  });

  it('publishes an update under the updated key', async () => {
    const filed = await file(lokal, { type: 'NOTE' });
    await resources.update(lokal, filed.id, { title: 'Named at last' });

    const { routingKey, event } = publisher.published[1];

    expect(routingKey).toBe('resource.updated');
    expect(event.type).toBe('aether:ResourceUpdated');
    expect(event.data.title).toBe('Named at last');
  });

  it('publishes a delete with no data, since nothing is left to describe', async () => {
    const filed = await file(lokal, { type: 'NOTE' });
    await resources.remove(lokal, filed.id);

    const { routingKey, event } = publisher.published[1];

    expect(routingKey).toBe('resource.deleted');
    expect(event.type).toBe('aether:ResourceDeleted');
    expect(event).not.toHaveProperty('data');
    expect(event.subject).toBe(`urn:aether:resource:${filed.id}`);
  });

  it('says nothing when the change was refused', async () => {
    await expect(
      resources.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);

    expect(publisher.published).toHaveLength(0);
  });

  it('publishes events organon will accept', async () => {
    /*
     * Validated against organon's own schema rather than a copy of it here. A
     * consumer drops what does not parse, and a publisher checked against a
     * local idea of the shape can drift from the one doing the dropping.
     */
    const filed = await file(lokal, { ...page });
    await resources.update(lokal, filed.id, { title: 'Renamed' });
    await resources.remove(lokal, filed.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});

afterEach(() => database.close());

describe('tags and people', () => {
  const ALICE = '55555555-5555-4555-8555-555555555555';

  it('keeps the tags it was filed with, lowercased by the contract', async () => {
    const filed = await file(lokal, { type: 'NOTE', tags: ['graph', 'spec'] });

    expect(filed.tags).toEqual(['graph', 'spec']);
  });

  it('replaces the whole set on update', async () => {
    const filed = await file(lokal, { type: 'NOTE', tags: ['graph'] });

    expect(
      (await resources.update(lokal, filed.id, { tags: ['spec'] })).tags,
    ).toEqual(['spec']);
  });

  it('empties them when sent an empty list', async () => {
    const filed = await file(lokal, { type: 'NOTE', tags: ['graph'] });

    expect(
      (await resources.update(lokal, filed.id, { tags: [] })).tags,
    ).toEqual([]);
  });

  it('leaves them alone when a change does not mention them', async () => {
    const filed = await file(lokal, { type: 'NOTE', tags: ['graph'] });

    expect(
      (await resources.update(lokal, filed.id, { title: 'Named' })).tags,
    ).toEqual(['graph']);
  });

  it('announces tags as words and people as references', async () => {
    /*
     * A tag is a word somebody chose, not a resource in its own right —
     * minting `urn:aether:tag:graph` would invent an identity nothing else can
     * confirm, and arachni would fill the graph with nodes that exist only
     * because they were mentioned.
     */
    await file(lokal, {
      type: 'VIDEO',
      tags: ['graph', 'session'],
      involves: [ALICE],
    });

    const { data } = publisher.published[0].event;

    expect(data.tags).toEqual(['graph', 'session']);
    expect(data.involves).toEqual([{ '@id': `urn:aether:person:${ALICE}` }]);
  });

  it('says nothing about either when there is nothing to say', async () => {
    await file(lokal, { type: 'NOTE' });

    const { data } = publisher.published[0].event;

    expect(data).not.toHaveProperty('tags');
    expect(data).not.toHaveProperty('involves');
  });
});

/*
 * The relations, and what arachni is meant to make of them. The point of the
 * feature is the *edges*, so these assert the document that carries them —
 * a reference that names the wrong IRI scheme lands on a node nothing else
 * has, which no assertion on the row would catch.
 */
describe('relating one to other things', () => {
  const person = '11111111-1111-4111-8111-111111111111';
  const project = '22222222-2222-4222-8222-222222222222';
  const idea = '33333333-3333-4333-8333-333333333333';

  const documentOf = (index = 0) => {
    const { event } = publisher.published[index];

    return event.data as Record<string, { '@id': string }[]>;
  };

  it('keeps the three apart, because they are three different claims', async () => {
    const stored = await file(lokal, {
      type: 'NOTE',
      about: [{ kind: 'PERSON', id: person }],
      relatedTo: [{ kind: 'PROJECT', id: project }],
      mentions: [{ kind: 'IDEA', id: idea }],
    });

    expect(stored.about).toEqual([{ kind: 'PERSON', id: person }]);
    expect(stored.relatedTo).toEqual([{ kind: 'PROJECT', id: project }]);
    expect(stored.mentions).toEqual([{ kind: 'IDEA', id: idea }]);
  });

  /*
   * The whole value of the feature. A reference has to land on the node
   * prosopone or telos already published; a scheme invented here would make a
   * second node beside it, related to nothing.
   */
  it('names each target by the IRI its own domain mints', async () => {
    await file(lokal, {
      type: 'NOTE',
      about: [
        { kind: 'PERSON', id: person },
        { kind: 'GROUP', id: project },
      ],
      relatedTo: [
        { kind: 'PROJECT', id: project },
        { kind: 'GOAL', id: idea },
      ],
      mentions: [
        { kind: 'TASK', id: person },
        { kind: 'IDEA', id: idea },
      ],
    });

    const document = documentOf();

    expect(document.about.map((r) => r['@id'])).toEqual([
      `urn:aether:person:${person}`,
      `urn:aether:group:${project}`,
    ]);
    expect(document.relatedTo.map((r) => r['@id'])).toEqual([
      `urn:aether:project:${project}`,
      `urn:aether:goal:${idea}`,
    ]);
    expect(document.mentions.map((r) => r['@id'])).toEqual([
      `urn:aether:task:${person}`,
      `urn:aether:idea:${idea}`,
    ]);
  });

  /*
   * A bare `{'@id'}` is a *reference* to arachni. An object with anything more
   * is a resource defined inside this document, marked `PART_OF` and deleted
   * with it — so a person a note merely mentions would vanish with the note.
   */
  it('points at targets without claiming to own them', async () => {
    await file(lokal, {
      type: 'NOTE',
      mentions: [{ kind: 'PERSON', id: person }],
    });

    expect(Object.keys(documentOf().mentions[0])).toEqual(['@id']);
  });

  it('says nothing about relations a resource has none of', async () => {
    // Absent means "nothing stated"; an empty array would have arachni write a
    // property it then has to ignore.
    await file(lokal, { type: 'NOTE' });

    const document = documentOf();

    expect(document.about).toBeUndefined();
    expect(document.relatedTo).toBeUndefined();
    expect(document.mentions).toBeUndefined();
  });

  it('replaces a relation set whole rather than merging it', async () => {
    const stored = await file(lokal, {
      type: 'NOTE',
      about: [{ kind: 'PERSON', id: person }],
    });

    const updated = await resources.update(lokal, stored.id, {
      about: [{ kind: 'PROJECT', id: project }],
    });

    expect(updated.about).toEqual([{ kind: 'PROJECT', id: project }]);
  });

  it('empties a set given an empty array', async () => {
    // There is no `null` for these: `[]` already says "none", which is why the
    // schema does not allow one.
    const stored = await file(lokal, {
      type: 'NOTE',
      about: [{ kind: 'PERSON', id: person }],
    });

    const updated = await resources.update(lokal, stored.id, { about: [] });

    expect(updated.about).toEqual([]);
    expect(documentOf(1).about).toBeUndefined();
  });

  it('leaves the other two alone when one is changed', async () => {
    const stored = await file(lokal, {
      type: 'NOTE',
      about: [{ kind: 'PERSON', id: person }],
      mentions: [{ kind: 'IDEA', id: idea }],
    });

    const updated = await resources.update(lokal, stored.id, {
      relatedTo: [{ kind: 'PROJECT', id: project }],
    });

    expect(updated.about).toEqual([{ kind: 'PERSON', id: person }]);
    expect(updated.mentions).toEqual([{ kind: 'IDEA', id: idea }]);
  });

  it('reads a row written before these columns existed as having none', async () => {
    /*
     * `synchronize` adds the columns to a table that already has rows, so they
     * are nullable and every older row reads as null. Null and empty mean the
     * same thing here, and the DTO promises an array.
     */
    const stored = await file(lokal, { type: 'NOTE' });

    await database
      .repository(ResourceEntity)
      .update(
        { id: stored.id },
        { about: null, relatedTo: null, mentions: null },
      );

    const read = await resources.get(lokal, stored.id);

    expect(read.about).toEqual([]);
    expect(read.relatedTo).toEqual([]);
    expect(read.mentions).toEqual([]);
  });

  it('publishes an event organon will accept', async () => {
    await file(lokal, {
      type: 'NOTE',
      about: [{ kind: 'PERSON', id: person }],
    });

    expect(
      aetherEventSchema.safeParse(publisher.published[0].event).success,
    ).toBe(true);
  });
});
