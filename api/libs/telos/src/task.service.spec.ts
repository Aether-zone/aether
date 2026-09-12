import { NotFoundException } from '@nestjs/common';
import { aetherEventSchema, type Actor } from '@aether-zone/organon';

import { TestDatabase } from '../../test-database';
import { ProjectEntity } from './project.entity';
import { TaskEntity } from './task.entity';
import { ProjectService } from './project.service';
import type { CreateTaskDTO } from '@aether/contract';

import { TaskService } from './task.service';

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

let tasks: TaskService;

/**
 * Writes one down the way the controller does.
 *
 * `involves` has a default in the schema, so a request may leave it out — but
 * the service is handed input the pipe has already parsed, and by then the
 * empty array is there.
 */
const write = (
  actor: Actor,
  input: Partial<CreateTaskDTO> & { title: string },
) => tasks.create(actor, { involves: [], ...input });
let projects: ProjectService;

beforeEach(async () => {
  database = await TestDatabase.open(ProjectEntity, TaskEntity);
  publisher = new RecordingPublisher();
  projects = new ProjectService(
    database.repository(ProjectEntity),
    publisher as any,
  );
  tasks = new TaskService(
    database.repository(TaskEntity),
    projects,
    publisher as any,
  );
});

describe('writing one down', () => {
  it('needs only a title', async () => {
    const task = await write(lokal, { title: 'Do the thing' });

    expect(task.title).toBe('Do the thing');
    expect(task.projectId).toBeUndefined();
    expect(task.dueAt).toBeUndefined();
  });

  it('starts every task TODO', async () => {
    // Writing a task down is not doing it.
    expect((await write(lokal, { title: 'Do the thing' })).status).toBe('TODO');
  });

  it('is not closed to begin with', async () => {
    expect(
      (await write(lokal, { title: 'Do the thing' })).closedAt,
    ).toBeUndefined();
  });

  it('gives each one an id of its own', async () => {
    const first = await write(lokal, { title: 'First' });
    const second = await write(lokal, { title: 'Second' });

    expect(first.id).not.toBe(second.id);
  });
});

describe('belonging to a project', () => {
  const project = () =>
    projects.create(lokal, {
      title: 'Rebuild the console',
      pursues: [],
      involves: [],
    });

  it('files the task under it', async () => {
    const { id } = await project();

    expect(
      (await write(lokal, { title: 'Do the thing', projectId: id })).projectId,
    ).toBe(id);
  });

  it('refuses a project nobody holds', async () => {
    // Checked rather than stored blindly: an id pointing at nothing shows up
    // as a task filed under a project that cannot be opened.
    await expect(
      write(lokal, {
        title: 'Do the thing',
        projectId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses a project belonging to another organization', async () => {
    const theirs = await projects.create(other, {
      title: 'Their work',
      pursues: [],
      involves: [],
    });

    await expect(
      write(lokal, { title: 'Do the thing', projectId: theirs.id }),
    ).rejects.toThrow(NotFoundException);
  });

  it('can be adopted by a project later', async () => {
    /*
     * The reason `projectId` is optional. A task gets written down when it
     * occurs to someone, which is usually before anyone has decided which
     * piece of work it belongs to.
     */
    const loose = await write(lokal, { title: 'Do the thing' });
    const { id } = await project();

    expect(
      (await tasks.update(lokal, loose.id, { projectId: id })).projectId,
    ).toBe(id);
  });

  it('can be taken out of one again', async () => {
    const { id } = await project();
    const task = await write(lokal, {
      title: 'Do the thing',
      projectId: id,
    });

    expect(
      (await tasks.update(lokal, task.id, { projectId: null })).projectId,
    ).toBeUndefined();
  });

  it('names the tasks a project has', async () => {
    const { id } = await project();
    const first = await write(lokal, { title: 'First', projectId: id });
    await write(lokal, { title: 'Loose' });
    const second = await write(lokal, {
      title: 'Second',
      projectId: id,
    });

    expect(await tasks.idsInProject(lokal, id)).toEqual([first.id, second.id]);
  });

  it('does not reach across organizations when it does', async () => {
    const { id } = await project();
    await write(lokal, { title: 'Ours', projectId: id });

    expect(await tasks.idsInProject(other, id)).toEqual([]);
  });
});

describe('finishing one', () => {
  /*
   * A fake clock, because two of these turn on time having passed between two
   * writes — and in real time both land in the same millisecond, which makes
   * the assertion pass or fail on how busy the machine is. Advancing it by
   * hand is the difference between testing the rule and testing the hardware.
   */
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-01T09:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records when it closed', async () => {
    const task = await write(lokal, { title: 'Do the thing' });

    const done = await tasks.update(lokal, task.id, { status: 'DONE' });

    expect(done.closedAt).toBeDefined();
  });

  it('counts calling it off as closing it too', async () => {
    const task = await write(lokal, { title: 'Do the thing' });

    expect(
      (await tasks.update(lokal, task.id, { status: 'CANCELLED' })).closedAt,
    ).toBeDefined();
  });

  it('leaves a blocked task open', async () => {
    // Blocked is a task that has not happened, not one that will not.
    const task = await write(lokal, { title: 'Do the thing' });

    expect(
      (await tasks.update(lokal, task.id, { status: 'BLOCKED' })).closedAt,
    ).toBeUndefined();
  });

  it('does not move the closing time when the task is edited afterwards', async () => {
    /*
     * The whole reason `closedAt` is stored rather than read from
     * `updatedAt`: renaming a finished task is not finishing it again.
     */
    const task = await write(lokal, { title: 'Do the thing' });
    const { closedAt } = await tasks.update(lokal, task.id, { status: 'DONE' });

    jest.advanceTimersByTime(60_000);

    const renamed = await tasks.update(lokal, task.id, {
      title: 'Do the thing well',
    });

    expect(renamed.closedAt).toBe(closedAt);
    expect(renamed.updatedAt).not.toBe(closedAt);
  });

  it('clears the closing time when a task reopens', async () => {
    const task = await write(lokal, { title: 'Do the thing' });
    await tasks.update(lokal, task.id, { status: 'DONE' });

    expect(
      (await tasks.update(lokal, task.id, { status: 'IN_PROGRESS' })).closedAt,
    ).toBeUndefined();
  });

  it('sets a fresh closing time if it is finished again', async () => {
    const task = await write(lokal, { title: 'Do the thing' });
    const first = await tasks.update(lokal, task.id, { status: 'DONE' });
    await tasks.update(lokal, task.id, { status: 'TODO' });

    jest.advanceTimersByTime(60_000);

    const second = await tasks.update(lokal, task.id, { status: 'DONE' });

    expect(second.closedAt).toBeDefined();
    expect(second.closedAt).not.toBe(first.closedAt);
  });
});

describe('changing one', () => {
  it('leaves the fields a change does not mention alone', async () => {
    const task = await write(lokal, {
      title: 'Do the thing',
      description: 'And do it well',
      priority: 2,
      dueAt: '2026-03-31T22:59:00.000Z',
    });

    const updated = await tasks.update(lokal, task.id, {
      status: 'IN_PROGRESS',
    });

    expect(updated).toMatchObject({
      description: 'And do it well',
      priority: 2,
      dueAt: '2026-03-31T22:59:00.000Z',
    });
  });

  it('removes a value given null, rather than blanking it', async () => {
    const task = await write(lokal, {
      title: 'Do the thing',
      priority: 2,
      dueAt: '2026-03-31T22:59:00.000Z',
    });

    const updated = await tasks.update(lokal, task.id, {
      priority: null,
      dueAt: null,
    });

    expect(updated.priority).toBeUndefined();
    expect(updated.dueAt).toBeUndefined();
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      tasks.update(lokal, '11111111-1111-4111-8111-111111111111', {
        status: 'DONE',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('who can see what', () => {
  it('shows an organization only its own tasks', async () => {
    await write(lokal, { title: 'Ours' });
    await write(other, { title: 'Theirs' });

    expect((await tasks.list(lokal)).map((task) => task.title)).toEqual([
      'Ours',
    ]);
    expect((await tasks.list(other)).map((task) => task.title)).toEqual([
      'Theirs',
    ]);
  });

  it('gives the same 404 for another organization’s task as for no task', async () => {
    // Telling the two apart would answer "does this id exist somewhere".
    const theirs = await write(other, { title: 'Theirs' });

    await expect(tasks.get(lokal, theirs.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('keeps the tenant out of what it returns', async () => {
    // It is in the URL of every route that can reach the record.
    expect(await write(lokal, { title: 'Ours' })).not.toHaveProperty(
      'organizationId',
    );
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', async () => {
    const first = await write(lokal, { title: 'First' });
    await write(lokal, { title: 'Second' });

    await tasks.remove(lokal, first.id);

    expect((await tasks.list(lokal)).map((task) => task.title)).toEqual([
      'Second',
    ]);
  });

  it('answers 404 rather than shrugging at an id it does not hold', async () => {
    await expect(
      tasks.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('announcing', () => {
  const keyed = (key: string) =>
    publisher.published.filter((p) => p.routingKey === key);

  it('publishes a created task under the created key', async () => {
    const task = await write(lokal, { title: 'Do the thing' });

    const [{ event }] = keyed('task.created');

    expect(event).toMatchObject({
      type: 'aether:ResourceCreated',
      subject: `urn:aether:task:${task.id}`,
      organizationId: 'org-1',
    });
    expect(event.data).toMatchObject({
      '@type': 'aether:Task',
      title: 'Do the thing',
      status: 'TODO',
    });
  });

  it('points at its project as a reference', async () => {
    /*
     * A reference and not a nested project: the project is the thing the task
     * belongs to, not a part of it, and the arrow has to point somewhere a
     * consumer can follow without inferring ownership.
     */
    const { id } = await projects.create(lokal, {
      title: 'Rebuild the console',
      pursues: [],
      involves: [],
    });
    await write(lokal, { title: 'Do the thing', projectId: id });

    expect(keyed('task.created')[0].event.data.project).toEqual({
      '@id': `urn:aether:project:${id}`,
    });
  });

  it('says nothing about a project when the task stands alone', async () => {
    await write(lokal, { title: 'Do the thing' });

    expect(keyed('task.created')[0].event.data).not.toHaveProperty('project');
  });

  it('carries the closing time once the task is finished', async () => {
    const task = await write(lokal, { title: 'Do the thing' });
    await tasks.update(lokal, task.id, { status: 'DONE' });

    const { data } = keyed('task.updated')[0].event;

    expect(data.status).toBe('DONE');
    expect(data.closedAt).toBeDefined();
  });

  it('publishes a delete with no data', async () => {
    const task = await write(lokal, { title: 'Do the thing' });
    await tasks.remove(lokal, task.id);

    expect(keyed('task.deleted')[0].event).not.toHaveProperty('data');
  });

  it('says nothing when the task was refused', async () => {
    await expect(
      write(lokal, {
        title: 'Do the thing',
        projectId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(keyed('task.created')).toHaveLength(0);
  });

  it('publishes events organon will accept', async () => {
    const { id } = await projects.create(lokal, {
      title: 'Rebuild the console',
      pursues: [],
      involves: [],
    });
    const task = await write(lokal, {
      title: 'Do the thing',
      projectId: id,
    });
    await tasks.update(lokal, task.id, { status: 'DONE' });
    await tasks.remove(lokal, task.id);

    for (const { event } of publisher.published) {
      expect(aetherEventSchema.safeParse(event).success).toBe(true);
    }
  });
});

afterEach(() => database.close());

describe('who a task is on', () => {
  const ALICE = '55555555-5555-4555-8555-555555555555';
  const BOB = '66666666-6666-4666-8666-666666666666';

  it('records the people it was written down against', async () => {
    expect(
      (await write(lokal, { title: 'Review the intake', involves: [ALICE] }))
        .involves,
    ).toEqual([ALICE]);
  });

  it('takes more than one, because work gets shared', async () => {
    const task = await write(lokal, {
      title: 'Review the intake',
      involves: [ALICE, BOB],
    });

    expect(task.involves).toHaveLength(2);
  });

  it('is empty for a task on nobody in particular', async () => {
    expect((await write(lokal, { title: 'Do the thing' })).involves).toEqual(
      [],
    );
  });

  it('is replaced as a whole set on update', async () => {
    const task = await write(lokal, { title: 'Do it', involves: [ALICE] });

    expect(
      (await tasks.update(lokal, task.id, { involves: [BOB] })).involves,
    ).toEqual([BOB]);
  });

  it('announces them as references to prosopone people', async () => {
    await write(lokal, { title: 'Do it', involves: [ALICE] });

    expect(publisher.published[0].event.data.involves).toEqual([
      { '@id': `urn:aether:person:${ALICE}` },
    ]);
  });
});
