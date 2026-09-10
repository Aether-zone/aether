import { z } from 'zod';

/**
 * How a goal ended, or that it has not.
 *
 * Three states rather than four: there is no "not started yet". A goal you
 * have not begun is still one you are aiming at, and a state for it would
 * mostly record how long something sat untouched — which the dates already
 * say, and say more precisely.
 *
 * `ABANDONED` rather than deleting, and distinct from `COMPLETED`. Giving up
 * on a goal is a different outcome from reaching it, and a system that could
 * not tell them apart would report both as "no longer active" — which is the
 * one thing nobody wants to know.
 */
export const GOAL_STATUSES = ['ACTIVE', 'COMPLETED', 'ABANDONED'] as const;

export const goalStatusSchema = z.enum(GOAL_STATUSES);

export type GoalStatus = (typeof GOAL_STATUSES)[number];
