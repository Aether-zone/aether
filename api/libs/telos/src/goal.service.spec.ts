import type { CreateGoalDTO } from '@aether/contract';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { aetherEventSchema, type Actor } from '@aether-zone/organon';

import { TestDatabase } from '../../test-database';
import { GoalEntity } from './goal.entity';
import { IdeaEntity } from './idea.entity';
import { GoalService } from './goal.service';
import { IdeaService } from './idea.service';

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

const ship = {
  title: 'Ship the console',
  startsAt: '2026-01-01T09:00:00.000Z',
  targetAt: '2026-03-31T23:59:00.000Z',
};

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

let goals: GoalService;
let ideas: IdeaService;

/**
 * Sets a goal the way the controller does.
 *
 * `inspiredBy` has a default in the schema, so a request may leave it out —
 * but the service is handed input the pipe has already parsed, and by then the
 * empty array is there. Supplying it here keeps these tests calling the
 * service the way anything real does, without restating it thirteen times.
 */
const set = (actor: Actor, input: Partial<CreateGoalDTO> & { title: string }) =>
  goals.create(actor, {
    inspiredBy: [],
    involves: [],
    sources: [],
    scheduled: [],
    ...input,
  });

beforeEach(async () => {
  database = await TestDatabase.open(GoalEntity, IdeaEntity);
  publisher = new RecordingPublisher();
  ideas = new IdeaService(database.repository(IdeaEntity), publisher as any);
  goals = new GoalService(
    database.repository(GoalEntity),
    ideas,
    publisher as any,
  );
});

describe('setting one', () => {
  it('needs only a title', async () => {
    const created = await set(lokal, { title: 'Ship it' });

    expect(created.title).toBe('Ship it');
    expect(created.startsAt).toBeUndefined();
    expect(created.targetAt).toBeUndefined();
  });

  it('starts every goal ACTIVE', async () => {
    // Setting one you have already abandoned is not a thing anyone does.
    expect((await set(lokal, ship)).status).toBe('ACTIVE');
  });

  it('stamps both timestamps the same on the way in', async () => {
    const created = await set(lokal, ship);

    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('keeps the organization out of the body', async () => {
    expect(await set(lokal, ship)).not.toHaveProperty('organizationId');
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s goals', async () => {
    await set(lokal, ship);
    await set(other, { title: 'Somebody else’s' });

    expect((await goals.list(lokal)).map((g) => g.title)).toEqual([
      'Ship the console',
    ]);
    expect((await goals.list(other)).map((g) => g.title)).toEqual([
      'Somebody else’s',
    ]);
  });

  it('answers 404 for someone else’s goal', async () => {
    const created = await set(lokal, ship);

    await expect(goals.get(other, created.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update or delete across the boundary', async () => {
    const created = await set(lokal, ship);

    await expect(
      goals.update(other, created.id, { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
    await expect(goals.remove(other, created.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(await goals.get(lokal, created.id)).toEqual(created);
  });
});

describe('the dates, on update', () => {
  it('compares them after merging, not before', async () => {
    /*
     * The schema cannot do this: a partial update may carry one date and not
     * the other, and the second is known only once merged with what is stored.
     */
    const created = await set(lokal, ship);

    await expect(
      goals.update(lokal, created.id, {
        targetAt: '2025-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows a change that is only invalid against the old value', async () => {
    // Moving both at once must work: checking the new target against the old
    // start would reject a perfectly good reschedule.
    const created = await set(lokal, ship);

    const moved = await goals.update(lokal, created.id, {
      startsAt: '2025-06-01T09:00:00.000Z',
      targetAt: '2025-09-01T09:00:00.000Z',
    });

    expect(moved.targetAt).toBe('2025-09-01T09:00:00.000Z');
  });

  it('removes a deadline when it is cleared', async () => {
    // "This no longer has a deadline" is a real thing to say.
    const created = await set(lokal, ship);

    expect(
      (await goals.update(lokal, created.id, { targetAt: null })).targetAt,
    ).toBeUndefined();
  });

  it('leaves a date alone when it is absent', async () => {
    const created = await set(lokal, ship);

    expect(
      (await goals.update(lokal, created.id, { title: 'Renamed' })).targetAt,
    ).toBe(ship.targetAt);
  });

  it('accepts a target once the start is gone', async () => {
    // With no start there is nothing to be earlier than.
    const created = await set(lokal, ship);

    await goals.update(lokal, created.id, { startsAt: null });

    expect(
      (
        await goals.update(lokal, created.id, {
          targetAt: '2020-01-01T00:00:00.000Z',
        })
      ).targetAt,
    ).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('changing one', () => {
  it('moves updatedAt without touching createdAt', async () => {
    const created = await set(lokal, ship);
    const updated = await goals.update(lokal, created.id, {
      status: 'COMPLETED',
    });

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.status).toBe('COMPLETED');
  });

  it('does not move the goal in the list', async () => {
    await set(lokal, { title: 'First' });
    const second = await set(lokal, { title: 'Second' });

    await goals.update(lokal, second.id, { title: 'Renamed' });

    expect((await goals.list(lokal)).map((g) => g.title)).toEqual([
      'First',
      'Renamed',
    ]);
  });

  it('answers 404 for an id it does not hold', async () => {
    await expect(
      goals.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', async () => {
    const first = await set(lokal, { title: 'First' });
    await set(lokal, { title: 'Second' });

    await goals.remove(lokal, first.id);

    expect((await goals.list(lokal)).map((g) => g.title)).toEqual(['Second']);
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      goals.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow(NotFoundException);
  });
});

/** An idea for a goal to have come from. */
const capture = (actor: Actor, title: string) =>
  ideas.create(actor, { title, involves: [] });

describe('what inspired a goal', () => {
  it('records the ideas it came from', async () => {
    const idea = await capture(lokal, 'A thought');

    expect(
      (await set(lokal, { title: 'Ship it', inspiredBy: [idea.id] }))
        .inspiredBy,
    ).toEqual([idea.id]);
  });

  it('refuses an idea nobody holds', async () => {
    // Checked rather than stored blindly: an id that resolves to nothing would
    // read as a broken link on the idea's page, with no way to tell whether
    // the idea was deleted or never existed.
    await expect(
      set(lokal, {
        title: 'Ship it',
        inspiredBy: ['11111111-1111-4111-8111-111111111111'],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses an idea belonging to another organization', async () => {
    const theirs = await capture(other, 'Their thought');

    // `IdeaService.get` is scoped to the actor, so this is a 404 and not a
    // 403 — naming it would confirm the id exists somewhere.
    await expect(
      set(lokal, { title: 'Ship it', inspiredBy: [theirs.id] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('can be changed later, as a whole set', async () => {
    const first = await capture(lokal, 'First');
    const second = await capture(lokal, 'Second');
    const goal = await set(lokal, { title: 'Ship it', inspiredBy: [first.id] });

    const updated = await goals.update(lokal, goal.id, {
      inspiredBy: [first.id, second.id],
    });

    expect(updated.inspiredBy).toEqual([first.id, second.id]);
  });

  it('checks the ideas on the way in when changed', async () => {
    const goal = await set(lokal, { title: 'Ship it' });

    await expect(
      goals.update(lokal, goal.id, {
        inspiredBy: ['11111111-1111-4111-8111-111111111111'],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('can be emptied', async () => {
    // `[]` is a real value here, not an absent one — the distinction the
    // update shape has to keep, since a missing key means "leave it alone".
    const idea = await capture(lokal, 'A thought');
    const goal = await set(lokal, { title: 'Ship it', inspiredBy: [idea.id] });

    expect(
      (await goals.update(lokal, goal.id, { inspiredBy: [] })).inspiredBy,
    ).toEqual([]);
  });
});

describe('reading the link backwards', () => {
  it('names the goals an idea led to', async () => {
    const idea = await capture(lokal, 'A thought');
    const first = await set(lokal, { title: 'First', inspiredBy: [idea.id] });
    await set(lokal, { title: 'Unrelated' });
    const second = await set(lokal, { title: 'Second', inspiredBy: [idea.id] });

    expect(await goals.idsInspiredBy(lokal, idea.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('is empty for an idea nothing came of', async () => {
    const idea = await capture(lokal, 'A thought');

    expect(await goals.idsInspiredBy(lokal, idea.id)).toEqual([]);
  });

  it('does not reach across organizations', async () => {
    /*
     * The ids are uuids, so another tenant cannot guess one — but this is the
     * read that composes `Idea.inspired`, and a tenant scope that held
     * everywhere except the derived field would be a hole shaped exactly like
     * the thing nobody thinks to test.
     */
    const idea = await capture(lokal, 'A thought');
    await set(lokal, { title: 'Ours', inspiredBy: [idea.id] });

    expect(await goals.idsInspiredBy(other, idea.id)).toEqual([]);
  });
});

describe('announcing', () => {
  const keyed = (key: string) =>
    publisher.published.filter((p) => p.routingKey === key);

  it('publishes a created goal under the created key', async () => {
    const goal = await set(lokal, { title: 'Ship it' });

    const [{ event }] = keyed('goal.created');

    expect(event).toMatchObject({
      type: 'aether:ResourceCreated',
      subject: `urn:aether:goal:${goal.id}`,
      organizationId: 'org-1',
    });
    expect(event.data).toMatchObject({
      '@type': 'aether:Goal',
      title: 'Ship it',
      status: 'ACTIVE',
    });
  });

  it('names the ideas it came from as references, not nested ideas', async () => {
    /*
     * An idea outlives the goal it inspired. Nesting it would tell a consumer
     * it is *part of* the goal, which is what decides whether it gets deleted
     * along with it.
     */
    const idea = await capture(lokal, 'A thought');
    await set(lokal, { title: 'Ship it', inspiredBy: [idea.id] });

    expect(keyed('goal.created')[0].event.data.inspiredBy).toEqual([
      { '@id': `urn:aether:idea:${idea.id}` },
    ]);
  });

  it('leaves the link out entirely when nothing inspired it', async () => {
    // An empty list asserts "nothing inspired this", which is a different
    // claim from not mentioning it.
    await set(lokal, { title: 'Ship it' });

    expect(keyed('goal.created')[0].event.data).not.toHaveProperty(
      'inspiredBy',
    );
  });

  it('publishes a delete with no data', async () => {
    const goal = await set(lokal, { title: 'Ship it' });
    await goals.remove(lokal, goal.id);

    const [{ event }] = keyed('goal.deleted');

    expect(event.type).toBe('aether:ResourceDeleted');
    expect(event).not.toHaveProperty('data');
  });

  it('says nothing when the goal was refused', async () => {
    await expect(
      set(lokal, {
        title: 'Ship it',
        inspiredBy: ['11111111-1111-4111-8111-111111111111'],
      }),
    ).rejects.toThrow(NotFoundException);

    expect(keyed('goal.created')).toHaveLength(0);
  });

  it('publishes events organon will accept', async () => {
    const idea = await capture(lokal, 'A thought');
    const goal = await set(lokal, { title: 'Ship it', inspiredBy: [idea.id] });
    await goals.update(lokal, goal.id, { status: 'COMPLETED' });
    await goals.remove(lokal, goal.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});

describe('a goal’s own facts', () => {
  const ALICE = '55555555-5555-4555-8555-555555555555';

  it('starts ACTIVE, not PLANNED', async () => {
    /*
     * Setting a goal is committing to it. `PLANNED` is for one deliberately
     * parked, which is something a person does on purpose rather than a state
     * to default into.
     */
    expect((await set(lokal, { title: 'Ship it' })).status).toBe('ACTIVE');
  });

  it('can be parked', async () => {
    const goal = await set(lokal, { title: 'Ship it' });

    expect(
      (await goals.update(lokal, goal.id, { status: 'PLANNED' })).status,
    ).toBe('PLANNED');
  });

  it('starts at no progress, whatever the caller says', async () => {
    // A goal set at 80% is a claim about work that does not exist.
    expect((await set(lokal, { title: 'Ship it' })).progress).toBe(0);
  });

  it('moves its progress', async () => {
    const goal = await set(lokal, { title: 'Ship it' });

    expect(
      (await goals.update(lokal, goal.id, { progress: 40 })).progress,
    ).toBe(40);
  });

  it('keeps the people it is about', async () => {
    const goal = await set(lokal, { title: 'Help Alice', involves: [ALICE] });

    expect(goal.involves).toEqual([ALICE]);
  });

  it('un-ranks with null and leaves the rank alone when unmentioned', async () => {
    const goal = await set(lokal, { title: 'Ship it', priority: 1 });

    expect(
      (await goals.update(lokal, goal.id, { title: 'Renamed' })).priority,
    ).toBe(1);
    expect(
      (await goals.update(lokal, goal.id, { priority: null })).priority,
    ).toBeUndefined();
  });

  it('announces the people, the rank and the progress', async () => {
    await set(lokal, {
      title: 'Help Alice',
      involves: [ALICE],
      priority: 2,
    });

    const { data } = publisher.published[0].event;

    expect(data.involves).toEqual([{ '@id': `urn:aether:person:${ALICE}` }]);
    expect(data.priority).toBe(2);
    // Always stated, including zero: "no progress" is a fact about the goal.
    expect(data.progress).toBe(0);
  });
});

afterEach(() => database.close());
