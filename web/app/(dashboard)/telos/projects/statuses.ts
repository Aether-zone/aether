import { type ProjectStatus } from '@aether/contract';

/** How each state reads. */
export const STATUSES: Record<ProjectStatus, { label: string }> = {
  PLANNED: { label: 'Planned' },
  ACTIVE: { label: 'Active' },
  COMPLETED: { label: 'Completed' },
  CANCELLED: { label: 'Cancelled' },
};

/**
 * The colour of each state's dot.
 *
 * A dot rather than a filled badge: a card already carries a title, a
 * description, a link, a bar and a footer, and a second block of colour
 * competes with the title for the eye.
 */
export const DOTS: Record<ProjectStatus, string> = {
  PLANNED: 'bg-muted-foreground',
  ACTIVE: 'bg-success',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-muted-foreground/50',
};
