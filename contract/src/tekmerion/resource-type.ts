import { z } from 'zod';

/**
 * What kind of artefact a resource is.
 *
 * The kind is about the *form* the evidence takes, not where it came from —
 * an email saved as a file is still an email, and a note typed into the
 * console is still a note however it arrives. `ResourceSource` answers the
 * other question.
 *
 * `DOCUMENT` and `FILE` are both here and are not redundant: a document is
 * something written to be read, a file is a blob that happens to be stored.
 * A spreadsheet is a file; a contract is a document that is also a file, and
 * whoever files it decides which fact about it matters.
 */
export const RESOURCE_TYPES = [
  'NOTE',
  'DOCUMENT',
  'FILE',
  'WEB_PAGE',
  'EMAIL',
  'CONVERSATION',
  'AUDIO',
  'VIDEO',
] as const;

export const resourceTypeSchema = z.enum(RESOURCE_TYPES);

export type ResourceType = (typeof RESOURCE_TYPES)[number];
