import { z } from 'zod';

/**
 * The events loculus publishes about objects, as aether reads them.
 *
 * **Declared here rather than imported.** `@aether-zone/organon` is a published
 * package and carries the shared *vocabulary* — `AetherEvent` — while this is
 * one service's private announcement about its own storage; loculus declares it
 * in its own source for the same reason. So the two ends agree by convention,
 * and the schema below is what holds aether to its half: a producer that
 * changes a field name gets a logged drop here rather than an undefined
 * silently written to a row.
 *
 * If a third service ever needs these, that is the moment to move them into
 * organon — not before.
 */

/** Routing key. Must match loculus's `OBJECT_UPLOADED`. */
export const OBJECT_UPLOADED = 'object.uploaded';

/**
 * The bytes for a key are in the store.
 *
 * Says *that the object exists*, not that it has just been written: loculus
 * publishes it from the bucket's notification within seconds of the upload, and
 * from its own sweep later for the uploads that notification never came for.
 * Either way aether's answer is the same, which is why nothing here branches on
 * which one sent it.
 *
 * `id` and `occurredAt` are the transport envelope organon stamps on everything
 * it publishes. Optional because they belong to the transport rather than to
 * this event, and a consumer that needs neither should not fail without them.
 */
export const objectUploadedSchema = z.object({
  objectKey: z.string().min(1),
  /** The filename declared at presign. aether already has its own; unused. */
  name: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  id: z.string().min(1).optional(),
  occurredAt: z.iso.datetime().optional(),
});

export type ObjectUploadedEvent = z.infer<typeof objectUploadedSchema>;
