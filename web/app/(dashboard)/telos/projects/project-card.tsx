'use client';

import type { GoalDTO, ProjectDTO, UserDTO } from '@aether/contract';
import Link from 'next/link';

import { AvatarStack } from '@/components/avatar-stack';
import { PriorityBars } from '@/components/priority-bars';

import { DOTS, STATUSES } from './statuses';

/** "Sep 30, 2026" — a project's deadline is a day, not a month. */
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

/**
 * One project, as a card.
 *
 * The line that matters most is **what it realizes**. A project without a goal
 * above it is work nobody can justify, so the goal is given a line of its own
 * rather than a footnote — and when there is none, the line is simply absent,
 * which reads as a question rather than a gap.
 *
 * The bar is filled from the tasks, not from a number somebody typed, so it
 * cannot disagree with the work. `0/0` shows an empty bar with the count
 * beside it: nothing is done because nothing has been asked for yet, and those
 * are different from a project that is genuinely stuck at zero.
 */
export function ProjectCard({
  project,
  goals,
  people,
}: {
  project: ProjectDTO;
  goals: GoalDTO[];
  people: UserDTO[];
}) {
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));

  const realizes = project.pursues
    .map((id) => goalsById.get(id))
    .filter((goal): goal is GoalDTO => goal !== undefined);

  const involved = project.involves
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is UserDTO => person !== undefined);

  const { done, total } = project.tasks;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const day = formatDay(project.targetAt);
  const settled =
    project.status === 'COMPLETED' || project.status === 'CANCELLED';

  return (
    <li
      className={[
        'flex flex-col gap-4 rounded-lg border border-border p-5 transition-colors hover:border-muted-foreground/40',
        settled && 'opacity-70',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/telos/projects/${project.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {project.title}
        </Link>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <span
            className={`size-1.5 rounded-full ${DOTS[project.status]}`}
            aria-hidden
          />
          {STATUSES[project.status].label}
        </span>
      </div>

      {project.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}

      {realizes.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs uppercase tracking-wide text-success">
          <span>Realizes</span>
          <span aria-hidden>·</span>
          {realizes.map((goal) => (
            <Link
              key={goal.id}
              href={`/telos/goals/${goal.id}`}
              className="hover:underline"
            >
              {goal.title}
            </Link>
          ))}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${project.title}: ${done} of ${total} tasks done`}
        >
          <div
            className="h-full rounded-full bg-muted-foreground transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {project.priority !== undefined && (
            <PriorityBars priority={project.priority} />
          )}

          <span className="font-mono text-xs text-muted-foreground">
            {done}/{total}
          </span>

          <span className="ml-auto flex items-center gap-3">
            <AvatarStack people={involved} max={3} />
            {day && (
              <span className="font-mono text-xs text-muted-foreground">
                {day}
              </span>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}
