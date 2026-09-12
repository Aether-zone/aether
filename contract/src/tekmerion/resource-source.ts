import { z } from 'zod';

/**
 * Where a resource came from.
 *
 * Separate from `ResourceType`, which is what the artefact *is*. The pair
 * answers two different questions a single field would conflate: a PDF pulled
 * off a web page and a PDF someone uploaded are the same kind of thing
 * arriving two different ways.
 *
 * An object rather than an enum, and that is the interesting choice: the set
 * of systems a resource can arrive from is open. A closed list would need a
 * new release of this contract before anything could be filed from a system
 * nobody had thought of, which is the opposite of what an integration point
 * is for.
 *
 * The cost is that `type` cannot be checked, so the same system can arrive
 * spelled two ways. That is a real risk and it is the right trade only
 * because the alternative blocks the common case on a deploy — but it means
 * whoever writes a `type` should treat it as a name others must match, not a
 * label for this one record.
 */
export const resourceSourceSchema = z.object({
  /**
   * What kind of system it came from — `gmail`, `notion`, `upload`.
   *
   * The only required field: a source that cannot say what it is tells a
   * reader nothing that the resource did not already say.
   */
  type: z.string().trim().min(1, 'A source needs a type.').max(200),

  /**
   * Which instance of it — an account, a workspace, a mailbox.
   *
   * Distinct from the resource's own `externalId`, which is what that system
   * calls *this record*. This one identifies the system, not the thing in it.
   */
  id: z.string().trim().min(1).max(500).optional(),

  /** What to show a person. `type` is for matching; this is for reading. */
  name: z.string().trim().min(1).max(500).optional(),

  /** Whatever else the integration wants to keep about where this came from. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ResourceSource = z.infer<typeof resourceSourceSchema>;
