import { NotFoundException } from '@nestjs/common';
import type { Actor } from '@aether-zone/organon';

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

let ideas: IdeaService;

beforeEach(() => {
  ideas = new IdeaService();
});

describe('capturing', () => {
  it('needs only a title', () => {
    const created = ideas.create(lokal, thought);

    expect(created.title).toBe(thought.title);
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('starts every idea as CAPTURED', () => {
    // Letting a caller choose would make "written down just now" and "already
    // decided against" indistinguishable at the moment of capture.
    expect(ideas.create(lokal, thought).status).toBe('CAPTURED');
  });

  it('records who wrote it down, from the actor and not the body', () => {
    // A caller that could set this could file an idea under someone else's
    // name; the contract omits it from the create shape for the same reason.
    const created = ideas.create(actorIn('org-1', 'ada'), thought);

    expect(created.createdBy).toBe('ada');
  });

  it('stamps both timestamps the same on the way in', () => {
    const created = ideas.create(lokal, thought);

    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('keeps the organization out of the body', () => {
    expect(ideas.create(lokal, thought)).not.toHaveProperty('organizationId');
  });

  it('allows two ideas with the same title', () => {
    // Nothing here is a natural key: the same thought written twice is two
    // ideas, and refusing the second would lose one of them.
    ideas.create(lokal, thought);
    ideas.create(lokal, thought);

    expect(ideas.list(lokal)).toHaveLength(2);
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s ideas', () => {
    ideas.create(lokal, thought);
    ideas.create(other, { title: 'Somebody else’s' });

    expect(ideas.list(lokal).map((i) => i.title)).toEqual([thought.title]);
    expect(ideas.list(other).map((i) => i.title)).toEqual([
      'Somebody else’s',
    ]);
  });

  it('answers 404 for someone else’s idea', () => {
    const created = ideas.create(lokal, thought);

    expect(() => ideas.get(other, created.id)).toThrow(NotFoundException);
  });

  it('refuses to update or delete across the boundary', () => {
    const created = ideas.create(lokal, thought);

    expect(() => ideas.update(other, created.id, { title: 'X' })).toThrow(
      NotFoundException,
    );
    expect(() => ideas.remove(other, created.id)).toThrow(NotFoundException);

    expect(ideas.get(lokal, created.id)).toEqual(created);
  });
});

describe('changing one', () => {
  it('changes only what it was given', () => {
    const created = ideas.create(lokal, {
      ...thought,
      description: 'Kept',
      priority: 2,
    });

    const updated = ideas.update(lokal, created.id, { status: 'PROMOTED' });

    expect(updated).toMatchObject({
      status: 'PROMOTED',
      description: 'Kept',
      priority: 2,
    });
  });

  it('moves updatedAt without touching createdAt', () => {
    const created = ideas.create(lokal, thought);
    const updated = ideas.update(lokal, created.id, { title: 'Renamed' });

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.createdBy).toBe(created.createdBy);
  });

  it('un-ranks an idea when the priority is cleared', () => {
    // "No longer important enough to rank" is a real thing to say, and it is
    // not the same instruction as leaving the ranking alone.
    const created = ideas.create(lokal, { ...thought, priority: 1 });

    expect(ideas.update(lokal, created.id, { priority: null }).priority).toBeUndefined();
  });

  it('leaves the ranking alone when the priority is absent', () => {
    const created = ideas.create(lokal, { ...thought, priority: 1 });

    expect(ideas.update(lokal, created.id, { title: 'Renamed' }).priority).toBe(
      1,
    );
  });

  it('does not move the idea in the list', () => {
    // An edit is not a reordering; a list that reshuffled on every save would
    // make the console jump under the reader.
    ideas.create(lokal, { title: 'First' });
    const second = ideas.create(lokal, { title: 'Second' });

    ideas.update(lokal, second.id, { title: 'Renamed' });

    expect(ideas.list(lokal).map((i) => i.title)).toEqual([
      'First',
      'Renamed',
    ]);
  });

  it('answers 404 for an id it does not hold', () => {
    expect(() =>
      ideas.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', () => {
    const first = ideas.create(lokal, { title: 'First' });
    ideas.create(lokal, { title: 'Second' });

    ideas.remove(lokal, first.id);

    expect(ideas.list(lokal).map((i) => i.title)).toEqual(['Second']);
  });

  it('answers 404 rather than shrugging at an id it does not hold', () => {
    expect(() =>
      ideas.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).toThrow(NotFoundException);
  });
});

describe('the description', () => {
  it('can be added after the fact', () => {
    // Capture asks for a title and nothing else, so this is the only way one
    // ever gets a description at all.
    const idea = ideas.create(lokal, { title: 'A thought' });

    expect(
      ideas.update(lokal, idea.id, { description: 'Why it matters' })
        .description,
    ).toBe('Why it matters');
  });

  it('is left alone by a change that does not mention it', () => {
    const idea = ideas.create(lokal, {
      title: 'A thought',
      description: 'Why it matters',
    });

    expect(
      ideas.update(lokal, idea.id, { status: 'EXPLORING' }).description,
    ).toBe('Why it matters');
  });

  it('is removed by null, not merely blanked', () => {
    const idea = ideas.create(lokal, {
      title: 'A thought',
      description: 'Why it matters',
    });

    expect(
      ideas.update(lokal, idea.id, { description: null }).description,
    ).toBeUndefined();
  });
});
