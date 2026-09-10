import { z } from 'zod';

/**
 * How urgent something is, on the one scale telos uses for all of it.
 *
 * Ideas and tasks are both ranked, and they are ranked against each other
 * often enough — "what should I be doing" reaches across the chain — that two
 * scales with different bounds would be a trap. One definition, so a 2 always
 * means the same thing.
 */

/** Highest and lowest a priority may be. */
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 5;

const OUT_OF_RANGE = `Priority runs from ${PRIORITY_MIN} to ${PRIORITY_MAX}.`;

/**
 * 1 is the top, which is the opposite of how a number usually reads.
 *
 * It is the convention every issue tracker uses — P1 is the one that wakes
 * you — and matching it costs less than being right in isolation. The console
 * labels it, so nobody has to remember.
 */
export const prioritySchema = z
  .number()
  .int()
  .min(PRIORITY_MIN, OUT_OF_RANGE)
  .max(PRIORITY_MAX, OUT_OF_RANGE);
