import { type IdeaStatus } from '@aether/contract';

/**
 * How each state reads, and how much it should stand out.
 *
 * Shared by the list and the detail page rather than written twice: the same
 * idea showing "Promoted" in one place and "PROMOTED" in the other is the kind
 * of difference nobody notices until a screenshot has both.
 */
export const STATUSES: Record<
  IdeaStatus,
  { label: string; variant: 'secondary' | 'warning' | 'success' | 'outline' }
> = {
  CAPTURED: { label: 'Captured', variant: 'secondary' },
  EXPLORING: { label: 'Exploring', variant: 'warning' },
  PROMOTED: { label: 'Promoted', variant: 'success' },
  DROPPED: { label: 'Dropped', variant: 'outline' },
};
