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
  CLOSED_STATUSES,
  PRIORITY_MIN,
  PRIORITY_MAX,
  TASK_STATUSES,
  type ProjectDTO,
  type TaskDTO,
} from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';
import { IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import { formatDue, isOverdue } from '@/lib/task-order';

import { addTaskAction, changeTaskAction, removeTaskAction } from './actions';
import { STATUSES } from './statuses';

const PRIORITIES = Array.from(
  { length: PRIORITY_MAX - PRIORITY_MIN + 1 },
  (_, index) => PRIORITY_MIN + index,
);

/** A date input wants `yyyy-mm-dd`; the api speaks ISO instants. */
const toDateValue = (iso: string | undefined): string =>
  iso ? iso.slice(0, 10) : '';

/**
 * A date alone means the end of that day, in the reader's own zone.
 *
 * "Due the 31st" is a statement about a day, not a moment — and treating it as
 * midnight at the *start* would make a task due today read as overdue from the
 * moment it was written down.
 */
const toDueInstant = (date: string): string | null => {
  if (!date) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const end = new Date(year, month - 1, day, 23, 59, 59, 0);

  return Number.isNaN(end.getTime()) ? null : end.toISOString();
};

/**
 * The task list, which is also the editor.
 *
 * Capture is a single field and Enter, for the same reason idea capture is: a
 * task that has to be filled in properly before it can be recorded is a task
 * that stays in someone's head. Everything else — its state, its rank, its
 * project, its deadline — happens on the row.
 *
 * Nothing here keeps a copy of the list: each action revalidates the path, and
 * what comes back is the api's answer rather than this browser's recollection
 * of it. That is what stops the screen disagreeing with the store after a
 * failed save.
 */
export function TasksView({
  tasks,
  projects,
}: {
  tasks: TaskDTO[];
  projects: ProjectDTO[];
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = tasks.filter(
    (task) => !CLOSED_STATUSES.includes(task.status),
  ).length;

  function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await addTaskAction({ title });

      if (result.error || result.fieldErrors) {
        setError(
          result.error ?? result.fieldErrors?.title ?? 'That could not be saved.',
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
      const result = await changeTaskAction(id, changes);

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

  function remove(task: TaskDTO) {
    setError(null);
    setBusyId(task.id);

    startTransition(async () => {
      const result = await removeTaskAction(task.id);

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
          placeholder="What needs doing?"
          aria-label="New task"
          className="flex-1"
        />
        <Button type="submit" disabled={pending || !title.trim()}>
          Add
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing to do"
          description="The end of the chain: an idea becomes a goal, a goal is pursued by a project, and a project is done through tasks."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => {
            const closed = CLOSED_STATUSES.includes(task.status);
            const due = formatDue(task.dueAt);
            const overdue = isOverdue(task);

            return (
              <li
                key={task.id}
                className={[
                  'flex flex-wrap items-center gap-3 rounded-md border p-3',
                  overdue ? 'border-destructive/50' : 'border-border',
                  // A finished task is kept for the record, not for its
                  // prominence.
                  closed && 'opacity-60',
                  busyId === task.id && 'opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      'block truncate font-medium text-foreground',
                      task.status === 'DONE' && 'line-through',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {task.title}
                  </span>
                  {due && (
                    <span
                      className={[
                        'mt-0.5 block text-xs',
                        overdue
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {overdue ? `Overdue — due ${due}` : `Due ${due}`}
                    </span>
                  )}
                </span>

                <Badge variant={STATUSES[task.status].variant} size="sm">
                  {STATUSES[task.status].label}
                </Badge>

                {/* Which project this is part of. "None" is a real answer, not
                    a missing one: a task can be written down before anyone has
                    decided where it belongs. */}
                <Select
                  aria-label={`Project of ${task.title}`}
                  value={task.projectId ?? ''}
                  disabled={busyId === task.id}
                  onChange={(event) =>
                    change(task.id, {
                      projectId:
                        event.target.value === '' ? null : event.target.value,
                    })
                  }
                  className="w-40"
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </Select>

                <Input
                  type="date"
                  aria-label={`Due date of ${task.title}`}
                  value={toDateValue(task.dueAt)}
                  disabled={busyId === task.id}
                  onChange={(event) =>
                    change(task.id, { dueAt: toDueInstant(event.target.value) })
                  }
                  className="w-36"
                />

                <Select
                  aria-label={`Priority of ${task.title}`}
                  value={task.priority === undefined ? '' : String(task.priority)}
                  disabled={busyId === task.id}
                  onChange={(event) =>
                    change(task.id, {
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
                  aria-label={`Status of ${task.title}`}
                  value={task.status}
                  disabled={busyId === task.id}
                  onChange={(event) =>
                    change(task.id, { status: event.target.value })
                  }
                  className="w-32"
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUSES[status].label}
                    </option>
                  ))}
                </Select>

                <IconButton
                  aria-label={`Delete ${task.title}`}
                  disabled={busyId === task.id}
                  onClick={() => remove(task)}
                >
                  <IoTrashOutline className="size-4" aria-hidden />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {/* What is left, not what exists: a list of 40 where 38 are done is a
            good day, and a count of 40 would read as the opposite. */}
        {open === 0
          ? `Nothing open, ${tasks.length === 1 ? '1 task' : `${tasks.length} tasks`} in all`
          : `${open === 1 ? '1 task' : `${open} tasks`} open of ${tasks.length}`}
      </Text>
    </div>
  );
}
