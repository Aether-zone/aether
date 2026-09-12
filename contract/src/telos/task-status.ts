import { z } from 'zod';

/**
 * Where a task has got to.
 *
 * Five states, and `BLOCKED` is the one that earns its place. A task nobody
 * has started and a task nobody *can* start look identical in a list that only
 * knows `TODO`, and telling them apart is most of why a task list gets read at
 * all — the blocked ones are where the day actually goes wrong.
 *
 * `DONE` and `CANCELLED` are both endings and both are kept, because they mean
 * opposite things about the work: one says it happened, the other says it
 * turned out not to be needed. Deleting the cancelled ones would lose the
 * second answer, which is usually the more interesting of the two.
 */
export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'CANCELLED',
] as const;

export const taskStatusSchema = z.enum(TASK_STATUSES);

export type TaskStatus = (typeof TASK_STATUSES)[number];

/** The states that mean nothing further will happen. */
export const CLOSED_STATUSES: readonly TaskStatus[] = ['DONE', 'CANCELLED'];
