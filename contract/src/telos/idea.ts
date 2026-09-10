import { z } from 'zod';

import { ideaStatusSchema } from './idea-status.js';
import { prioritySchema } from './priority.js';

/**
 * Something worth considering, before anyone has committed to it.
 *
 * The cheapest resource in telos on purpose: a title is the only thing
 * required, because an idea that has to be filled in properly is an idea
 * nobody writes down.
 *
 * Times are ISO 8601 strings rather than `Date`s, for the same reason as
 * everywhere else here: a DTO crosses a process boundary as JSON, where a Date
 * arrives as a string anyway — typing it as a Date would make every consumer's
 * value disagree with its own type.
 */

const TITLE_MAX = 500;
export const DESCRIPTION_MAX = 10000;

export const ideaSchema = z.object({
  id: z.uuid(),

  title: z.string().trim().min(1, 'An idea needs a title.').max(TITLE_MAX),
  /** Optional: most ideas are one line, and demanding more loses them. */
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),

  status: ideaStatusSchema,

  /**
   * How much this matters, 1 (most) to 5 (least).
   *
   * Bounded rather than a free number. A scale nobody agreed on is not a
   * scale: with an open range one person writes 1 for urgent and another
   * writes 100, and sorting by it produces an order that means nothing. Five
   * steps is enough to rank a list and few enough that people use them
   * consistently.
   *
   * Optional, because an unranked idea is the normal case — forcing a number
   * at capture time would make everything a 3.
   */
  priority: prioritySchema.optional(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),

  /**
   * Who wrote it down, as a pistis subject.
   *
   * Required, unlike an event's organizer: every idea here was captured by
   * somebody using this api, and the value comes from their token rather than
   * from anything they send.
   */
  createdBy: z.uuid(),

  /**
   * The goals this idea led to, by id.
   *
   * **Derived, not stored.** A goal states what inspired it, and this is the
   * same fact read from the other end — "which goals name me". One side owns
   * the link so there is nothing to keep in sync; storing it on both would
   * make it possible for them to disagree, and nothing could then say which
   * was right.
   *
   * Ids rather than whole goals, because a goal carries `inspiredBy` pointing
   * back here: embedding either side would make the two types mutually
   * recursive and the JSON never bottom out.
   *
   * Always present, possibly empty. Most ideas inspire nothing, and an empty
   * array says that where a missing one would only say the caller forgot.
   */
  inspired: z.array(z.uuid()),
});

/**
 * What a caller may send to capture one.
 *
 * `title` and nothing else is a valid idea. The id, the timestamps, the status
 * and `createdBy` are all the api's to set — `createdBy` in particular comes
 * from the token, never the body, or anyone could write an idea under somebody
 * else's name.
 */
export const createIdeaSchema = ideaSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  // Derived from the goals that name this idea, so there is nothing to send
  // and nothing that could be sent wrongly.
  inspired: true,
});

/**
 * What a caller may send to change one.
 *
 * Every field optional, so a caller can send only what changed. `null` on
 * `priority` un-ranks an idea, where absent leaves the ranking alone — the
 * distinction is needed because "no longer important enough to rank" is a real
 * thing to say.
 */
export const updateIdeaSchema = createIdeaSchema.partial().extend({
  status: ideaStatusSchema.optional(),
  /*
   * Nullable for the same reason `priority` is: an optional field can be added
   * but never taken back, since a missing key already means "leave it alone".
   * `null` is how the caller says the description should go.
   */
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
  priority: prioritySchema.nullable().optional(),
});

export type IdeaDTO = z.infer<typeof ideaSchema>;
export type CreateIdeaDTO = z.infer<typeof createIdeaSchema>;
export type UpdateIdeaDTO = z.infer<typeof updateIdeaSchema>;
