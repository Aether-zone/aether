import { CLOSED_STATUSES, type TaskDTO } from '@aether/contract';

/**
 * Ordering and reading a task list.
 *
 * Pure, and deliberately not in `lib/tasks.ts`, which is `server-only`: a
 * comparator should be checkable without a session behind it.
 */

const isClosed = (task: TaskDTO) => CLOSED_STATUSES.includes(task.status);

/**
 * What needs doing, in the order it needs doing.
 *
 * Open tasks first, then blocked, then everything finished or called off. The
 * middle band is the point: a blocked task is not something you can pick up,
 * so it should not sit among the ones you can — but it is not done either, so
 * burying it with the finished ones is how a blocker goes unnoticed for a
 * week.
 *
 * Within a band, soonest deadline first, then by priority, then oldest. An
 * undated task sorts after the dated ones: it is not urgent, it is
 * unscheduled, and putting it first would claim the opposite.
 */
export function byWhatNeedsDoing(a: TaskDTO, b: TaskDTO): number {
  const band = (task: TaskDTO) =>
    isClosed(task) ? 2 : task.status === 'BLOCKED' ? 1 : 0;

  if (band(a) !== band(b)) {
    return band(a) - band(b);
  }

  if (a.dueAt !== b.dueAt) {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;

    return a.dueAt.localeCompare(b.dueAt);
  }

  // Ranked before unranked, and 1 is the top.
  if (a.priority !== b.priority) {
    if (a.priority === undefined) return 1;
    if (b.priority === undefined) return -1;

    return a.priority - b.priority;
  }

  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * "in 12 days", "3 days ago", or nothing for a task with no deadline.
 *
 * Relative rather than a date, because the question a deadline answers is "how
 * long have I got" and a reader should not have to do the subtraction.
 */
export function formatDue(dueAt: string | undefined): string | null {
  if (!dueAt) {
    return null;
  }

  const due = new Date(dueAt);

  if (Number.isNaN(due.getTime())) {
    return null;
  }

  const days = Math.round((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    days,
    'day',
  );
}

/** Whether a deadline has passed on something still open. */
export function isOverdue(task: TaskDTO): boolean {
  return !isClosed(task) && !!task.dueAt && task.dueAt < new Date().toISOString();
}
