import { PRIORITY_MAX, PRIORITY_MIN } from './priority.js';
import { CLOSED_STATUSES, TASK_STATUSES } from './task-status.js';
import { createTaskSchema, taskSchema, updateTaskSchema } from './task.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Wire the goals page to the idea picker',
  description: 'Otherwise the link can only be made against the api.',
  status: 'TODO',
  priority: 2,
  projectId: '22222222-2222-4222-8222-222222222222',
  dueAt: '2026-03-31T22:59:00.000Z',
  createdAt: '2025-12-01T09:00:00.000Z',
  updatedAt: '2025-12-01T09:00:00.000Z',
};

describe('a task', () => {
  it('accepts a complete record', () => {
    expect(taskSchema.parse(valid)).toEqual(valid);
  });

  it('needs nothing but a title and a status', () => {
    const {
      description: _d,
      priority: _p,
      projectId: _pid,
      dueAt: _due,
      ...rest
    } = valid;

    expect(taskSchema.safeParse(rest).success).toBe(true);
  });

  it('may stand alone, outside any project', () => {
    /*
     * The chain reads as though every task belongs to a project, but a task
     * that cannot be written down until a project exists to hang it on is a
     * task that does not get written down.
     */
    const { projectId: _pid, ...loose } = valid;

    expect(taskSchema.parse(loose).projectId).toBeUndefined();
  });

  it('refuses a project reference that is not an id', () => {
    expect(
      taskSchema.safeParse({ ...valid, projectId: 'the console rebuild' })
        .success,
    ).toBe(false);
  });

  it('holds a priority to the same scale an idea uses', () => {
    // One scale across telos, so a 2 means the same thing wherever it appears.
    expect(
      taskSchema.safeParse({ ...valid, priority: PRIORITY_MAX + 1 }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({ ...valid, priority: PRIORITY_MIN - 1 }).success,
    ).toBe(false);
  });

  it('carries a closing time separate from its last change', () => {
    /*
     * `updatedAt` moves for any edit at all. Were "when was this finished"
     * read from it, renaming a finished task would look like finishing it a
     * second time.
     */
    const closed = taskSchema.parse({
      ...valid,
      status: 'DONE',
      closedAt: '2026-02-01T09:00:00.000Z',
      updatedAt: '2026-02-02T09:00:00.000Z',
    });

    expect(closed.closedAt).toBe('2026-02-01T09:00:00.000Z');
  });
});

describe('the states', () => {
  it('tells a task nobody has started from one nobody can', () => {
    // The distinction the whole enum exists for.
    expect(TASK_STATUSES).toContain('TODO');
    expect(TASK_STATUSES).toContain('BLOCKED');
  });

  it('counts both endings as closed, and nothing else', () => {
    expect(CLOSED_STATUSES).toEqual(['DONE', 'CANCELLED']);
  });
});

describe('writing one down', () => {
  it('needs only a title', () => {
    expect(createTaskSchema.parse({ title: 'Do the thing' })).toEqual({
      title: 'Do the thing',
    });
  });

  it('will not let the caller start it finished', () => {
    // Not in the shape, so zod strips it: writing a task down is not doing it.
    const created = createTaskSchema.parse({
      title: 'Do the thing',
      status: 'DONE',
      closedAt: '2026-02-01T09:00:00.000Z',
    });

    expect(created).not.toHaveProperty('status');
    expect(created).not.toHaveProperty('closedAt');
  });

  it('refuses a title that is only whitespace', () => {
    expect(createTaskSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('changing one', () => {
  it('takes each field on its own', () => {
    expect(updateTaskSchema.parse({ status: 'IN_PROGRESS' })).toEqual({
      status: 'IN_PROGRESS',
    });
  });

  it('lets the three removable fields be taken back with null', () => {
    /*
     * Absent means "leave it alone", so without a null there would be no way
     * to say a task is no longer ranked, no longer due, or no longer part of
     * the project it was filed under.
     */
    const cleared = updateTaskSchema.parse({
      priority: null,
      dueAt: null,
      projectId: null,
    });

    expect(cleared).toEqual({ priority: null, dueAt: null, projectId: null });
  });

  it('still holds a null-able field to its rules when given a value', () => {
    expect(updateTaskSchema.safeParse({ priority: 0 }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ dueAt: 'tomorrow' }).success).toBe(
      false,
    );
  });

  it('does not let the caller set the closing time', () => {
    // The api sets it from the status, so that the two cannot disagree.
    expect(
      updateTaskSchema.parse({ closedAt: '2026-02-01T09:00:00.000Z' }),
    ).not.toHaveProperty('closedAt');
  });
});
