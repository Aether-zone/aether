import { z } from 'zod';

/**
 * How far an upload has got.
 *
 * `INITIAL` is a row written before the bytes exist — aether has issued a URL
 * and is waiting. `UPLOADED` is one confirmed to be there. The state between
 * them is not decoration: a presigned URL can be issued and never spent, and
 * without somewhere to say so the only options are a row that lies about
 * having a file or no row at all until the browser comes back — and the
 * browser may not.
 */
export const FILE_STATUSES = ['INITIAL', 'UPLOADING', 'UPLOADED'] as const;

export const fileStatusSchema = z.enum(FILE_STATUSES);

export type FileStatus = (typeof FILE_STATUSES)[number];

/**
 * A stored object, as aether talks about it.
 *
 * No URL. A link to the bytes is presigned on demand and expires, so putting
 * one in a record would mean serving something that stops working while the
 * page is still open. Ask for a download when somebody wants to read it.
 */
export const fileSchema = z.object({
  id: z.uuid(),
  /** What the file was uploaded as. Never used to build the object key. */
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  status: fileStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type FileDTO = z.infer<typeof fileSchema>;
