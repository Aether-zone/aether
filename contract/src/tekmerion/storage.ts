import { z } from 'zod';

/**
 * Putting a file somewhere, without it passing through aether.
 *
 * The browser asks aether where the file may go, aether asks loculus, and the
 * URL that comes back is spent by the browser against the object store
 * directly. No bytes cross this api — which is what stops an api being sized
 * by its largest upload.
 */

/** What the browser sends to ask for somewhere to put a file. */
export const createPresignedUploadSchema = z.object({
  fileName: z.string().trim().min(1),
  contentType: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(\s*;.*)?$/i,
      'must be a media type, such as "application/pdf"',
    ),
  /**
   * Bytes. loculus signs this into the URL as a `Content-Length`, so the
   * upload has to match exactly — a URL issued for a small file cannot be
   * spent on a large one.
   */
  size: z.number().int().positive(),
  /**
   * Which organization the file belongs to.
   *
   * Optional here because **a browser never supplies it**: aether fills it in
   * from the caller's `Actor` before relaying. Anything a client did send is
   * discarded rather than trusted — the value is provenance, and provenance
   * dictated by the thing being recorded is worth nothing.
   */
  organizationId: z.uuid().optional(),
});

/** What loculus answers with. */
export const presignedUploadSchema = z.object({
  /** loculus's name for the object. */
  objectKey: z.string().min(1),
  uploadUrl: z.url(),
  /** Coerced: it arrives as an ISO string and every caller compares it to a clock. */
  expiresAt: z.coerce.date(),
});

export const presignedDownloadSchema = presignedUploadSchema
  .omit({ uploadUrl: true })
  .extend({ downloadUrl: z.url() });

/**
 * What aether answers with: loculus's URL, plus the row aether wrote to expect
 * the file.
 *
 * The client comes back with `fileId`, never `objectKey`. loculus has no
 * notion of who owns an object — it signs URLs and stores bytes — so a key
 * arriving from a browser is unattributable, and aether would have to take its
 * word for which organization it belonged to. A `fileId` is a row aether made
 * for an organization it had already checked, so there is nothing to trust.
 */
export const preparedUploadSchema = presignedUploadSchema.extend({
  fileId: z.uuid(),
});

export type CreatePresignedUploadDTO = z.infer<
  typeof createPresignedUploadSchema
>;
export type PresignedUploadDTO = z.infer<typeof presignedUploadSchema>;
export type PresignedDownloadDTO = z.infer<typeof presignedDownloadSchema>;
export type PreparedUploadDTO = z.infer<typeof preparedUploadSchema>;
