import { z } from 'zod';

/**
 * Where a project has got to.
 *
 * Four states where a goal has three, and the extra one is deliberate rather
 * than an inconsistency. A project has a `PLANNED` state because work can be
 * scoped and scheduled without having started — that is what planning *is*. A
 * goal has no equivalent: you are aiming at it from the moment you set it, so
 * "not started" would describe the work rather than the aim.
 *
 * `CANCELLED` rather than a goal's `ABANDONED`, for the same reason in the
 * other direction. Work is called off, usually by a decision someone else can
 * see; an aim is given up, usually quietly. The words are not interchangeable
 * and neither are the states.
 */
export const PROJECT_STATUSES = [
  'PLANNED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;

export const projectStatusSchema = z.enum(PROJECT_STATUSES);

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
