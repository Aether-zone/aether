import { type IdeaStatus } from '@aether/contract';

import { STATUSES } from './statuses';

/**
 * A state as a dot and a word.
 *
 * A dot rather than a filled badge, because a list row already carries a kind
 * icon, a title, a count and a date — a second block of colour competes with
 * the title for the eye, where a dot is read only when looked for.
 */
const DOTS: Record<IdeaStatus, string> = {
  CAPTURED: 'bg-muted-foreground',
  EXPLORING: 'bg-warning',
  PROMOTED: 'bg-success',
  DROPPED: 'bg-muted-foreground/50',
};

export function StatusPill({ status }: { status: IdeaStatus }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
      <span className={`size-1.5 rounded-full ${DOTS[status]}`} aria-hidden />
      {STATUSES[status].label}
    </span>
  );
}
