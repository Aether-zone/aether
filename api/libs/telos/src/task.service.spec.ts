import { NotFoundException } from '@nestjs/common';
import type { Actor } from '@aether-zone/organon';

import { ProjectService } from './project.service';
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

let tasks: TaskService;
let projects: ProjectService;

beforeEach(() => {
  projects = new ProjectService();
  tasks = new TaskService(projects);
});

describe('writing one down', () => {
  it('needs only a title', () => {
    const task = tasks.create(lokal, { title: 'Do the thing' });

    expect(task.title).toBe('Do the thing');
    expect(task.projectId).toBeUndefined();
    expect(task.dueAt).toBeUndefined();
  });

  it('starts every task TODO', () => {
    // Writing a task down is not doing it.
    expect(tasks.create(lokal, { title: 'Do the thing' }).status).toBe('TODO');
  });

  it('is not closed to begin with', () => {
    expect(tasks.create(lokal, { title: 'Do the thing' }).closedAt).toBeUndefined();
  });

  it('gives each one an id of its own', () => {
    const first = tasks.create(lokal, { title: 'First' });
    const second = tasks.create(lokal, { title: 'Second' });

    expect(first.id).not.toBe(second.id);
  });
});

describe('belonging to a project', () => {
  const project = () => projects.create(lokal, { title: 'Rebuild the console' });

  it('files the task under it', () => {
    const { id } = project();

    expect(tasks.create(lokal, { title: 'Do the thing', projectId: id }).projectId)
      .toBe(id);
  });

  it('refuses a project nobody holds', () => {
    // Checked rather than stored blindly: an id pointing at nothing shows up
    // as a task filed under a project that cannot be opened.
    expect(() =>
      tasks.create(lokal, {
        title: 'Do the thing',
        projectId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow(NotFoundException);
  });

  it('refuses a project belonging to another organization', () => {
    const theirs = projects.create(other, { title: 'Their work' });

    expect(() =>
      tasks.create(lokal, { title: 'Do the thing', projectId: theirs.id }),
    ).toThrow(NotFoundException);
  });

  it('can be adopted by a project later', () => {
    /*
     * The reason `projectId` is optional. A task gets written down when it
     * occurs to someone, which is usually before anyone has decided which
     * piece of work it belongs to.
     */
    const loose = tasks.create(lokal, { title: 'Do the thing' });
    const { id } = project();

    expect(tasks.update(lokal, loose.id, { projectId: id }).projectId).toBe(id);
  });

  it('can be taken out of one again', () => {
    const { id } = project();
    const task = tasks.create(lokal, { title: 'Do the thing', projectId: id });

    expect(
      tasks.update(lokal, task.id, { projectId: null }).projectId,
    ).toBeUndefined();
  });

  it('names the tasks a project has', () => {
    const { id } = project();
    const first = tasks.create(lokal, { title: 'First', projectId: id });
    tasks.create(lokal, { title: 'Loose' });
    const second = tasks.create(lokal, { title: 'Second', projectId: id });

    expect(tasks.idsInProject(lokal, id)).toEqual([first.id, second.id]);
  });

  it('does not reach across organizations when it does', () => {
    const { id } = project();
    tasks.create(lokal, { title: 'Ours', projectId: id });

    expect(tasks.idsInProject(other, id)).toEqual([]);
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

  it('records when it closed', () => {
    const task = tasks.create(lokal, { title: 'Do the thing' });

    const done = tasks.update(lokal, task.id, { status: 'DONE' });

    expect(done.closedAt).toBeDefined();
  });

  it('counts calling it off as closing it too', () => {
    const task = tasks.create(lokal, { title: 'Do the thing' });

    expect(
      tasks.update(lokal, task.id, { status: 'CANCELLED' }).closedAt,
    ).toBeDefined();
  });

  it('leaves a blocked task open', () => {
    // Blocked is a task that has not happened, not one that will not.
    const task = tasks.create(lokal, { title: 'Do the thing' });

    expect(
      tasks.update(lokal, task.id, { status: 'BLOCKED' }).closedAt,
    ).toBeUndefined();
  });

  it('does not move the closing time when the task is edited afterwards', () => {
    /*
     * The whole reason `closedAt` is stored rather than read from
     * `updatedAt`: renaming a finished task is not finishing it again.
     */
    const task = tasks.create(lokal, { title: 'Do the thing' });
    const { closedAt } = tasks.update(lokal, task.id, { status: 'DONE' });

    jest.advanceTimersByTime(60_000);

    const renamed = tasks.update(lokal, task.id, { title: 'Do the thing well' });

    expect(renamed.closedAt).toBe(closedAt);
    expect(renamed.updatedAt).not.toBe(closedAt);
  });

  it('clears the closing time when a task reopens', () => {
    const task = tasks.create(lokal, { title: 'Do the thing' });
    tasks.update(lokal, task.id, { status: 'DONE' });

    expect(
      tasks.update(lokal, task.id, { status: 'IN_PROGRESS' }).closedAt,
    ).toBeUndefined();
  });

  it('sets a fresh closing time if it is finished again', () => {
    const task = tasks.create(lokal, { title: 'Do the thing' });
    const first = tasks.update(lokal, task.id, { status: 'DONE' });
    tasks.update(lokal, task.id, { status: 'TODO' });

    jest.advanceTimersByTime(60_000);

    const second = tasks.update(lokal, task.id, { status: 'DONE' });

    expect(second.closedAt).toBeDefined();
    expect(second.closedAt).not.toBe(first.closedAt);
  });
});

describe('changing one', () => {
  it('leaves the fields a change does not mention alone', () => {
    const task = tasks.create(lokal, {
      title: 'Do the thing',
      description: 'And do it well',
      priority: 2,
      dueAt: '2026-03-31T22:59:00.000Z',
    });

    const updated = tasks.update(lokal, task.id, { status: 'IN_PROGRESS' });

    expect(updated).toMatchObject({
      description: 'And do it well',
      priority: 2,
      dueAt: '2026-03-31T22:59:00.000Z',
    });
  });

  it('removes a value given null, rather than blanking it', () => {
    const task = tasks.create(lokal, {
      title: 'Do the thing',
      priority: 2,
      dueAt: '2026-03-31T22:59:00.000Z',
    });

    const updated = tasks.update(lokal, task.id, {
      priority: null,
      dueAt: null,
    });

    expect(updated.priority).toBeUndefined();
    expect(updated.dueAt).toBeUndefined();
  });

  it('answers 404 rather than shrugging at an id it does not hold', () => {
    expect(() =>
      tasks.update(lokal, '11111111-1111-4111-8111-111111111111', {
        status: 'DONE',
      }),
    ).toThrow(NotFoundException);
  });
});

describe('who can see what', () => {
  it('shows an organization only its own tasks', () => {
    tasks.create(lokal, { title: 'Ours' });
    tasks.create(other, { title: 'Theirs' });

    expect(tasks.list(lokal).map((task) => task.title)).toEqual(['Ours']);
    expect(tasks.list(other).map((task) => task.title)).toEqual(['Theirs']);
  });

  it('gives the same 404 for another organization’s task as for no task', () => {
    // Telling the two apart would answer "does this id exist somewhere".
    const theirs = tasks.create(other, { title: 'Theirs' });

    expect(() => tasks.get(lokal, theirs.id)).toThrow(NotFoundException);
  });

  it('keeps the tenant out of what it returns', () => {
    // It is in the URL of every route that can reach the record.
    expect(tasks.create(lokal, { title: 'Ours' })).not.toHaveProperty(
      'organizationId',
    );
  });
});

describe('removing', () => {
  it('forgets it and leaves the rest alone', () => {
    const first = tasks.create(lokal, { title: 'First' });
    tasks.create(lokal, { title: 'Second' });

    tasks.remove(lokal, first.id);

    expect(tasks.list(lokal).map((task) => task.title)).toEqual(['Second']);
  });

  it('answers 404 rather than shrugging at an id it does not hold', () => {
    expect(() =>
      tasks.remove(lokal, '11111111-1111-4111-8111-111111111111'),
    ).toThrow(NotFoundException);
  });
});
