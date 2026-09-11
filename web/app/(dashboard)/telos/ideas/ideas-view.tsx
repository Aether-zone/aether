'use client';

import { Button, EmptyState, Text } from '@aether-zone/kosmos';
import type { IdeaDTO, UserDTO } from '@aether/contract';
import Link from 'next/link';
import { useState } from 'react';
import { IoAddOutline, IoBulbOutline } from 'react-icons/io5';

import { AvatarStack } from '@/components/avatar-stack';

import { NewIdeaDialog } from './new-idea-dialog';
import { StatusPill } from './status-pill';

/** "Sep 9, 2026" — the day, which is all a captured-on date is good for. */
function formatDay(iso: string): string {
  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? '—'
    : at.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
}

/**
 * The ideas list.
 *
 * A list of *rows to open* rather than a list of controls. It used to edit
 * every field in place, which worked while an idea was a title and a rank;
 * now that one can name the people it involves and the goals it led to, a row
 * of five inputs says less than a line of text does.
 *
 * Nothing here keeps a copy of the list: capture revalidates the path, and
 * what comes back is the api's answer rather than this browser's recollection
 * of it. That is what stops the screen disagreeing with the store after a
 * failed save.
 */
export function IdeasView({
  ideas,
  people,
}: {
  ideas: IdeaDTO[];
  people: UserDTO[];
}) {
  const [capturing, setCapturing] = useState(false);

  const byId = new Map(people.map((person) => [person.id, person]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setCapturing(true)}>
          <IoAddOutline className="size-4" aria-hidden />
          New idea
        </Button>
      </div>

      <NewIdeaDialog
        people={people}
        open={capturing}
        onOpenChange={setCapturing}
      />

      {ideas.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="An idea here is the start of the chain: it becomes a goal, a goal is pursued by a project, and a project is done through tasks."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {ideas.map((idea) => {
            // Only the people still known. An id that resolves to nobody is a
            // person removed from prosopone since; showing a blank circle for
            // them would be worse than showing one fewer.
            const involved = (idea.involves || [])
              .map((id) => byId.get(id))
              .filter((person): person is UserDTO => person !== undefined);

            return (
              <li
                key={idea.id}
                className={[
                  'flex gap-3 p-4 transition-colors hover:bg-muted/40',
                  // A dropped idea is kept for its reason, not its prominence.
                  idea.status === 'DROPPED' && 'opacity-60',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <IoBulbOutline
                  className="mt-0.5 size-5 shrink-0 text-warning"
                  aria-hidden
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/telos/ideas/${idea.id}`}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {idea.title}
                    </Link>

                    <StatusPill status={idea.status} />

                    {idea.inspired.length > 0 && (
                      /* Uppercase and monospaced so it reads as a fact about
                         the row rather than another label competing with the
                         title. */
                      <Link
                        href={`/telos/ideas/${idea.id}`}
                        className="shrink-0 font-mono text-xs uppercase tracking-wide text-success hover:underline"
                      >
                        Inspired {idea.inspired.length}{' '}
                        {idea.inspired.length === 1 ? 'goal' : 'goals'}
                      </Link>
                    )}
                  </div>

                  {idea.description && (
                    <p className="truncate text-sm text-muted-foreground">
                      {idea.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <AvatarStack people={involved} />
                  <span className="w-28 text-right font-mono text-xs text-muted-foreground">
                    {formatDay(idea.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {ideas.length === 1 ? '1 idea' : `${ideas.length} ideas`}
      </Text>
    </div>
  );
}
