import { z } from 'zod';

import { groupTypeSchema } from './group-type.js';

/**
 * A group of people, as a record.
 *
 * The counterpart to a person in prosopone: a company somebody works for, a
 * community they belong to, the family they are part of. Like a person, it is
 * a thing the console knows *about* rather than a thing the console belongs to.
 *
 * ## Why "group" and not "organization"
 *
 * Because aether already uses that word, for the thing that decides what
 * anybody may read. Every route in this api is
 * `/organizations/:organizationId/…`, and that organization is the **tenant**:
 * who you signed in as, from pistis's `orgs` claim.
 *
 * This is a record *inside* a tenant. One tenant holds many groups the same
 * way it holds many people, and a group has no bearing on what anybody may
 * read. Naming it `Organization` would have put two unrelated meanings on one
 * word in a codebase where one of them is an authorization boundary — a row
 * with an `id` and an `organizationId` where the second is not the first's
 * parent but its *owner*, and a route reading
 * `/organizations/:organizationId/organizations`.
 *
 * The cost of the rename is that the type no longer matches what a person
 * would call a company out loud. That is the cheaper mistake.
 *
 * Times are ISO 8601 strings rather than `Date`s — **a deviation from the
 * shape as specified**, and the same one every other resource here makes. A
 * DTO crosses a process boundary as JSON, where a `Date` arrives as a string
 * anyway: typing it as `Date` would describe a value that only exists on one
 * side of the wire, and the first `.toISOString()` on a parsed response would
 * throw.
 */

const NAME_MAX = 500;
const DESCRIPTION_MAX = 10000;

export const groupSchema = z.object({
  id: z.uuid(),

  name: z.string().trim().min(1, 'A group needs a name.').max(NAME_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),

  /**
   * Optional, because the kind is often the least certain thing about a group.
   * "The people I run with on Sundays" is a real group to somebody and not
   * obviously any of the six.
   */
  type: groupTypeSchema.optional(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * What a caller may send to record one.
 *
 * A name is the whole of what is required. The id and the timestamps are the
 * api's to set.
 */
export const createGroupSchema = groupSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * What a caller may send to change one.
 *
 * Every field optional, and the two that can be taken back are nullable:
 * `null` removes the value where absent leaves it alone. A group that turned
 * out not to be a company should be able to stop being one without becoming
 * something else.
 */
export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
  type: groupTypeSchema.nullable().optional(),
});

export type GroupDTO = z.infer<typeof groupSchema>;
export type CreateGroupDTO = z.infer<typeof createGroupSchema>;
export type UpdateGroupDTO = z.infer<typeof updateGroupSchema>;
