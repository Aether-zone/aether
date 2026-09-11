import { BadRequestException, NotFoundException } from '@nestjs/common';
import { aetherEventSchema, type Actor } from '@aether-zone/organon';

import type { CreateProjectDTO } from '@aether/contract';

import { TestDatabase } from '../../test-database';
import { ProjectEntity } from './project.entity';
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

let projects: ProjectService;

/**
 * Starts one the way the controller does.
 *
 * `pursues` has a default in the schema, so a request may leave it out — but
 * the service is handed input the pipe has already parsed, and by then the
 * empty array is there.
 */
const start = (
  actor: Actor,
  input: Partial<CreateProjectDTO> & { title: string },
) => projects.create(actor, { pursues: [], involves: [], ...input });

beforeEach(async () => {
  database = await TestDatabase.open(ProjectEntity);
  publisher = new RecordingPublisher();
  projects = new ProjectService(
    database.repository(ProjectEntity),
    publisher as any,
  );
});

describe('starting one', () => {
  it('needs only a title', async () => {
    const created = await start(lokal, { title: 'Rebuild it' });

    expect(created.title).toBe('Rebuild it');
    expect(created.startsAt).toBeUndefined();
    expect(created.targetAt).toBeUndefined();
  });

  it('starts every project PLANNED', async () => {
    /*
     * Where a project differs from a goal, which begins ACTIVE: writing a
     * project down is planning it, and the work has not begun.
     */
    expect((await start(lokal, ship)).status).toBe('PLANNED');
  });

  it('stamps both timestamps the same on the way in', async () => {
    const created = await start(lokal, ship);

    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('keeps the organization out of the body', async () => {
    expect(await start(lokal, ship)).not.toHaveProperty('organizationId');
  });
});

describe('tenant isolation', () => {
  it('lists only this organization’s projects', async () => {
    await start(lokal, ship);
    await start(other, { title: 'Somebody else’s' });

    expect((await projects.list(lokal)).map((g) => g.title)).toEqual([
      'Rebuild the console',
    ]);
    expect((await projects.list(other)).map((g) => g.title)).toEqual([
      'Somebody else’s',
    ]);
  });

  it('answers 404 for someone else’s project', async () => {
    const created = await start(lokal, ship);

    await expect(projects.get(other, created.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update or delete across the boundary', async () => {
    const created = await start(lokal, ship);

    await expect(
      projects.update(other, created.id, { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
    await expect(projects.remove(other, created.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(await projects.get(lokal, created.id)).toEqual(created);
  });
});

describe('the dates, on update', () => {
  it('compares them after merging, not before', async () => {
    /*
     * The schema cannot do this: a partial update may carry one date and not
     * the other, and the second is known only once merged with what is stored.
     */
    const created = await start(lokal, ship);

    await expect(
      projects.update(lokal, created.id, {
        targetAt: '2025-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows a change that is only invalid against the old value', async () => {
    // Moving both at once must work: checking the new target against the old
    // start would reject a perfectly good reschedule.
    const created = await start(lokal, ship);

    const moved = await projects.update(lokal, created.id, {
      startsAt: '2025-06-01T09:00:00.000Z',
      targetAt: '2025-09-01T09:00:00.000Z',
    });

    expect(moved.targetAt).toBe('2025-09-01T09:00:00.000Z');
  });

  it('removes a deadline when it is cleared', async () => {
    // "This no longer has a deadline" is a real thing to say.
    const created = await start(lokal, ship);

    expect(
      (await projects.update(lokal, created.id, { targetAt: null })).targetAt,
    ).toBeUndefined();
  });

  it('leaves a date alone when it is absent', async () => {
    const created = await start(lokal, ship);

    expect(
      (await projects.update(lokal, created.id, { title: 'Renamed' })).targetAt,
    ).toBe(ship.targetAt);
  });

  it('accepts a target once the start is gone', async () => {
    // With no start there is nothing to be earlier than.
    const created = await start(lokal, ship);

    await projects.update(lokal, created.id, { startsAt: null });

    expect(
      (
        await projects.update(lokal, created.id, {
          targetAt: '2020-01-01T00:00:00.000Z',
        })
      ).targetAt,
    ).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('changing one', () => {
  it('moves updatedAt without touching createdAt', async () => {
    const created = await start(lokal, ship);
    const updated = await projects.update(lokal, created.id, {
      status: 'ACTIVE',
    });

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.status).toBe('ACTIVE');
  });

  it('does not move the project in the list', async () => {
    await start(lokal, { title: 'First' });
    const second = await start(lokal, { title: 'Second' });

    await projects.update(lokal, second.id, { title: 'Renamed' });

    expect((await projects.list(lokal)).map((g) => g.title)).toEqual([
      'First',
      'Renamed',
    ]);
  });

  it('answers 404 for an id it does not hold', async () => {
    await expect(
      projects.update(lokal, '11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', async () => {
    const first = await start(lokal, { title: 'First' });
    await start(lokal, { title: 'Second' });

    await projects.remove(lokal, first.id);

    expect((await projects.list(lokal)).map((g) => g.title)).toEqual([
      'Second',
    ]);
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      projects.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('announcing', () => {
  it('publishes a created project under the created key', async () => {
    const project = await start(lokal, ship);

    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('project.created');
    expect(event).toMatchObject({
      type: 'aether:ResourceCreated',
      subject: `urn:aether:project:${project.id}`,
      organizationId: 'org-1',
    });
    expect(event.data).toMatchObject({
      '@type': 'aether:Project',
      status: 'PLANNED',
    });
  });

  it('publishes a delete with no data', async () => {
    const project = await start(lokal, ship);
    await projects.remove(lokal, project.id);

    const { routingKey, event } = publisher.published[1];

    expect(routingKey).toBe('project.deleted');
    expect(event).not.toHaveProperty('data');
  });

  it('says nothing when the change was refused', async () => {
    const project = await start(lokal, ship);
    publisher.published.length = 0;

    await expect(
      projects.update(lokal, project.id, {
        targetAt: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(publisher.published).toHaveLength(0);
  });

  it('publishes events organon will accept', async () => {
    const project = await start(lokal, ship);
    await projects.update(lokal, project.id, { status: 'ACTIVE' });
    await projects.remove(lokal, project.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});

describe('what a project is for', () => {
  const GOAL = '77777777-7777-4777-8777-777777777777';

  it('records the goals it pursues', async () => {
    expect(
      (await start(lokal, { title: 'Rebuild it', pursues: [GOAL] })).pursues,
    ).toEqual([GOAL]);
  });

  it('names the projects pursuing a goal, read from the other end', async () => {
    const first = await start(lokal, { title: 'First', pursues: [GOAL] });
    await start(lokal, { title: 'Unrelated' });
    const second = await start(lokal, { title: 'Second', pursues: [GOAL] });

    expect(await projects.idsPursuing(lokal, GOAL)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('is empty for a goal nothing is being done about', async () => {
    expect(await projects.idsPursuing(lokal, GOAL)).toEqual([]);
  });

  it('does not reach across organizations', async () => {
    /*
     * This is the read that composes `Goal.realizedBy`, and a tenant scope
     * that held everywhere except the derived field would be a hole shaped
     * exactly like the thing nobody thinks to test.
     */
    await start(lokal, { title: 'Ours', pursues: [GOAL] });

    expect(await projects.idsPursuing(other, GOAL)).toEqual([]);
  });

  it('can be detached from every goal', async () => {
    const project = await start(lokal, {
      title: 'Rebuild it',
      pursues: [GOAL],
    });

    expect(
      (await projects.update(lokal, project.id, { pursues: [] })).pursues,
    ).toEqual([]);
  });
});

afterEach(() => database.close());
