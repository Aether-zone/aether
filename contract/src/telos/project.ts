import { z } from 'zod';

import { prioritySchema } from './priority.js';
import { projectStatusSchema } from './project-status.js';

/**
 * A piece of work with a shape and an end.
 *
 * The step after a goal in telos's chain: an idea becomes a goal, a goal is
 * pursued by a project, a project is done through tasks.
 *
 * `pursues` is the third and last link in that chain, and it points the same
 * way the other two do — the later thing names the earlier one:
 *
 * | link | held by |
 * | --- | --- |
 * | idea → goal | `Goal.inspiredBy` |
 * | goal → project | `Project.pursues` |
 * | project → task | `Task.projectId` |
 *
 * A goal reads its projects back out of this rather than storing them, so the
 * two can never disagree. The direction is not arbitrary: a project is started
 * knowing what it is for, where a goal outlives any particular attempt at it
 * and should not need editing every time someone starts another.
 *
 * Times are ISO 8601 strings rather than `Date`s, as everywhere else here: a
 * DTO crosses a process boundary as JSON, where a Date arrives as a string
 * anyway.
 */

const TITLE_MAX = 500;
const DESCRIPTION_MAX = 10000;

/**
 * Both dates optional, and checked against each other only when both are
 * there — a project with a deadline and no start date is the ordinary way one
 * gets written down.
 */
const ordered = <T extends { startsAt?: string; targetAt?: string }>(
  project: T,
): boolean =>
  !project.startsAt || !project.targetAt || project.targetAt > project.startsAt;

const ORDER_ERROR = {
  path: ['targetAt'],
  /*
   * A string comparison, which is exact for ISO 8601 in UTC: the format is
   * ordered lexicographically by design, so this needs no parsing and cannot
   * drift with a timezone.
   */
  error: 'A project cannot be due before it starts.',
};

export const projectSchema = z
  .object({
    id: z.uuid(),

    title: z.string().trim().min(1, 'A project needs a title.').max(TITLE_MAX),
    description: z.string().trim().max(DESCRIPTION_MAX).optional(),

    status: projectStatusSchema,

    /**
     * The goals this project is meant to reach, by id.
     *
     * Usually one. A list because a piece of work can serve two aims at once,
     * and a single id would force whoever noticed that to pick one and lose
     * the other.
     *
     * Always present, possibly empty: plenty of work exists before anyone has
     * said what larger thing it is for, and an empty array says that where a
     * missing one would only say the caller forgot.
     */
    pursues: z.array(z.uuid()),

    /**
     * How much this matters, on the one scale telos ranks everything by.
     *
     * Optional, because an unranked project is the normal case — forcing a
     * number when one is started would make everything a 3.
     */
    priority: prioritySchema.optional(),

    /**
     * The people this project is for, by id — prosopone person ids.
     *
     * The same field an idea and a goal carry, and owned here for the same
     * reason: nobody else records it.
     */
    involves: z.array(z.uuid()),

    /**
     * How much of the work is done, counted from the tasks in it.
     *
     * **Derived, not stored** — and this is the field a goal's `progress`
     * should have been. A project is done through tasks, so the tasks already
     * know the answer; a number somebody types can disagree with them, and
     * when it does there is nothing to say which is right.
     *
     * `total` of zero means no tasks yet, which is a real state and not an
     * error: a project can be planned before it is broken down. A reader
     * should be shown "0/0" rather than a progress bar implying nothing has
     * been done, because nothing has been *asked for* either.
     */
    tasks: z.object({
      done: z.number().int().min(0),
      total: z.number().int().min(0),
    }),

    /** When work begins. Absent for one not yet scheduled. */
    startsAt: z.iso.datetime().optional(),
    /** When it is meant to be done. Absent for one with no deadline. */
    targetAt: z.iso.datetime().optional(),

    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(ordered, ORDER_ERROR);

/**
 * What a caller may send to start one.
 *
 * The id, the timestamps and the status are the api's to set. Every project
 * begins `PLANNED` — writing one down is planning it, and a caller able to
 * choose could record work as completed before any of it existed.
 */
export const createProjectSchema = z
  .object({
    title: z.string().trim().min(1, 'A project needs a title.').max(TITLE_MAX),
    description: z.string().trim().max(DESCRIPTION_MAX).optional(),
    startsAt: z.iso.datetime().optional(),
    targetAt: z.iso.datetime().optional(),
    /*
     * Settable when the project is started, because "what is this for" is
     * usually the reason it is being started at all.
     */
    pursues: z.array(z.uuid()).default([]),
    priority: prioritySchema.optional(),
    involves: z.array(z.uuid()).default([]),
    // `tasks` is absent on purpose: it is counted from the tasks in this
    // project, so there is nothing to send and nothing to send wrongly.
  })
  .refine(ordered, ORDER_ERROR);

/**
 * What a caller may send to change one.
 *
 * Every field optional. `null` on either date removes it, where absent leaves
 * it alone — "this no longer has a deadline" is a real thing to say.
 *
 * **No cross-field check here.** A partial update may carry one date and not
 * the other, and comparing against a value this schema cannot see would either
 * reject valid changes or pass invalid ones. The service does it, where both
 * are known.
 */
export const updateProjectSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  status: projectStatusSchema.optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  targetAt: z.iso.datetime().nullable().optional(),
  /*
   * The whole set, replaced. Sending `[]` detaches the project from every
   * goal, which is why this is not nullable — the empty array already says it.
   */
  pursues: z.array(z.uuid()).optional(),
  priority: prioritySchema.nullable().optional(),
  involves: z.array(z.uuid()).optional(),
});

export type ProjectDTO = z.infer<typeof projectSchema>;
export type CreateProjectDTO = z.infer<typeof createProjectSchema>;
export type UpdateProjectDTO = z.infer<typeof updateProjectSchema>;
