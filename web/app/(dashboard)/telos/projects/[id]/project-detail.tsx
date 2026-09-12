'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Heading,
  Text,
} from '@aether-zone/kosmos';
import type { GoalDTO, ProjectDTO, TaskDTO, UserDTO } from '@aether/contract';
import { useState } from 'react';
import {
  IoAddOutline,
  IoPersonOutline,
  IoRadioButtonOnOutline,
} from 'react-icons/io5';

import { ConnectionChip, ConnectionRow } from '@/components/connection-chip';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { PriorityBars } from '@/components/priority-bars';
import { TaskRow } from '@/components/task-row';
import { fullName } from '@/lib/person-display';
import { byWhatNeedsDoing } from '@/lib/task-order';

import { DOTS, STATUSES } from '../statuses';
import { AddTaskDialog } from './add-task-dialog';

/** "Sep 30, 2026". */
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

/** A small caps label. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * One project: how far along it is, what is left, and what it is for.
 *
 * The tasks are the page. A project is a container, and the only question
 * anyone opens it with is "what is still outstanding" — so the list sits above
 * the connections and below the bar that summarises it, and the bar is filled
 * from those same tasks rather than from anything anyone typed.
 */
export function ProjectDetail({
  project,
  tasks,
  realizes,
  involved,
}: {
  project: ProjectDTO;
  tasks: TaskDTO[];
  realizes: GoalDTO[];
  involved: UserDTO[];
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { done, total } = project.tasks;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const due = formatDay(project.targetAt);
  const ordered = [...tasks].sort(byWhatNeedsDoing);
  const hasConnections = realizes.length > 0 || involved.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageBreadcrumbs leaf={project.title} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow>Project</Eyebrow>
          <Heading level={1} size="heading-large">
            {project.title}
          </Heading>
        </div>

        <Button type="button" onClick={() => setAdding(true)}>
          <IoAddOutline className="size-4" aria-hidden />
          Add task
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AddTaskDialog project={project} open={adding} onOpenChange={setAdding} />

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
            <div className="flex items-baseline justify-between gap-3">
              <Text weight="medium">Progress</Text>
              <span className="font-mono text-sm text-muted-foreground">
                {done}/{total}
                {total > 0 && (
                  <>
                    {' '}
                    <span aria-hidden>·</span> {percent}%
                  </>
                )}
              </span>
            </div>

            <div
              className="h-1.5 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${done} of ${total} tasks done`}
            >
              <div
                className="h-full rounded-full bg-muted-foreground transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>

            {project.description && (
              <p className="whitespace-pre-wrap text-foreground">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Eyebrow>Tasks</Eyebrow>

            {ordered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Text tone="muted" size="body-small">
                  Nothing broken down yet. A project can be planned before
                  anyone says what the work is.
                </Text>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {ordered.map((task) => (
                  <TaskRow key={task.id} task={task} onError={setError} />
                ))}
              </ul>
            )}
          </div>

          {hasConnections && (
            <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
              <Eyebrow>Connections</Eyebrow>

              <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4">
                {realizes.length > 0 && (
                  <ConnectionRow label="Realizes">
                    {realizes.map((goal) => (
                      <ConnectionChip
                        key={goal.id}
                        href={`/telos/goals/${goal.id}`}
                        icon={
                          <IoRadioButtonOnOutline
                            className="size-4 text-success"
                            aria-hidden
                          />
                        }
                      >
                        {goal.title}
                      </ConnectionChip>
                    ))}
                  </ConnectionRow>
                )}

                {involved.length > 0 && (
                  <ConnectionRow label="With">
                    {involved.map((person) => (
                      <ConnectionChip
                        key={person.id}
                        href="/prosopone/people"
                        icon={
                          <IoPersonOutline
                            className="size-4 text-destructive"
                            aria-hidden
                          />
                        }
                      >
                        {fullName(person)}
                      </ConnectionChip>
                    ))}
                  </ConnectionRow>
                )}

                {/* No "Has task" row. The mockup has one, but it would be the
                    same list as the section above in a less useful form — the
                    rows up there can be ticked off, where a chip cannot. */}
              </div>
            </div>
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-6 lg:w-64 lg:border-l lg:border-border lg:pl-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>Status</Eyebrow>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${DOTS[project.status]}`}
                aria-hidden
              />
              {STATUSES[project.status].label}
            </span>
          </div>

          {project.priority !== undefined && (
            <div className="flex flex-col gap-2">
              <Eyebrow>Priority</Eyebrow>
              <span className="w-fit">
                <PriorityBars priority={project.priority} />
              </span>
            </div>
          )}

          {due && (
            <div className="flex flex-col gap-2">
              <Eyebrow>Due</Eyebrow>
              <Text>{due}</Text>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
