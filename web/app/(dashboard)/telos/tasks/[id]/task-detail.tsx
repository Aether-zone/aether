'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import {
  CLOSED_STATUSES,
  PRIORITY_MAX,
  PRIORITY_MIN,
  TASK_STATUSES,
  type ProjectDTO,
  type TaskDTO,
} from '@aether/contract';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  IoCheckmarkOutline,
  IoLayersOutline,
  IoRefreshOutline,
  IoTrashOutline,
} from 'react-icons/io5';

import { ConnectionChip, ConnectionRow } from '@/components/connection-chip';
import { IconButton } from '@/components/icon-button';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { PriorityBars } from '@/components/priority-bars';
import { priorityWord } from '@/lib/goal-priority';
import { isOverdue } from '@/lib/task-order';
import { toIsoInstant } from '@/lib/when';

import { changeTaskAction, removeTaskAction } from '../actions';
import { DOTS, PILLS, STATUSES } from '../statuses';

const TASKS = '/telos/tasks';

const PRIORITIES = Array.from(
  { length: PRIORITY_MAX - PRIORITY_MIN + 1 },
  (_, index) => PRIORITY_MIN + index,
);

/** "Sep 9, 2026". */
function formatDay(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }

  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? null
    : at.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

/** A date input wants `yyyy-mm-dd`; the api speaks ISO instants. */
const toDateValue = (iso: string | undefined): string =>
  iso ? iso.slice(0, 10) : '';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * One task: what it is, what it belongs to, and when it is due.
 *
 * A reading page with editing available, like the idea page — a task is looked
 * at far more often than it is changed, and a screen of populated inputs makes
 * the reader do the work of telling content from chrome. Each field turns into
 * a control when clicked, and the one thing anybody does in passing has a
 * button of its own.
 *
 * This is also the only place a task can be deleted. The board that used to
 * carry that control now carries a checkbox instead, which is right for a list
 * and left nowhere to remove one from.
 */
export function TaskDetail({
  task,
  project,
  projects,
}: {
  task: TaskDTO;
  /** The project this belongs to, where it still resolves. */
  project: ProjectDTO | null;
  /** Everywhere it could belong, for the picker. */
  projects: ProjectDTO[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<
    'description' | 'status' | 'priority' | 'due' | 'project' | null
  >(null);
  const [description, setDescription] = useState(task.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const done = task.status === 'DONE';
  const closed = CLOSED_STATUSES.includes(task.status);
  const due = formatDay(task.dueAt);
  const overdue = isOverdue(task);

  function change(changes: Record<string, unknown>, onDone?: () => void) {
    setError(null);

    startTransition(async () => {
      const result = await changeTaskAction(task.id, changes);

      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0] ??
            'That could not be saved.',
        );

        return;
      }

      onDone?.();
    });
  }

  function remove() {
    setError(null);

    startTransition(async () => {
      const result = await removeTaskAction(task.id);

      if (result.error) {
        setError(result.error);

        return;
      }

      // Back to the board: this page's subject no longer exists, and leaving
      // it on screen would invite editing something that is gone.
      router.push(TASKS);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageBreadcrumbs leaf={task.title} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow>Task</Eyebrow>
          <Heading level={1} size="heading-large">
            <span className={done ? 'line-through' : undefined}>
              {task.title}
            </span>
          </Heading>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The one thing anyone does to a task in passing. Reopening returns
              it to TODO rather than to whatever it was before: there is no
              history to restore, and inventing IN_PROGRESS for something
              somebody just said was unfinished would put words in their
              mouth. */}
          <Button
            type="button"
            disabled={pending}
            onClick={() => change({ status: done ? 'TODO' : 'DONE' })}
          >
            {done ? (
              <IoRefreshOutline className="size-4" aria-hidden />
            ) : (
              <IoCheckmarkOutline className="size-4" aria-hidden />
            )}
            {done ? 'Reopen' : 'Mark complete'}
          </Button>

          <IconButton
            variant="outline"
            aria-label="Delete this task"
            title="Delete"
            disabled={pending}
            onClick={remove}
            className="text-destructive"
          >
            <IoTrashOutline className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {editing === 'description' ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                autoFocus
                aria-label="Description"
                placeholder="What does doing this involve?"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    change(
                      {
                        // "" is not a description, and the update shape takes
                        // `null` to mean remove it.
                        description:
                          description.trim() === '' ? null : description.trim(),
                      },
                      () => setEditing(null),
                    )
                  }
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDescription(task.description ?? '');
                    setEditing(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing('description')}
              className="rounded-lg border border-border p-5 text-left transition-colors hover:border-muted-foreground/40"
            >
              {task.description ? (
                <p className="whitespace-pre-wrap text-foreground">
                  {task.description}
                </p>
              ) : (
                <p className="text-muted-foreground">No description yet.</p>
              )}
            </button>
          )}

          <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
            <Eyebrow>Connections</Eyebrow>

            <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4">
              <ConnectionRow label="Part of">
                {editing === 'project' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label="Project"
                      defaultValue={task.projectId ?? ''}
                      disabled={pending}
                      onChange={(event) =>
                        change(
                          {
                            projectId:
                              event.target.value === ''
                                ? null
                                : event.target.value,
                          },
                          () => setEditing(null),
                        )
                      }
                      className="w-56"
                    >
                      <option value="">No project</option>
                      {projects.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.title}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {project && (
                      <ConnectionChip
                        href={`/telos/projects/${project.id}`}
                        icon={
                          <IoLayersOutline
                            className="size-4 text-primary"
                            aria-hidden
                          />
                        }
                      >
                        {project.title}
                      </ConnectionChip>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing('project')}
                    >
                      {project ? 'Change' : 'File it somewhere'}
                    </Button>
                  </div>
                )}
              </ConnectionRow>
            </div>
          </div>
        </div>

        <aside className="flex shrink-0 flex-col gap-6 lg:w-64 lg:border-l lg:border-border lg:pl-8">
          {/* Every field in this rail reads as a value and becomes a control
              when clicked. "Mark complete" covers the common case; this is
              here for the states a button cannot express — blocked, or called
              off. */}
          <div className="flex flex-col gap-2">
            <Eyebrow>Status</Eyebrow>
            {editing === 'status' ? (
              <Select
                aria-label="Status"
                autoFocus
                defaultValue={task.status}
                disabled={pending}
                onChange={(event) =>
                  change({ status: event.target.value }, () => setEditing(null))
                }
                className="w-40"
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUSES[status].label}
                  </option>
                ))}
              </Select>
            ) : (
              <button
                type="button"
                onClick={() => setEditing('status')}
                className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${PILLS[task.status]}`}
              >
                <span
                  className={`size-1.5 rounded-full ${DOTS[task.status]}`}
                  aria-hidden
                />
                {STATUSES[task.status].label}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>Priority</Eyebrow>
            {editing === 'priority' ? (
              <Select
                aria-label="Priority"
                autoFocus
                defaultValue={
                  task.priority === undefined ? '' : String(task.priority)
                }
                disabled={pending}
                onChange={(event) =>
                  change(
                    {
                      priority:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    },
                    () => setEditing(null),
                  )
                }
                className="w-40"
              >
                <option value="">Unranked</option>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value} · {priorityWord(value)}
                  </option>
                ))}
              </Select>
            ) : (
              <button
                type="button"
                onClick={() => setEditing('priority')}
                className="w-fit rounded text-left"
              >
                {task.priority === undefined ? (
                  <Text tone="muted" size="body-small">
                    Unranked
                  </Text>
                ) : (
                  <PriorityBars priority={task.priority} />
                )}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>Due</Eyebrow>
            {editing === 'due' ? (
              <Input
                type="date"
                aria-label="Due date"
                autoFocus
                defaultValue={toDateValue(task.dueAt)}
                disabled={pending}
                onChange={(event) =>
                  change(
                    {
                      /*
                       * A date alone means the end of that day in the reader's
                       * zone. Midnight at the start would make a task due today
                       * read as overdue from the moment it was set.
                       */
                      dueAt: event.target.value
                        ? toIsoInstant(`${event.target.value}T23:59`)
                        : null,
                    },
                    () => setEditing(null),
                  )
                }
                className="w-40"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing('due')}
                className="w-fit rounded text-left"
              >
                {due ? (
                  <Text tone={overdue ? 'destructive' : 'default'}>
                    {overdue ? `${due} — overdue` : due}
                  </Text>
                ) : (
                  <Text tone="muted" size="body-small">
                    No date
                  </Text>
                )}
              </button>
            )}
          </div>

          {task.closedAt && closed && (
            <div className="flex flex-col gap-2">
              <Eyebrow>{done ? 'Completed' : 'Cancelled'}</Eyebrow>
              <Text>{formatDay(task.closedAt)}</Text>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
