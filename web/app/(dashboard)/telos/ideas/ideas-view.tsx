'use client';

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  EmptyState,
  Input,
  Select,
  Text,
} from '@aether-zone/kosmos';
import {
  IDEA_STATUSES,
  PRIORITY_MAX,
  PRIORITY_MIN,
  type IdeaDTO,
} from '@aether/contract';
import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';
import { IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';

import { addIdeaAction, changeIdeaAction, removeIdeaAction } from './actions';
import { STATUSES } from './statuses';

const PRIORITIES = Array.from(
  { length: PRIORITY_MAX - PRIORITY_MIN + 1 },
  (_, index) => PRIORITY_MIN + index,
);

/**
 * The ideas list, which is also the editor.
 *
 * Capture is a single field and Enter, because the contract's whole position
 * on an idea is that one which has to be filled in properly is one nobody
 * writes down. Everything else — ranking it, promoting it, dropping it —
 * happens on the row, since a separate screen for changing one field is more
 * ceremony than the change deserves.
 *
 * Nothing here keeps a copy of the list: each action revalidates the path, and
 * what comes back is the api's answer rather than this browser's recollection
 * of it. That is what stops the screen disagreeing with the store after a
 * failed save.
 */
export function IdeasView({ ideas }: { ideas: IdeaDTO[] }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await addIdeaAction(title);

      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            result.fieldErrors?.title ??
            'That could not be saved.',
        );

        return;
      }

      // Cleared only on success, so a failed capture does not lose what was
      // typed.
      setTitle('');
    });
  }

  function change(id: string, changes: Record<string, unknown>) {
    setError(null);
    setBusyId(id);

    startTransition(async () => {
      const result = await changeIdeaAction(id, changes);

      setBusyId(null);

      if (result.error) {
        setError(result.error);
      }
    });
  }

  function remove(idea: IdeaDTO) {
    setError(null);
    setBusyId(idea.id);

    startTransition(async () => {
      const result = await removeIdeaAction(idea.id);

      setBusyId(null);

      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* One field and Enter. Anything more is a reason not to bother. */}
      <form onSubmit={capture} className="flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Write it down…"
          aria-label="New idea"
          className="flex-1"
        />
        <Button type="submit" disabled={pending || !title.trim()}>
          Capture
        </Button>
      </form>

      {ideas.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="An idea here is the start of the chain: it becomes a goal, a goal is pursued by a project, and a project is done through tasks."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className={[
                'flex flex-wrap items-center gap-3 rounded-md border border-border p-3',
                // A dropped idea is kept for its reason, not for its
                // prominence.
                idea.status === 'DROPPED' && 'opacity-60',
                busyId === idea.id && 'opacity-50',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="min-w-0 flex-1">
                {/* The title is the way in. A row that could only be edited in
                    place had nowhere to put a description, which is the field
                    capture deliberately does not ask for. */}
                <Link
                  href={`/telos/ideas/${idea.id}`}
                  className="block truncate font-medium text-foreground hover:underline"
                >
                  {idea.title}
                </Link>
                {idea.description && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {idea.description}
                  </span>
                )}
              </span>

              <Badge variant={STATUSES[idea.status].variant} size="sm">
                {STATUSES[idea.status].label}
              </Badge>

              {/* Ranking is a select rather than a number box: the scale is
                  five steps, and typing 7 into a field that rejects it is a
                  worse way to learn that than not offering it. */}
              <Select
                aria-label={`Priority of ${idea.title}`}
                value={idea.priority === undefined ? '' : String(idea.priority)}
                disabled={busyId === idea.id}
                onChange={(event) =>
                  change(idea.id, {
                    // "" un-ranks it, which is a different instruction from
                    // leaving the ranking alone.
                    priority:
                      event.target.value === ''
                        ? null
                        : Number(event.target.value),
                  })
                }
                className="w-24"
              >
                <option value="">Unranked</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                    {priority === PRIORITY_MIN ? ' (top)' : ''}
                  </option>
                ))}
              </Select>

              <Select
                aria-label={`Status of ${idea.title}`}
                value={idea.status}
                disabled={busyId === idea.id}
                onChange={(event) =>
                  change(idea.id, { status: event.target.value })
                }
                className="w-32"
              >
                {IDEA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUSES[status].label}
                  </option>
                ))}
              </Select>

              <IconButton
                aria-label={`Delete ${idea.title}`}
                disabled={busyId === idea.id}
                onClick={() => remove(idea)}
              >
                <IoTrashOutline className="size-4" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {ideas.length === 1 ? '1 idea' : `${ideas.length} ideas`}
      </Text>
    </div>
  );
}
