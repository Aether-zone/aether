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
  DONE: { label: 'Done', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};
