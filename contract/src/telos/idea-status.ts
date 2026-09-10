import { z } from 'zod';

/**
 * How far an idea has got.
 *
 * These follow telos's own chain — an idea becomes a goal, a goal is pursued
 * by a project, a project is done through tasks — so `PROMOTED` is the state
 * that says this one made it out of the pile. Without it, "we did something
 * with this" and "we are still thinking" would be the same answer.
 *
 * `DROPPED` rather than deleting. An idea decided against is worth keeping:
 * the reason it was dropped is the thing that stops it being raised again in
 * six months, and a deleted row carries no reason.
 */
export const IDEA_STATUSES = [
  'CAPTURED',
  'EXPLORING',
  'PROMOTED',
  'DROPPED',
] as const;

export const ideaStatusSchema = z.enum(IDEA_STATUSES);

export type IdeaStatus = (typeof IDEA_STATUSES)[number];
