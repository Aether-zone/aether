'use client';

import { CLOSED_STATUSES, type TaskDTO } from '@aether/contract';
import { useTransition } from 'react';

import { DOTS, PILLS, STATUSES } from '@/app/(dashboard)/telos/tasks/statuses';
import { PriorityBars } from '@/components/priority-bars';
import { formatDueShort, isOverdue } from '@/lib/task-order';

import { changeTaskAction } from '@/app/(dashboard)/telos/tasks/actions';

/**
 * One task, with the checkbox that finishes it.
 *
 * The checkbox is the whole interaction. A task list is read to answer "what
 * is left", and the only thing anyone does to it in passing is tick something
 * off.
 *
 * `project` and `status` are shown only where they say something. On a
 * project's own page every row has the same project and they are grouped by
 * nothing, so both would be noise; on the tasks page the project is the only
 * context a row has, and the group heading does not survive being scrolled
 * past.
 *
 * Unticking a `DONE` task returns it to `TODO` rather than to whatever it was
 * before. The service does not keep a history to restore, and inventing
 * `IN_PROGRESS` for something somebody just said was not finished would be
 * putting words in their mouth.
 */
export function TaskRow({
  task,
  project,
  showStatus = false,
  onError,
}: {
  task: TaskDTO;
  /** The project's title, where a row needs to say which one it is in. */
  project?: string;
  showStatus?: boolean;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  const done = task.status === 'DONE';
  const closed = CLOSED_STATUSES.includes(task.status);
  const due = formatDueShort(task.dueAt);
  const overdue = isOverdue(task);

  function toggle() {
    startTransition(async () => {
      const result = await changeTaskAction(task.id, {
        status: done ? 'TODO' : 'DONE',
      });

      if (result.error || result.fieldErrors) {
        onError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0] ??
            'That could not be saved.',
        );
      }
    });
  }

  return (
    <li
      className={[
        'flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40',
        closed && 'opacity-60',
        pending && 'opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={toggle}
        aria-label={done ? `Reopen ${task.title}` : `Finish ${task.title}`}
        className="size-4 shrink-0 rounded border-border accent-current"
      />

      <span
        className={[
          'min-w-0 flex-1 truncate text-sm',
          closed ? 'text-muted-foreground line-through' : 'text-foreground',
        ].join(' ')}
      >
        {task.title}
      </span>

      {project && (
        <span className="hidden shrink-0 truncate text-sm text-muted-foreground sm:block sm:max-w-48">
          {project}
        </span>
      )}

      {task.priority !== undefined && <PriorityBars priority={task.priority} />}

      {/* A fixed-width column so the dates line up down the list; an em dash
          rather than an empty cell, because a blank reads as a rendering
          failure where a dash reads as "no date". */}
      <span
        className={[
          'w-20 shrink-0 text-right font-mono text-xs',
          overdue ? 'text-destructive' : 'text-muted-foreground',
        ].join(' ')}
      >
        {due ?? '—'}
      </span>

      {showStatus && (
        <span
          className={`inline-flex w-28 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${PILLS[task.status]}`}
        >
          <span
            className={`size-1.5 rounded-full ${DOTS[task.status]}`}
            aria-hidden
          />
          {STATUSES[task.status].label}
        </span>
      )}
    </li>
  );
}
