import { type GoalStatus } from '@aether/contract';

/**
 * How each state reads, and how much it should stand out.
 *
 * Shared with the idea page, which shows the goals an idea led to — a goal
 * should look the same wherever it is named.
 */
export const STATUSES: Record<
  GoalStatus,
  { label: string; variant: 'warning' | 'success' | 'outline' }
> = {
  ACTIVE: { label: 'Active', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  ABANDONED: { label: 'Abandoned', variant: 'outline' },
};
