'use client';

import {
  Alert,
  AlertDescription,
  Button,
  EmptyState,
  Text,
} from '@aether-zone/kosmos';
import {
  CLOSED_STATUSES,
  type ProjectDTO,
  type TaskDTO,
  type TaskStatus,
} from '@aether/contract';
import { useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';

import { TaskRow } from '@/components/task-row';
import { byWhatNeedsDoing } from '@/lib/task-order';

import { NewTaskDialog } from './new-task-dialog';
import { BOARD_ORDER, STATUSES } from './statuses';

/**
 * The task board, grouped by state.
 *
 * Grouped rather than sorted, for the reason the goals board is: a task's
 * state decides whether it is a question for today at all, and a single
 * ordered list makes the reader do that sorting in their head every visit.
 * The counts are in the headings because "how much is actually on me" is what
 * a person opens this page to find out.
 *
 * Within a group the order is `byWhatNeedsDoing` — soonest deadline, then
 * rank, then oldest. Its own status banding is redundant here and harmless:
 * every task in a group shares a state, so that clause never fires.
 */
export function TasksView({
  tasks,
  projects,
}: {
  tasks: TaskDTO[];
  projects: ProjectDTO[];
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titles = new Map(
    projects.map((project) => [project.id, project.title]),
  );

  const grouped = new Map<TaskStatus, TaskDTO[]>(
    BOARD_ORDER.map((status) => [
      status,
      tasks.filter((task) => task.status === status).sort(byWhatNeedsDoing),
    ]),
  );

  const open = tasks.filter(
    (task) => !CLOSED_STATUSES.includes(task.status),
  ).length;

  return (
    <div className="flex flex-col gap-10">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={() => setAdding(true)}>
          <IoAddOutline className="size-4" aria-hidden />
          New task
        </Button>
      </div>

      <NewTaskDialog
        projects={projects}
        open={adding}
        onOpenChange={setAdding}
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing to do"
          description="The end of the chain: an idea becomes a goal, a goal is pursued by a project, and a project is done through tasks."
        />
      ) : (
        BOARD_ORDER.map((status) => {
          const inGroup = grouped.get(status) ?? [];

          // An empty group prints no heading. Five headings over three tasks
          // would read as mostly-empty rather than mostly-done.
          if (inGroup.length === 0) {
            return null;
          }

          return (
            <section key={status} className="flex flex-col gap-4">
              <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {STATUSES[status].label}
                <span aria-hidden>·</span>
                <span>{inGroup.length}</span>
              </h2>

              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {inGroup.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={
                      task.projectId ? titles.get(task.projectId) : undefined
                    }
                    showStatus
                    onError={setError}
                  />
                ))}
              </ul>
            </section>
          );
        })
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
