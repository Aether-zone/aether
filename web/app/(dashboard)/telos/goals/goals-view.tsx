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
  GOAL_STATUSES,
  type GoalDTO,
} from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';
import { IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import { formatDeadline } from '@/lib/goal-order';

import { addGoalAction, changeGoalAction, removeGoalAction } from './actions';
import { STATUSES } from './statuses';

/**
 * The goals list, which is also the editor.
 *
 * Setting one takes a title and, optionally, a date — the two things anybody
 * has at the moment they decide to aim at something. Everything else happens
 * on the row.
 *
 * Nothing here keeps a copy of the list: each action revalidates the path, and
 * what comes back is the api's answer rather than this browser's recollection
 * of it.
 */
export function GoalsView({ goals }: { goals: GoalDTO[] }) {
  const [title, setTitle] = useState('');
  const [targetAt, setTargetAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await addGoalAction({ title, targetAt });

      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0] ??
            'That could not be saved.',
        );

        return;
      }

      // Cleared only on success, so a failed save does not lose the input.
      setTitle('');
      setTargetAt('');
    });
  }

  function change(id: string, changes: Record<string, unknown>) {
    setError(null);
    setBusyId(id);

    startTransition(async () => {
      const result = await changeGoalAction(id, changes);

      setBusyId(null);

      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0] ??
            'That could not be saved.',
        );
      }
    });
  }

  function remove(goal: GoalDTO) {
    setError(null);
    setBusyId(goal.id);

    startTransition(async () => {
      const result = await removeGoalAction(goal.id);

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

      <form onSubmit={set} className="flex flex-wrap gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What are you aiming at?"
          aria-label="New goal"
          className="min-w-48 flex-1"
        />
        {/* A date, not a datetime: nobody sets a goal for 3pm. The action
            reads it as the end of that day. */}
        <Input
          type="date"
          value={targetAt}
          onChange={(event) => setTargetAt(event.target.value)}
          aria-label="Target date (optional)"
          className="w-44"
        />
        <Button type="submit" disabled={pending || !title.trim()}>
          Set goal
        </Button>
      </form>

      {goals.length === 0 ? (
        <EmptyState
          title="Nothing to aim at yet"
          description="A goal is the step after an idea: something you have decided to reach, which projects and tasks then work towards."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((goal) => {
            const deadline = formatDeadline(goal.targetAt);
            const overdue =
              goal.status === 'ACTIVE' &&
              goal.targetAt !== undefined &&
              goal.targetAt < new Date().toISOString();

            return (
              <li
                key={goal.id}
                className={[
                  'flex flex-wrap items-center gap-3 rounded-md border border-border p-3',
                  // A settled goal is kept for the record, not for its
                  // prominence.
                  goal.status !== 'ACTIVE' && 'opacity-60',
                  busyId === goal.id && 'opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {goal.title}
                  </span>
                  {goal.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {goal.description}
                    </span>
                  )}
                </span>

                {deadline && (
                  /* Only a live goal can be late. A completed one that ran
                     past its date is not a problem to flag — it is finished. */
                  <Text
                    tone={overdue ? 'destructive' : 'muted'}
                    size="body-small"
                    className="whitespace-nowrap"
                  >
                    {overdue ? `overdue — due ${deadline}` : `due ${deadline}`}
                  </Text>
                )}

                <Badge variant={STATUSES[goal.status].variant} size="sm">
                  {STATUSES[goal.status].label}
                </Badge>

                <Select
                  aria-label={`Status of ${goal.title}`}
                  value={goal.status}
                  disabled={busyId === goal.id}
                  onChange={(event) =>
                    change(goal.id, { status: event.target.value })
                  }
                  className="w-36"
                >
                  {GOAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUSES[status].label}
                    </option>
                  ))}
                </Select>

                <IconButton
                  aria-label={`Delete ${goal.title}`}
                  disabled={busyId === goal.id}
                  onClick={() => remove(goal)}
                >
                  <IoTrashOutline className="size-4" aria-hidden />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {goals.length === 1 ? '1 goal' : `${goals.length} goals`}
      </Text>
    </div>
  );
}
