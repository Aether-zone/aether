'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Heading,
  Text,
} from '@aether-zone/kosmos';
import type {
  EventDTO,
  GoalDTO,
  IdeaDTO,
  ProjectDTO,
  ResourceDTO,
  UserDTO,
} from '@aether/contract';
import { useState, useTransition } from 'react';
import {
  IoBookOutline,
  IoBulbOutline,
  IoCalendarOutline,
  IoLayersOutline,
  IoPersonOutline,
} from 'react-icons/io5';

import { ConnectionChip, ConnectionRow } from '@/components/connection-chip';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { PersonAutocomplete } from '@/components/person-autocomplete';
import { formatMonth, priorityWord } from '@/lib/goal-priority';
import { fullName } from '@/lib/person-display';
import { displayTitle } from '@/lib/resource-order';

import { changeGoalAction } from '../actions';
import { DOTS, STATUSES } from '../statuses';
import { RealizeWithProjectDialog } from './realize-with-project-dialog';

/** A small caps label for the facts beside the goal. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * One goal: how far along it is, what it connects to, and where it stands.
 *
 * The connections are the substance of this page. A goal on its own is a
 * sentence; what makes it answerable is the idea it came from, the work being
 * done about it, the people it is for, what it draws on and what has been
 * booked. Each row is empty far more often than not, so a row with nothing in
 * it is not rendered at all — five empty labels would make every new goal look
 * broken.
 */
export function GoalDetail({
  goal,
  inspiredBy,
  realizedBy,
  involved,
  sources,
  scheduled,
  people,
}: {
  goal: GoalDTO;
  inspiredBy: IdeaDTO[];
  realizedBy: ProjectDTO[];
  involved: UserDTO[];
  sources: ResourceDTO[];
  scheduled: EventDTO[];
  people: UserDTO[];
}) {
  const [realizing, setRealizing] = useState(false);
  const [editingPeople, setEditingPeople] = useState(false);
  const [involves, setInvolves] = useState<string[]>(goal.involves);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(changes: Record<string, unknown>, onDone?: () => void) {
    setError(null);

    startTransition(async () => {
      const result = await changeGoalAction(goal.id, changes);

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

  const month = formatMonth(goal.targetAt);
  const hasConnections =
    inspiredBy.length > 0 ||
    realizedBy.length > 0 ||
    involved.length > 0 ||
    sources.length > 0 ||
    scheduled.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageBreadcrumbs leaf={goal.title} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow>Goal</Eyebrow>
          <Heading level={1} size="heading-large">
            {goal.title}
          </Heading>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={() => setRealizing(true)}>
            <IoLayersOutline className="size-4" aria-hidden />
            Realize with project
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setInvolves(goal.involves);
              setEditingPeople(true);
            }}
          >
            <IoPersonOutline className="size-4" aria-hidden />
            For person
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <RealizeWithProjectDialog
        goal={goal}
        open={realizing}
        onOpenChange={setRealizing}
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
            <div className="flex items-baseline justify-between gap-3">
              <Text weight="medium">Progress</Text>
              <span className="font-mono text-sm text-muted-foreground">
                {goal.progress}%
              </span>
            </div>

            <div
              className="h-1.5 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={goal.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${goal.progress}% done`}
            >
              <div
                className="h-full rounded-full bg-muted-foreground transition-[width]"
                style={{ width: `${goal.progress}%` }}
              />
            </div>

            {goal.description && (
              <p className="whitespace-pre-wrap text-foreground">
                {goal.description}
              </p>
            )}
          </div>

          {(hasConnections || editingPeople) && (
            <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
              <Eyebrow>Connections</Eyebrow>

              <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4">
                {inspiredBy.length > 0 && (
                  <ConnectionRow label="Inspired by">
                    {inspiredBy.map((idea) => (
                      <ConnectionChip
                        key={idea.id}
                        href={`/telos/ideas/${idea.id}`}
                        icon={
                          <IoBulbOutline
                            className="size-4 text-warning"
                            aria-hidden
                          />
                        }
                      >
                        {idea.title}
                      </ConnectionChip>
                    ))}
                  </ConnectionRow>
                )}

                {realizedBy.length > 0 && (
                  <ConnectionRow label="Realized by">
                    {realizedBy.map((project) => (
                      <ConnectionChip
                        key={project.id}
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
                    ))}
                  </ConnectionRow>
                )}

                {(involved.length > 0 || editingPeople) && (
                  <ConnectionRow label="For">
                    {editingPeople ? (
                      <div className="flex flex-col gap-3">
                        <PersonAutocomplete
                          people={people}
                          selected={involves}
                          onChange={setInvolves}
                          disabled={pending}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              change({ involves }, () =>
                                setEditingPeople(false),
                              )
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setInvolves(goal.involves);
                              setEditingPeople(false);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      involved.map((person) => (
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
                      ))
                    )}
                  </ConnectionRow>
                )}

                {sources.length > 0 && (
                  <ConnectionRow label="Source">
                    {sources.map((resource) => (
                      <ConnectionChip
                        key={resource.id}
                        href={`/tekmerion/resources/${resource.id}`}
                        icon={
                          <IoBookOutline
                            className="size-4 text-primary"
                            aria-hidden
                          />
                        }
                      >
                        {displayTitle(resource)}
                      </ConnectionChip>
                    ))}
                  </ConnectionRow>
                )}

                {scheduled.length > 0 && (
                  <ConnectionRow label="Scheduled">
                    {scheduled.map((event) => (
                      <ConnectionChip
                        key={event.id}
                        href="/chronos/events"
                        icon={
                          <IoCalendarOutline
                            className="size-4 text-primary"
                            aria-hidden
                          />
                        }
                      >
                        {event.title}
                      </ConnectionChip>
                    ))}
                  </ConnectionRow>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-6 lg:w-64 lg:border-l lg:border-border lg:pl-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>Status</Eyebrow>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${DOTS[goal.status]}`}
                aria-hidden
              />
              {STATUSES[goal.status].label}
            </span>
          </div>

          {goal.priority !== undefined && (
            <div className="flex flex-col gap-2">
              <Eyebrow>Priority</Eyebrow>
              <span
                className={[
                  'font-mono text-sm tracking-wide',
                  priorityWord(goal.priority) === 'HIGH'
                    ? 'text-warning'
                    : 'text-muted-foreground',
                ].join(' ')}
                title={`Priority ${goal.priority} of 5`}
              >
                {priorityWord(goal.priority)}
              </span>
            </div>
          )}

          {month && (
            <div className="flex flex-col gap-2">
              <Eyebrow>Target</Eyebrow>
              <Text>{month}</Text>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
