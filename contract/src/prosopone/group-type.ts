import { z } from 'zod';

/**
 * What kind of group this is.
 *
 * A loose classification rather than a legal one: the point is that a reader
 * can tell a client from a hobby at a glance, not that the value would satisfy
 * a registrar. `COMPANY` and `ASSOCIATION` are not being distinguished
 * by their articles of incorporation — they are being distinguished by how the
 * person reading the list thinks about them.
 *
 * `OTHER` is here and is not a failure. A list of six kinds will not cover
 * every group a person deals with, and the alternative to an escape hatch is
 * somebody filing their church under `COMPANY`.
 */
export const GROUP_TYPES = [
  'COMPANY',
  'COMMUNITY',
  'ASSOCIATION',
  'TEAM',
  'FAMILY',
  'OTHER',
] as const;

export const groupTypeSchema = z.enum(GROUP_TYPES);

export type GroupType = (typeof GROUP_TYPES)[number];
