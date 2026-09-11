import { z } from 'zod';

/**
 * Where a goal has got to.
 *
 * `PLANNED` is here after being argued against. The reasoning was that a goal
 * you have not begun is still one you are aiming at, so a "not started" state
 * would only record how long something sat untouched — which the dates already
 * say, and say more precisely. That holds for one goal read on its own; it
 * stops holding for a *board* of them, where "what am I actually working on"
 * and "what have I merely agreed to" are the two piles a reader is there to
 * separate, and dates cannot separate them because a goal can be scheduled
 * and untouched at the same time.
 *
 * `ABANDONED` rather than deleting, and distinct from `COMPLETED`. Giving up
 * on a goal is a different outcome from reaching it, and a system that could
 * not tell them apart would report both as "no longer active" — which is the
 * one thing nobody wants to know.
 *
 * The order is the order a goal moves through them, which is also the order
 * the console groups by: what is planned, what is live, then the two endings.
 */
export const GOAL_STATUSES = [
  'PLANNED',
  'ACTIVE',
  'COMPLETED',
  'ABANDONED',
] as const;

export const goalStatusSchema = z.enum(GOAL_STATUSES);

export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** The states that mean nothing further will happen. */
export const CLOSED_GOAL_STATUSES: readonly GoalStatus[] = [
  'COMPLETED',
  'ABANDONED',
];
