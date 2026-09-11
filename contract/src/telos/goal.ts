import { z } from 'zod';

import { goalStatusSchema } from './goal-status.js';
import { prioritySchema } from './priority.js';

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

    /**
     * How much this matters, on the one scale telos uses for all of it.
     *
     * The same 1–5 as an idea and a task, so "what should I be doing" can rank
     * across the chain. Optional, because an unranked goal is the normal case
     * — forcing a number when one is set would make everything a 3.
     */
    priority: prioritySchema.optional(),

    /**
     * How far along, 0 to 100.
     *
     * **Stated, not derived, and that is a compromise.** The honest source is
     * the work underneath — the projects pursuing this goal and the tasks in
     * them — but nothing records which project pursues which goal yet, so
     * there is nothing to count. A number somebody types is the only thing
     * available, and it is worth having because a goal board with no sense of
     * movement is a list of intentions.
     *
     * It will go stale, and that is the cost. When the goal→project link
     * exists this should become derived and this field should go, rather than
     * both existing and disagreeing.
     *
     * An integer: a percentage with decimals implies a precision that a number
     * somebody estimated does not have.
     */
    progress: z.number().int().min(0).max(100),

    /**
     * The people this goal is about, by id — prosopone person ids.
     *
     * The same field an idea carries and for the same reason: nobody else
     * records it, so this end owns it. A goal is often about someone other
     * than the person who set it — "help Alice find a job" is Alice's goal as
     * much as anyone's.
     */
    involves: z.array(z.uuid()),

    /**
     * The projects working towards this goal, by id.
     *
     * **Derived, not stored.** A project states what it pursues, and this is
     * the same fact read from the other end — "which projects name me". One
     * side owns the link so there is nothing to keep in sync; storing it on
     * both would make it possible for them to disagree, and nothing could then
     * say which was right.
     *
     * The same arrangement an idea has with its goals, and for the same
     * reason.
     */
    realizedBy: z.array(z.uuid()),

    /**
     * The resources this goal draws on, by id — tekmerion resource ids.
     *
     * Owned here, unlike `realizedBy`, and the reason is that the other end
     * has nothing to say. A project is started *for* a goal and knows it; a
     * document does not know what it will end up justifying. Somebody reading
     * the goal is the one who decides a resource belongs to it, so the goal is
     * where that decision goes.
     */
    sources: z.array(z.uuid()),

    /**
     * The calendar entries booked for this goal, by id — chronos event ids.
     *
     * Owned here for the same reason as `sources`, and with the same caveat:
     * an event deleted in chronos leaves an id here pointing at nothing. The
     * console drops what it cannot resolve rather than showing a blank row,
     * which is the honest reading — the booking is gone.
     */
    scheduled: z.array(z.uuid()),

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
    priority: prioritySchema.optional(),
    involves: z.array(z.uuid()).default([]),
    sources: z.array(z.uuid()).default([]),
    scheduled: z.array(z.uuid()).default([]),
    // `realizedBy` is absent on purpose: it is derived from the projects that
    // name this goal, so there is nothing to send and nothing to send wrongly.
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
  priority: prioritySchema.nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  involves: z.array(z.uuid()).optional(),
  /** The whole set, when sent: an idea missing from it is unlinked. */
  inspiredBy: z.array(z.uuid()).optional(),
  sources: z.array(z.uuid()).optional(),
  scheduled: z.array(z.uuid()).optional(),
});

export type GoalDTO = z.infer<typeof goalSchema>;
export type CreateGoalDTO = z.infer<typeof createGoalSchema>;
export type UpdateGoalDTO = z.infer<typeof updateGoalSchema>;
