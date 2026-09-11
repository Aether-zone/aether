import { type TaskStatus } from '@aether/contract';

/** How each state reads, and how much it should stand out. */
export const STATUSES: Record<
  TaskStatus,
  {
    label: string;
    variant: 'secondary' | 'warning' | 'destructive' | 'success' | 'outline';
  }
> = {
  TODO: { label: 'To do', variant: 'secondary' },
  IN_PROGRESS: { label: 'In progress', variant: 'warning' },
  // The one state that is a call for help rather than a report of progress.
  BLOCKED: { label: 'Blocked', variant: 'destructive' },
  // "Completed", not "Done": the section heading above a group of them reads
  // as a state of the work, and "DONE · 3" reads as an exclamation.
  DONE: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};

/**
 * The colour of each state's dot.
 *
 * Only two carry a colour. `IN_PROGRESS` is what the reader is meant to find
 * first, and `BLOCKED` is the one asking for something — the rest are states
 * the list simply reports, and giving them all a colour would leave nothing
 * standing out.
 */
export const DOTS: Record<TaskStatus, string> = {
  TODO: 'bg-muted-foreground',
  IN_PROGRESS: 'bg-primary',
  BLOCKED: 'bg-destructive',
  DONE: 'bg-muted-foreground',
  CANCELLED: 'bg-muted-foreground/50',
};

/** The text and border of the pill, for the two that are not neutral. */
export const PILLS: Record<TaskStatus, string> = {
  TODO: 'border-border text-muted-foreground',
  IN_PROGRESS: 'border-primary/40 text-primary',
  BLOCKED: 'border-destructive/40 text-destructive',
  DONE: 'border-border text-muted-foreground',
  CANCELLED: 'border-border text-muted-foreground',
};

/**
 * The order the board reads in.
 *
 * What is being done first, then what could be picked up, then what cannot.
 * `BLOCKED` sits below `TODO` rather than at the top despite being the loudest
 * — it is a state you can do nothing about from this page, and leading with it
 * would put the unanswerable question above the answerable ones.
 */
export const BOARD_ORDER: TaskStatus[] = [
  'IN_PROGRESS',
  'TODO',
  'BLOCKED',
  'DONE',
  'CANCELLED',
];
