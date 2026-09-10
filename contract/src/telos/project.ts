import { z } from 'zod';

import { projectStatusSchema } from './project-status.js';

/**
 * A piece of work with a shape and an end.
 *
 * The step after a goal in telos's chain: an idea becomes a goal, a goal is
 * pursued by a project, a project is done through tasks. Nothing here records
 * *which* goal it pursues yet — that link belongs on whichever end owns it,
 * and neither does until the console can start a project from a goal.
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
});

export type ProjectDTO = z.infer<typeof projectSchema>;
export type CreateProjectDTO = z.infer<typeof createProjectSchema>;
export type UpdateProjectDTO = z.infer<typeof updateProjectSchema>;
