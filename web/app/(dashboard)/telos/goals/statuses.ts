import { type GoalStatus } from '@aether/contract';

/**
 * How each state reads, and how much it should stand out.
 *
 * Shared with the idea page, which shows the goals an idea led to — a goal
 * should look the same wherever it is named.
 */
export const STATUSES: Record<
  GoalStatus,
  { label: string; variant: 'secondary' | 'warning' | 'success' | 'outline' }
> = {
  PLANNED: { label: 'Planned', variant: 'secondary' },
  ACTIVE: { label: 'Active', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  ABANDONED: { label: 'Abandoned', variant: 'outline' },
};

/**
 * The colour of each state's dot.
 *
 * A dot rather than a filled badge: a card already carries a title, a
 * description, a bar and a footer, and a second block of colour competes with
 * the title for the eye where a dot is read only when looked for.
 */
export const DOTS: Record<GoalStatus, string> = {
  PLANNED: 'bg-muted-foreground',
  ACTIVE: 'bg-success',
  COMPLETED: 'bg-success',
  ABANDONED: 'bg-muted-foreground/50',
};

/**
 * The order the board reads in, which is the order a goal moves through.
 *
 * What is live first: the board is opened to answer "what am I working on",
 * and putting the parked pile above it would answer a question nobody asked.
 */
export const BOARD_ORDER: GoalStatus[] = [
  'ACTIVE',
  'PLANNED',
  'COMPLETED',
  'ABANDONED',
];
