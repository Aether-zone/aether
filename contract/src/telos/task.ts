import { z } from 'zod';

import { prioritySchema } from './priority.js';
import { taskStatusSchema } from './task-status.js';

/**
 * Something to be done.
 *
 * The last step in telos's chain — an idea becomes a goal, a goal is pursued
 * by a project, a project is done through tasks — and the only step where
 * anything actually gets finished.
 *
 * `projectId` is **optional**, which is the one design decision here worth
 * arguing. The chain reads as though every task belongs to a project, but
 * requiring one would mean you cannot write a task down until you have
 * invented a project to hang it on. That is the same friction idea capture
 * deliberately refuses, and it produces the same outcome: the task does not
 * get written down. A loose task can be adopted by a project later; one that
 * was never recorded cannot.
 */

const TITLE_MAX = 500;
const DESCRIPTION_MAX = 10000;

export const taskSchema = z.object({
  id: z.uuid(),

  title: z.string().trim().min(1, 'A task needs a title.').max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),

  status: taskStatusSchema,

  /** Where it sits against everything else. Absent for one nobody has ranked. */
  priority: prioritySchema.optional(),

  /** The project this is part of. Absent for a task that stands alone. */
  projectId: z.uuid().optional(),

  /**
   * The people this task is on, by id — prosopone person ids.
   *
   * The last of telos's four to get this, which was an oversight rather than a
   * decision: an idea, a goal and a project could all name the people they
   * concerned, and the one thing anybody is actually *assigned* could not.
   *
   * A list rather than a single assignee. Work shared between two people is
   * the ordinary case, and a single id forces whoever noticed to pick one and
   * lose the other.
   */
  involves: z.array(z.uuid()),

  /** When it is meant to be done by. Absent for one with no deadline. */
  dueAt: z.iso.datetime().optional(),

  /**
   * When it was finished or called off, whichever happened.
   *
   * Set by the api when the status becomes a closed one, and cleared if it
   * reopens. It is stored rather than derived because `updatedAt` moves for
   * any edit at all — renaming a finished task would otherwise look like
   * finishing it again.
   */
  closedAt: z.iso.datetime().optional(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * What a caller may send to write one down.
 *
 * A title is the whole of what is required. The id, the timestamps, `closedAt`
 * and the status are the api's to set: every task begins `TODO`, since writing
 * one down is not doing it, and a caller able to choose could record work as
 * finished that was never started.
 */
export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'A task needs a title.').max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  priority: prioritySchema.optional(),
  projectId: z.uuid().optional(),
  dueAt: z.iso.datetime().optional(),
  involves: z.array(z.uuid()).default([]),
});

/**
 * What a caller may send to change one.
 *
 * Every field optional, and the three that can be taken back are nullable:
 * `null` removes the value where absent leaves it alone. "This is no longer
 * ranked", "this no longer has a deadline" and "this is not part of that
 * project after all" are all real things to say, and an optional-only field
 * can be set but never cleared.
 */
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  /* The whole set, replaced. `[]` takes it off everyone. */
  involves: z.array(z.uuid()).optional(),
});

export type TaskDTO = z.infer<typeof taskSchema>;
export type CreateTaskDTO = z.infer<typeof createTaskSchema>;
export type UpdateTaskDTO = z.infer<typeof updateTaskSchema>;
