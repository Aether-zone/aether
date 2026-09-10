import type { GoalDTO } from '@aether/contract';

/**
 * Active goals first, soonest deadline at the top; everything settled after.
 *
 * Pure, and deliberately not in `lib/goals.ts`, which is `server-only`: a
 * comparator should be checkable without a session behind it.
 *
 * The ordering answers "what am I aiming at, and what is closest" — so a goal
 * that has been reached or given up is out of the way, and among the live ones
 * the one running out of time is at the top. An undated goal sorts after the
 * dated ones: it is not urgent, it is unscheduled, and putting it first would
 * be claiming the opposite.
 */
export function byUrgency(a: GoalDTO, b: GoalDTO): number {
  const settled = (goal: GoalDTO) => (goal.status === 'ACTIVE' ? 0 : 1);

  if (settled(a) !== settled(b)) {
    return settled(a) - settled(b);
  }

  if (a.targetAt !== b.targetAt) {
    if (!a.targetAt) return 1;
    if (!b.targetAt) return -1;

    return a.targetAt.localeCompare(b.targetAt);
  }

  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * "in 12 days", "3 days ago", or nothing for a goal with no deadline.
 *
 * Relative rather than a date, because the question a goal's deadline answers
 * is "how long have I got" and a reader should not have to do the subtraction.
 * `Intl.RelativeTimeFormat` keeps it localized.
 */
export function formatDeadline(targetAt: string | undefined): string | null {
  if (!targetAt) {
    return null;
  }

  const target = new Date(targetAt);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const days = Math.round(
    (target.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  // Days all the way out: a goal three months off reads better as "in 89
  // days" than "in 3 months" when the point is how much time is left.
  return relative.format(days, 'day');
}
