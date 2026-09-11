import { NotFoundException } from '@nestjs/common';
import { aetherEventSchema, type Actor } from '@aether-zone/organon';

import type { CreateIdeaDTO } from '@aether/contract';

import { TestDatabase } from '../../test-database';
import { IdeaEntity } from './idea.entity';
import { IdeaService } from './idea.service';

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

const thought = { title: 'Let the console remember a search' };

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

let ideas: IdeaService;

/**
 * Captures one the way the controller does.
 *
 * `involves` has a default in the schema, so a request may leave it out — but
 * the service is handed input the pipe has already parsed, and by then the
 * empty array is there. Supplying it here keeps these tests calling the
 * service the way anything real does.
 */
const capture = (
  actor: Actor,
  input: Partial<CreateIdeaDTO> & { title: string },
) => ideas.create(actor, { involves: [], ...input });

beforeEach(async () => {
  database = await TestDatabase.open(IdeaEntity);
  publisher = new RecordingPublisher();
  ideas = new IdeaService(database.repository(IdeaEntity), publisher as any);
});

describe('capturing', () => {
  it('needs only a title', async () => {
    const created = await capture(lokal, thought);

    expect(created.title).toBe(thought.title);
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('starts every idea as CAPTURED', async () => {
    // Letting a caller choose would make "written down just now" and "already
    // decided against" indistinguishable at the moment of capture.
    expect((await capture(lokal, thought)).status).toBe('CAPTURED');
  });

  it('records who wrote it down, from the actor and not the body', async () => {
    // A caller that could set this could file an idea under someone else's
    // name; the contract omits it from the create shape for the same reason.
    const created = await capture(actorIn('org-1', 'ada'), thought);

    expect(created.createdBy).toBe('ada');
  });

  it('stamps both timestamps the same on the way in', async () => {
    const created = await capture(lokal, thought);

    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('keeps the organization out of the body', async () => {
    expect(await capture(lokal, thought)).not.toHaveProperty('organizationId');
  });

  it('allows two ideas with the same title', async () => {
    // Nothing here is a natural key: the same thought written twice is two
    // ideas, and refusing the second would lose one of them.
    await capture(lokal, thought);
    await capture(lokal, thought);

    expect(await ideas.list(lokal)).toHaveLength(2);
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s ideas', async () => {
    await capture(lokal, thought);
    await capture(other, { title: 'Somebody else’s' });

    expect((await ideas.list(lokal)).map((i) => i.title)).toEqual([
      thought.title,
    ]);
    expect((await ideas.list(other)).map((i) => i.title)).toEqual([
      'Somebody else’s',
    ]);
  });

  it('answers 404 for someone else’s idea', async () => {
    const created = await capture(lokal, thought);

    await expect(ideas.get(other, created.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update or delete across the boundary', async () => {
    const created = await capture(lokal, thought);

    await expect(
      ideas.update(other, created.id, { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
    await expect(ideas.remove(other, created.id)).rejects.toThrow(
      NotFoundException,
    );

    expect(await ideas.get(lokal, created.id)).toEqual(created);
  });
});

describe('changing one', () => {
  it('changes only what it was given', async () => {
    const created = await capture(lokal, {
      ...thought,
      description: 'Kept',
      priority: 2,
    });

    const updated = await ideas.update(lokal, created.id, {
      status: 'PROMOTED',
    });

    expect(updated).toMatchObject({
      status: 'PROMOTED',
      description: 'Kept',
      priority: 2,
    });
  });

  it('moves updatedAt without touching createdAt', async () => {
    const created = await capture(lokal, thought);
    const updated = await ideas.update(lokal, created.id, { title: 'Renamed' });

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.createdBy).toBe(created.createdBy);
  });

  it('un-ranks an idea when the priority is cleared', async () => {
    // "No longer important enough to rank" is a real thing to say, and it is
    // not the same instruction as leaving the ranking alone.
    const created = await capture(lokal, { ...thought, priority: 1 });

    expect(
      (await ideas.update(lokal, created.id, { priority: null })).priority,
    ).toBeUndefined();
  });

  it('leaves the ranking alone when the priority is absent', async () => {
    const created = await capture(lokal, { ...thought, priority: 1 });

    expect(
      (await ideas.update(lokal, created.id, { title: 'Renamed' })).priority,
    ).toBe(1);
  });

  it('does not move the idea in the list', async () => {
    // An edit is not a reordering; a list that reshuffled on every save would
    // make the console jump under the reader.
    await capture(lokal, { title: 'First' });
    const second = await capture(lokal, { title: 'Second' });

    await ideas.update(lokal, second.id, { title: 'Renamed' });

    expect((await ideas.list(lokal)).map((i) => i.title)).toEqual([
      'First',
      'Renamed',
    ]);
  });

  it('answers 404 for an id it does not hold', async () => {
    await expect(
      ideas.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', async () => {
    const first = await capture(lokal, { title: 'First' });
    await capture(lokal, { title: 'Second' });

    await ideas.remove(lokal, first.id);

    expect((await ideas.list(lokal)).map((i) => i.title)).toEqual(['Second']);
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      ideas.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('the description', () => {
  it('can be added after the fact', async () => {
    // Capture asks for a title and nothing else, so this is the only way one
    // ever gets a description at all.
    const idea = await capture(lokal, { title: 'A thought' });

    expect(
      (await ideas.update(lokal, idea.id, { description: 'Why it matters' }))
        .description,
    ).toBe('Why it matters');
  });

  it('is left alone by a change that does not mention it', async () => {
    const idea = await capture(lokal, {
      title: 'A thought',
      description: 'Why it matters',
    });

    expect(
      (await ideas.update(lokal, idea.id, { status: 'EXPLORING' })).description,
    ).toBe('Why it matters');
  });

  it('is removed by null, not merely blanked', async () => {
    const idea = await capture(lokal, {
      title: 'A thought',
      description: 'Why it matters',
    });

    expect(
      (await ideas.update(lokal, idea.id, { description: null })).description,
    ).toBeUndefined();
  });
});

describe('announcing', () => {
  it('publishes a created idea under the created key', async () => {
    const idea = await capture(lokal, thought);

    expect(publisher.published).toHaveLength(1);

    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('idea.created');
    expect(event).toMatchObject({
      type: 'aether:ResourceCreated',
      subject: `urn:aether:idea:${idea.id}`,
      organizationId: 'org-1',
    });
  });

  it('publishes a document anything can read, not the DTO', async () => {
    // The IRI and the vocabulary are the point: a consumer records an idea
    // without depending on this api's HTTP shape.
    await capture(lokal, { title: 'A thought', priority: 2 });

    expect(publisher.published[0].event.data).toMatchObject({
      '@type': 'aether:Idea',
      title: 'A thought',
      status: 'CAPTURED',
      priority: 2,
    });
  });

  it('leaves out what the idea does not say', async () => {
    // Absent means "not stated"; null would assert the idea has no priority.
    await capture(lokal, thought);

    const { data } = publisher.published[0].event;

    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('priority');
  });

  it('does not publish `inspired`, which the goal owns', async () => {
    /*
     * The link is announced once, by the end that holds it. Publishing it from
     * both would put the same fact on the bus from two records written at
     * different moments, which can therefore disagree.
     */
    await capture(lokal, thought);

    expect(publisher.published[0].event.data).not.toHaveProperty('inspired');
  });

  it('publishes an update under the updated key', async () => {
    const idea = await capture(lokal, thought);
    await ideas.update(lokal, idea.id, { status: 'PROMOTED' });

    const { routingKey, event } = publisher.published[1];

    expect(routingKey).toBe('idea.updated');
    expect(event.type).toBe('aether:ResourceUpdated');
    expect(event.data.status).toBe('PROMOTED');
  });

  it('publishes a delete with no data, since nothing is left to describe', async () => {
    const idea = await capture(lokal, thought);
    await ideas.remove(lokal, idea.id);

    const { routingKey, event } = publisher.published[1];

    expect(routingKey).toBe('idea.deleted');
    expect(event.type).toBe('aether:ResourceDeleted');
    expect(event).not.toHaveProperty('data');
    expect(event.subject).toBe(`urn:aether:idea:${idea.id}`);
  });

  it('says nothing when the change was refused', async () => {
    await expect(
      ideas.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);

    expect(publisher.published).toHaveLength(0);
  });

  it('publishes events organon will accept', async () => {
    /*
     * Validated against organon's own schema rather than a copy of it here.
     * A consumer drops what does not parse, and a publisher checked against a
     * local idea of the shape can drift from the one doing the dropping.
     */
    const idea = await capture(lokal, thought);
    await ideas.update(lokal, idea.id, { status: 'EXPLORING' });
    await ideas.remove(lokal, idea.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});

describe('who an idea is about', () => {
  const ALICE = '55555555-5555-4555-8555-555555555555';
  const BOB = '66666666-6666-4666-8666-666666666666';

  it('keeps the people it was captured with', async () => {
    const idea = await capture(lokal, {
      title: 'Ask Alice about the console',
      involves: [ALICE],
    });

    expect(idea.involves).toEqual([ALICE]);
  });

  it('is empty for an idea about nobody in particular', async () => {
    expect((await capture(lokal, { title: 'A thought' })).involves).toEqual([]);
  });

  it('replaces the whole set on update', async () => {
    const idea = await capture(lokal, {
      title: 'A thought',
      involves: [ALICE],
    });

    expect(
      (await ideas.update(lokal, idea.id, { involves: [BOB] })).involves,
    ).toEqual([BOB]);
  });

  it('empties it when sent an empty list', async () => {
    const idea = await capture(lokal, {
      title: 'A thought',
      involves: [ALICE],
    });

    expect(
      (await ideas.update(lokal, idea.id, { involves: [] })).involves,
    ).toEqual([]);
  });

  it('leaves the people alone when a change does not mention them', async () => {
    /*
     * The spread would overwrite them with `undefined` if zod put the key on
     * the parsed object for an absent optional. It does not, and this is the
     * test that says so.
     */
    const idea = await capture(lokal, {
      title: 'A thought',
      involves: [ALICE],
    });

    expect(
      (await ideas.update(lokal, idea.id, { title: 'Renamed' })).involves,
    ).toEqual([ALICE]);
  });

  it('announces them as references to prosopone people', async () => {
    /*
     * Published, unlike `inspired`: nobody but this idea records who it is
     * about, so if this document does not say it, nothing on the bus will.
     */
    await capture(lokal, { title: 'A thought', involves: [ALICE, BOB] });

    expect(publisher.published[0].event.data.involves).toEqual([
      { '@id': `urn:aether:person:${ALICE}` },
      { '@id': `urn:aether:person:${BOB}` },
    ]);
  });

  it('says nothing about people when it is about nobody', async () => {
    // An empty list would assert "this is about nobody", which is a different
    // claim from not mentioning it.
    await capture(lokal, { title: 'A thought' });

    expect(publisher.published[0].event.data).not.toHaveProperty('involves');
  });
});

afterEach(() => database.close());
