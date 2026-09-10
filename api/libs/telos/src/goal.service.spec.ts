import type { CreateGoalDTO } from '@aether/contract';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Actor } from '@aether-zone/organon';

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
  goals.create(actor, { inspiredBy: [], ...input });

beforeEach(() => {
  ideas = new IdeaService();
  goals = new GoalService(ideas);
});

describe('setting one', () => {
  it('needs only a title', () => {
    const created = set(lokal, { title: 'Ship it' });

    expect(created.title).toBe('Ship it');
    expect(created.startsAt).toBeUndefined();
    expect(created.targetAt).toBeUndefined();
  });

  it('starts every goal ACTIVE', () => {
    // Setting one you have already abandoned is not a thing anyone does.
    expect(set(lokal, ship).status).toBe('ACTIVE');
  });

  it('stamps both timestamps the same on the way in', () => {
    const created = set(lokal, ship);

    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('keeps the organization out of the body', () => {
    expect(set(lokal, ship)).not.toHaveProperty('organizationId');
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s goals', () => {
    set(lokal, ship);
    set(other, { title: 'Somebody else’s' });

    expect(goals.list(lokal).map((g) => g.title)).toEqual(['Ship the console']);
    expect(goals.list(other).map((g) => g.title)).toEqual(['Somebody else’s']);
  });

  it('answers 404 for someone else’s goal', () => {
    const created = set(lokal, ship);

    expect(() => goals.get(other, created.id)).toThrow(NotFoundException);
  });

  it('refuses to update or delete across the boundary', () => {
    const created = set(lokal, ship);

    expect(() => goals.update(other, created.id, { title: 'X' })).toThrow(
      NotFoundException,
    );
    expect(() => goals.remove(other, created.id)).toThrow(NotFoundException);
    expect(goals.get(lokal, created.id)).toEqual(created);
  });
});

describe('the dates, on update', () => {
  it('compares them after merging, not before', () => {
    /*
     * The schema cannot do this: a partial update may carry one date and not
     * the other, and the second is known only once merged with what is stored.
     */
    const created = set(lokal, ship);

    expect(() =>
      goals.update(lokal, created.id, {
        targetAt: '2025-01-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('allows a change that is only invalid against the old value', () => {
    // Moving both at once must work: checking the new target against the old
    // start would reject a perfectly good reschedule.
    const created = set(lokal, ship);

    const moved = goals.update(lokal, created.id, {
      startsAt: '2025-06-01T09:00:00.000Z',
      targetAt: '2025-09-01T09:00:00.000Z',
    });

    expect(moved.targetAt).toBe('2025-09-01T09:00:00.000Z');
  });

  it('removes a deadline when it is cleared', () => {
    // "This no longer has a deadline" is a real thing to say.
    const created = set(lokal, ship);

    expect(goals.update(lokal, created.id, { targetAt: null }).targetAt).toBeUndefined();
  });

  it('leaves a date alone when it is absent', () => {
    const created = set(lokal, ship);

    expect(goals.update(lokal, created.id, { title: 'Renamed' }).targetAt).toBe(
      ship.targetAt,
    );
  });

  it('accepts a target once the start is gone', () => {
    // With no start there is nothing to be earlier than.
    const created = set(lokal, ship);

    goals.update(lokal, created.id, { startsAt: null });

    expect(
      goals.update(lokal, created.id, {
        targetAt: '2020-01-01T00:00:00.000Z',
      }).targetAt,
    ).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('changing one', () => {
  it('moves updatedAt without touching createdAt', () => {
    const created = set(lokal, ship);
    const updated = goals.update(lokal, created.id, { status: 'COMPLETED' });

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.status).toBe('COMPLETED');
  });

  it('does not move the goal in the list', () => {
    set(lokal, { title: 'First' });
    const second = set(lokal, { title: 'Second' });

    goals.update(lokal, second.id, { title: 'Renamed' });

    expect(goals.list(lokal).map((g) => g.title)).toEqual(['First', 'Renamed']);
  });

  it('answers 404 for an id it does not hold', () => {
    expect(() =>
      goals.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', () => {
    const first = set(lokal, { title: 'First' });
    set(lokal, { title: 'Second' });

    goals.remove(lokal, first.id);

    expect(goals.list(lokal).map((g) => g.title)).toEqual(['Second']);
  });

  it('answers 404 rather than shrugging at an id it does not hold', () => {
    expect(() =>
      goals.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).toThrow(NotFoundException);
  });
});

describe('what inspired a goal', () => {
  const capture = (actor: Actor, title: string) =>
    ideas.create(actor, { title });

  it('records the ideas it came from', () => {
    const idea = capture(lokal, 'A thought');

    expect(set(lokal, { title: 'Ship it', inspiredBy: [idea.id] }).inspiredBy)
      .toEqual([idea.id]);
  });

  it('refuses an idea nobody holds', () => {
    // Checked rather than stored blindly: an id that resolves to nothing would
    // read as a broken link on the idea's page, with no way to tell whether
    // the idea was deleted or never existed.
    expect(() =>
      set(lokal, {
        title: 'Ship it',
        inspiredBy: ['11111111-1111-4111-8111-111111111111'],
      }),
    ).toThrow(NotFoundException);
  });

  it('refuses an idea belonging to another organization', () => {
    const theirs = capture(other, 'Their thought');

    // `IdeaService.get` is scoped to the actor, so this is a 404 and not a
    // 403 — naming it would confirm the id exists somewhere.
    expect(() =>
      set(lokal, { title: 'Ship it', inspiredBy: [theirs.id] }),
    ).toThrow(NotFoundException);
  });

  it('can be changed later, as a whole set', () => {
    const first = capture(lokal, 'First');
    const second = capture(lokal, 'Second');
    const goal = set(lokal, { title: 'Ship it', inspiredBy: [first.id] });

    const updated = goals.update(lokal, goal.id, {
      inspiredBy: [first.id, second.id],
    });

    expect(updated.inspiredBy).toEqual([first.id, second.id]);
  });

  it('checks the ideas on the way in when changed', () => {
    const goal = set(lokal, { title: 'Ship it' });

    expect(() =>
      goals.update(lokal, goal.id, {
        inspiredBy: ['11111111-1111-4111-8111-111111111111'],
      }),
    ).toThrow(NotFoundException);
  });

  it('can be emptied', () => {
    // `[]` is a real value here, not an absent one — the distinction the
    // update shape has to keep, since a missing key means "leave it alone".
    const idea = capture(lokal, 'A thought');
    const goal = set(lokal, { title: 'Ship it', inspiredBy: [idea.id] });

    expect(goals.update(lokal, goal.id, { inspiredBy: [] }).inspiredBy).toEqual(
      [],
    );
  });
});

describe('reading the link backwards', () => {
  it('names the goals an idea led to', () => {
    const idea = ideas.create(lokal, { title: 'A thought' });
    const first = set(lokal, { title: 'First', inspiredBy: [idea.id] });
    set(lokal, { title: 'Unrelated' });
    const second = set(lokal, { title: 'Second', inspiredBy: [idea.id] });

    expect(goals.idsInspiredBy(lokal, idea.id)).toEqual([first.id, second.id]);
  });

  it('is empty for an idea nothing came of', () => {
    const idea = ideas.create(lokal, { title: 'A thought' });

    expect(goals.idsInspiredBy(lokal, idea.id)).toEqual([]);
  });

  it('does not reach across organizations', () => {
    /*
     * The ids are uuids, so another tenant cannot guess one — but this is the
     * read that composes `Idea.inspired`, and a tenant scope that held
     * everywhere except the derived field would be a hole shaped exactly like
     * the thing nobody thinks to test.
     */
    const idea = ideas.create(lokal, { title: 'A thought' });
    set(lokal, { title: 'Ours', inspiredBy: [idea.id] });

    expect(goals.idsInspiredBy(other, idea.id)).toEqual([]);
  });
});
