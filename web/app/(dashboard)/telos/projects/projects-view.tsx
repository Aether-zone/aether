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
  PROJECT_STATUSES,
  type ProjectDTO,
  type ProjectStatus,
} from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';
import { IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import { formatDeadline } from '@/lib/goal-order';
import { isLive } from '@/lib/project-order';

import { addProjectAction, changeProjectAction, removeProjectAction } from './actions';

const STATUSES: Record<
  ProjectStatus,
  { label: string; variant: 'secondary' | 'warning' | 'success' | 'outline' }
> = {
  // Planned work is real but not yet happening, so it reads quieter than
  // active without being greyed out like something that is over.
  PLANNED: { label: 'Planned', variant: 'secondary' },
  ACTIVE: { label: 'Active', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};

/**
 * The projects list, which is also the editor.
 *
 * Starting one takes a title and, optionally, a deadline — the two things
 * anybody has when they decide a piece of work exists. Everything else happens
 * on the row.
 *
 * Nothing here keeps a copy of the list: each action revalidates the path, and
 * what comes back is the api's answer rather than this browser's recollection
 * of it.
 */
export function ProjectsView({ projects }: { projects: ProjectDTO[] }) {
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
      const result = await addProjectAction({ title, targetAt });

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
      const result = await changeProjectAction(id, changes);

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

  function remove(project: ProjectDTO) {
    setError(null);
    setBusyId(project.id);

    startTransition(async () => {
      const result = await removeProjectAction(project.id);

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
          placeholder="What needs doing?"
          aria-label="New project"
          className="min-w-48 flex-1"
        />
        {/* A date, not a datetime: nobody sets a project for 3pm. The action
            reads it as the end of that day. */}
        <Input
          type="date"
          value={targetAt}
          onChange={(event) => setTargetAt(event.target.value)}
          aria-label="Target date (optional)"
          className="w-44"
        />
        <Button type="submit" disabled={pending || !title.trim()}>
          Start project
        </Button>
      </form>

      {projects.length === 0 ? (
        <EmptyState
          title="No work planned yet"
          description="A project is the step after a goal: the piece of work that pursues it, which tasks then carry out."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => {
            const deadline = formatDeadline(project.targetAt);
            /*
             * Planned work can be late too — a project that was due to start
             * and finish by a date it has passed is overdue whether or not
             * anyone began it. Only work that is *over* cannot be.
             */
            const overdue =
              isLive(project.status) &&
              project.targetAt !== undefined &&
              project.targetAt < new Date().toISOString();

            return (
              <li
                key={project.id}
                className={[
                  'flex flex-wrap items-center gap-3 rounded-md border border-border p-3',
                  // Finished or cancelled work is kept for the record, not
                  // for its prominence. Planned work is neither.
                  !isLive(project.status) && 'opacity-60',
                  busyId === project.id && 'opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {project.title}
                  </span>
                  {project.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {project.description}
                    </span>
                  )}
                </span>

                {deadline && (
                  /* Only a live project can be late. A completed one that ran
                     past its date is not a problem to flag — it is finished. */
                  <Text
                    tone={overdue ? 'destructive' : 'muted'}
                    size="body-small"
                    className="whitespace-nowrap"
                  >
                    {overdue ? `overdue — due ${deadline}` : `due ${deadline}`}
                  </Text>
                )}

                <Badge variant={STATUSES[project.status].variant} size="sm">
                  {STATUSES[project.status].label}
                </Badge>

                <Select
                  aria-label={`Status of ${project.title}`}
                  value={project.status}
                  disabled={busyId === project.id}
                  onChange={(event) =>
                    change(project.id, { status: event.target.value })
                  }
                  className="w-36"
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUSES[status].label}
                    </option>
                  ))}
                </Select>

                <IconButton
                  aria-label={`Delete ${project.title}`}
                  disabled={busyId === project.id}
                  onClick={() => remove(project)}
                >
                  <IoTrashOutline className="size-4" aria-hidden />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {projects.length === 1 ? '1 project' : `${projects.length} projects`}
      </Text>
    </div>
  );
}
