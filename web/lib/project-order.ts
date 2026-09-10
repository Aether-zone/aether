import type { ProjectDTO, ProjectStatus } from '@aether/contract';

/**
 * In flight first, then queued, then finished.
 *
 * Pure, and deliberately not in `lib/projects.ts`, which is `server-only`: a
 * comparator should be checkable without a session behind it.
 *
 * Four states need a rank where a goal's three needed a boolean. `ACTIVE`
 * before `PLANNED` is the point of the ordering: what is being worked on now
 * deserves the top of the screen, and what is merely scheduled does not
 * outrank it however soon it is due. `COMPLETED` and `CANCELLED` share the
 * bottom — both are over, and there is no useful order between "we did it" and
 * "we stopped".
 */
const RANK: Record<ProjectStatus, number> = {
  ACTIVE: 0,
  PLANNED: 1,
  COMPLETED: 2,
  CANCELLED: 2,
};

export function byProgress(a: ProjectDTO, b: ProjectDTO): number {
  if (RANK[a.status] !== RANK[b.status]) {
    return RANK[a.status] - RANK[b.status];
  }

  if (a.targetAt !== b.targetAt) {
    // Undated sorts last within its group: not urgent, unscheduled.
    if (!a.targetAt) return 1;
    if (!b.targetAt) return -1;

    return a.targetAt.localeCompare(b.targetAt);
  }

  return a.createdAt.localeCompare(b.createdAt);
}

/** Whether a project is still something anyone is going to do. */
export const isLive = (status: ProjectStatus): boolean =>
  status === 'ACTIVE' || status === 'PLANNED';
