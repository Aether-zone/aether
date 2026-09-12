'use client';

import type { GoalDTO, UserDTO } from '@aether/contract';
import Link from 'next/link';

import { AvatarStack } from '@/components/avatar-stack';
import { PriorityBars } from '@/components/priority-bars';
import { formatMonth } from '@/lib/goal-priority';

import { DOTS, STATUSES } from './statuses';

/**
 * One goal, as a card.
 *
 * The card is read top to bottom in the order the questions come: what it is,
 * what it means, how far along, and then the facts that qualify it. The
 * progress bar sits above the footer rather than in it, because it is the one
 * thing the whole board exists to compare and it should line up across cards.
 */
export function GoalCard({
  goal,
  people,
}: {
  goal: GoalDTO;
  people: UserDTO[];
}) {
  const byId = new Map(people.map((person) => [person.id, person]));

  // An id that resolves to nobody is a person removed from prosopone since.
  const involved = goal.involves
    .map((id) => byId.get(id))
    .filter((person): person is UserDTO => person !== undefined);

  const month = formatMonth(goal.targetAt);
  const settled = goal.status === 'COMPLETED' || goal.status === 'ABANDONED';

  return (
    <li
      className={[
        'flex flex-col gap-4 rounded-lg border border-border p-5 transition-colors hover:border-muted-foreground/40',
        // A goal that is over is kept for the record, not for its prominence.
        settled && 'opacity-70',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/telos/goals/${goal.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {goal.title}
        </Link>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <span
            className={`size-1.5 rounded-full ${DOTS[goal.status]}`}
            aria-hidden
          />
          {STATUSES[goal.status].label}
        </span>
      </div>

      {goal.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {goal.description}
        </p>
      )}

      {/* `mt-auto` so the bar and footer sit at the bottom whatever the
          description's length — cards in a row otherwise line up only when
          their text happens to wrap the same way. */}
      <div className="mt-auto flex flex-col gap-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={goal.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${goal.title}: ${goal.progress}% done`}
        >
          <div
            className="h-full rounded-full bg-muted-foreground transition-[width]"
            style={{ width: `${goal.progress}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {goal.priority !== undefined && (
            <PriorityBars priority={goal.priority} />
          )}

          {month && <span className="text-muted-foreground">{month}</span>}

          <span className="ml-auto">
            <AvatarStack people={involved} max={3} />
          </span>
        </div>
      </div>
    </li>
  );
}
