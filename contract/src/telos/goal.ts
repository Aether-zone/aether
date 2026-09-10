import { z } from 'zod';

import { goalStatusSchema } from './goal-status.js';

/**
 * Something you are aiming at.
 *
 * The step after an idea in telos's chain: an idea becomes a goal, a goal is
 * pursued by a project, a project is done through tasks. Nothing here records
 * *which* idea it came from yet — that link belongs on whichever end owns it,
 * and neither does until goals can be promoted from ideas in the console.
 *
 * Times are ISO 8601 strings rather than `Date`s, as everywhere else here: a
 * DTO crosses a process boundary as JSON, where a Date arrives as a string
 * anyway — typing it as a Date would make every consumer's value disagree with
 * its own type.
 */

const TITLE_MAX = 500;
const DESCRIPTION_MAX = 10000;

/**
 * Both dates optional, and checked against each other only when both are
 * there.
 *
 * A goal with a target and no start is the common case — "by the end of the
 * quarter" says everything that matters. One with a start and no target is a
 * commitment without a deadline, which is a real and slightly uncomfortable
 * thing to record. Neither is an error.
 */
const ordered = <T extends { startsAt?: string; targetAt?: string }>(
  goal: T,
): boolean => !goal.startsAt || !goal.targetAt || goal.targetAt > goal.startsAt;

const ORDER_ERROR = {
  path: ['targetAt'],
  /*
   * A string comparison, which is exact for ISO 8601 in UTC: the format is
   * ordered lexicographically by design, so this needs no parsing and cannot
   * drift with a timezone.
   */
  error: 'A goal cannot be due before it starts.',
};

export const goalSchema = z
  .object({
    id: z.uuid(),

    title: z.string().trim().min(1, 'A goal needs a title.').max(TITLE_MAX),
    description: z.string().trim().max(DESCRIPTION_MAX).optional(),

    status: goalStatusSchema,

    /** When work on it begins. Absent for one already under way, or undated. */
    startsAt: z.iso.datetime().optional(),
    /** When it is meant to be reached. Absent for one with no deadline. */
    targetAt: z.iso.datetime().optional(),

    /**
     * The ideas this goal came out of, by id.
     *
     * **This side owns the link.** A goal is written down *from* ideas, so
     * naming them at the moment the goal is set is the one write that matches
     * how it happens — the alternative is creating the goal and then going
     * back to edit every idea. `IdeaDTO.inspired` is this same fact read from
     * the other end.
     *
     * Ids rather than whole ideas: an idea carries `inspired` pointing back
     * here, so embedding either side would make the two types mutually
     * recursive.
     *
     * Always present, possibly empty. Plenty of goals come from nowhere in
     * particular.
     */
    inspiredBy: z.array(z.uuid()),

    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(ordered, ORDER_ERROR);

/**
 * What a caller may send to set one.
 *
 * The id, the timestamps and the status are the api's to set: every goal
 * starts `ACTIVE`, because setting a goal you have already abandoned is not a
 * thing anyone does, and a caller able to choose could record one as completed
 * before any work existed.
 */
export const createGoalSchema = z
  .object({
    title: z.string().trim().min(1, 'A goal needs a title.').max(TITLE_MAX),
    description: z.string().trim().max(DESCRIPTION_MAX).optional(),
    startsAt: z.iso.datetime().optional(),
    targetAt: z.iso.datetime().optional(),
    /** Defaulted, so a goal that came from nowhere need not send `[]`. */
    inspiredBy: z.array(z.uuid()).default([]),
  })
  .refine(ordered, ORDER_ERROR);

/**
 * What a caller may send to change one.
 *
 * Every field optional, so a caller can send only what moved. `null` on either
 * date removes it, where absent leaves it alone — "this no longer has a
 * deadline" is a real thing to say, and it is not the same as saying nothing.
 *
 * **No cross-field check here.** A partial update may carry one date and not
 * the other, and comparing against a value this schema cannot see would either
 * reject valid changes or pass invalid ones. That check belongs where both are
 * known, which is the service.
 */
export const updateGoalSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  status: goalStatusSchema.optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  targetAt: z.iso.datetime().nullable().optional(),
  /** The whole set, when sent: an idea missing from it is unlinked. */
  inspiredBy: z.array(z.uuid()).optional(),
});

export type GoalDTO = z.infer<typeof goalSchema>;
export type CreateGoalDTO = z.infer<typeof createGoalSchema>;
export type UpdateGoalDTO = z.infer<typeof updateGoalSchema>;
