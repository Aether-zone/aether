import { z } from 'zod';

import { resourceSourceSchema } from './resource-source.js';
import { resourceTypeSchema } from './resource-type.js';

/**
 * An artefact: the thing a claim rests on.
 *
 * Tekmerion holds what a resource *is* and where it came from. What it
 * *means* is arachni's business and what it *says* is mneme's, which is why
 * almost everything here is optional — a resource can be filed the moment it
 * arrives, before anyone has read it, titled it or decided what it is for.
 *
 * `type` is the exception, and the only required field besides the id and the
 * timestamps. Something whose kind is unknown cannot be rendered, indexed or
 * routed, so filing one would be filing a row nothing can do anything with.
 *
 * **Times are ISO 8601 strings, not `Date`s** — a deviation from the shape
 * that was specified, and the same choice every other resource in this
 * contract makes. A DTO crosses a process boundary as JSON, where a `Date`
 * arrives as a string anyway: typing it as `Date` would describe a value that
 * only exists on one side of the wire, and the first `.toISOString()` on a
 * parsed response would throw.
 */

const TITLE_MAX = 500;
const DESCRIPTION_MAX = 10000;
const URL_MAX = 2048;
const EXTERNAL_ID_MAX = 500;

/**
 * Whatever the system it came from wants to keep with it.
 *
 * `unknown` rather than a looser type: it can be stored and handed back, but
 * a consumer has to check what it got before using it. Anything the console
 * relies on should be a field of its own, not a key someone hopes is there.
 */
const metadataSchema = z.record(z.string(), z.unknown());

export const resourceSchema = z.object({
  id: z.uuid(),

  type: resourceTypeSchema,

  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),

  /**
   * The text of the thing, where there is text.
   *
   * Not trimmed and not capped. Leading whitespace is meaningful in a
   * transcript or a code sample, and a cap here would silently truncate the
   * one field the resource exists to carry — a limit on this belongs at the
   * storage layer, which can reject rather than mangle.
   */
  content: z.string().optional(),

  source: resourceSourceSchema.optional(),

  /**
   * What the system it came from calls *this record*.
   *
   * Distinct from `source.id`, which identifies the system itself. Meaningless
   * without a `source` to scope it: two systems will both number their records
   * from 1.
   */
  externalId: z.string().trim().min(1).max(EXTERNAL_ID_MAX).optional(),
  url: z.url().max(URL_MAX).optional(),

  metadata: metadataSchema.optional(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * What a caller may send to file one.
 *
 * The id and the timestamps are the api's to set. Everything else is offered,
 * because a resource is usually filed by something automated that knows what
 * it has — unlike an idea, which is typed by a person in a hurry.
 */
export const createResourceSchema = resourceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * What a caller may send to change one.
 *
 * Every field optional, and the ones that can be taken back are nullable:
 * `null` removes the value where absent leaves it alone. `type` is not
 * nullable — a resource always has a kind, and there is nothing to fall back
 * to if one is removed.
 */
export const updateResourceSchema = z.object({
  type: resourceTypeSchema.optional(),
  title: z.string().trim().min(1).max(TITLE_MAX).nullable().optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
  content: z.string().nullable().optional(),
  source: resourceSourceSchema.nullable().optional(),
  externalId: z
    .string()
    .trim()
    .min(1)
    .max(EXTERNAL_ID_MAX)
    .nullable()
    .optional(),
  url: z.url().max(URL_MAX).nullable().optional(),
  metadata: metadataSchema.nullable().optional(),
});

export type ResourceDTO = z.infer<typeof resourceSchema>;
export type CreateResourceDTO = z.infer<typeof createResourceSchema>;
export type UpdateResourceDTO = z.infer<typeof updateResourceSchema>;
