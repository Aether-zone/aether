import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Actor } from '@aether-zone/organon';

import { ProjectService } from './project.service';

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
  title: 'Rebuild the console',
  startsAt: '2026-01-01T09:00:00.000Z',
  targetAt: '2026-03-31T23:59:00.000Z',
};

let projects: ProjectService;

beforeEach(() => {
  projects = new ProjectService();
});

describe('starting one', () => {
  it('needs only a title', () => {
    const created = projects.create(lokal, { title: 'Rebuild it' });

    expect(created.title).toBe('Rebuild it');
    expect(created.startsAt).toBeUndefined();
    expect(created.targetAt).toBeUndefined();
  });

  it('starts every project PLANNED', () => {
    /*
     * Where a project differs from a goal, which begins ACTIVE: writing a
     * project down is planning it, and the work has not begun.
     */
    expect(projects.create(lokal, ship).status).toBe('PLANNED');
  });

  it('stamps both timestamps the same on the way in', () => {
    const created = projects.create(lokal, ship);

    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('keeps the organization out of the body', () => {
    expect(projects.create(lokal, ship)).not.toHaveProperty('organizationId');
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s projects', () => {
    projects.create(lokal, ship);
    projects.create(other, { title: 'Somebody else’s' });

    expect(projects.list(lokal).map((g) => g.title)).toEqual(['Rebuild the console']);
    expect(projects.list(other).map((g) => g.title)).toEqual(['Somebody else’s']);
  });

  it('answers 404 for someone else’s project', () => {
    const created = projects.create(lokal, ship);

    expect(() => projects.get(other, created.id)).toThrow(NotFoundException);
  });

  it('refuses to update or delete across the boundary', () => {
    const created = projects.create(lokal, ship);

    expect(() => projects.update(other, created.id, { title: 'X' })).toThrow(
      NotFoundException,
    );
    expect(() => projects.remove(other, created.id)).toThrow(NotFoundException);
    expect(projects.get(lokal, created.id)).toEqual(created);
  });
});

describe('the dates, on update', () => {
  it('compares them after merging, not before', () => {
    /*
     * The schema cannot do this: a partial update may carry one date and not
     * the other, and the second is known only once merged with what is stored.
     */
    const created = projects.create(lokal, ship);

    expect(() =>
      projects.update(lokal, created.id, {
        targetAt: '2025-01-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('allows a change that is only invalid against the old value', () => {
    // Moving both at once must work: checking the new target against the old
    // start would reject a perfectly good reschedule.
    const created = projects.create(lokal, ship);

    const moved = projects.update(lokal, created.id, {
      startsAt: '2025-06-01T09:00:00.000Z',
      targetAt: '2025-09-01T09:00:00.000Z',
    });

    expect(moved.targetAt).toBe('2025-09-01T09:00:00.000Z');
  });

  it('removes a deadline when it is cleared', () => {
    // "This no longer has a deadline" is a real thing to say.
    const created = projects.create(lokal, ship);

    expect(projects.update(lokal, created.id, { targetAt: null }).targetAt).toBeUndefined();
  });

  it('leaves a date alone when it is absent', () => {
    const created = projects.create(lokal, ship);

    expect(projects.update(lokal, created.id, { title: 'Renamed' }).targetAt).toBe(
      ship.targetAt,
    );
  });

  it('accepts a target once the start is gone', () => {
    // With no start there is nothing to be earlier than.
    const created = projects.create(lokal, ship);

    projects.update(lokal, created.id, { startsAt: null });

    expect(
      projects.update(lokal, created.id, {
        targetAt: '2020-01-01T00:00:00.000Z',
      }).targetAt,
    ).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('changing one', () => {
  it('moves updatedAt without touching createdAt', () => {
    const created = projects.create(lokal, ship);
    const updated = projects.update(lokal, created.id, { status: 'ACTIVE' });

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.status).toBe('ACTIVE');
  });

  it('does not move the project in the list', () => {
    projects.create(lokal, { title: 'First' });
    const second = projects.create(lokal, { title: 'Second' });

    projects.update(lokal, second.id, { title: 'Renamed' });

    expect(projects.list(lokal).map((g) => g.title)).toEqual(['First', 'Renamed']);
  });

  it('answers 404 for an id it does not hold', () => {
    expect(() =>
      projects.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', () => {
    const first = projects.create(lokal, { title: 'First' });
    projects.create(lokal, { title: 'Second' });

    projects.remove(lokal, first.id);

    expect(projects.list(lokal).map((g) => g.title)).toEqual(['Second']);
  });

  it('answers 404 rather than shrugging at an id it does not hold', () => {
    expect(() =>
      projects.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).toThrow(NotFoundException);
  });
});
