'use client';

import {
  Alert,
  AlertDescription,
  Avatar,
  Button,
  Heading,
  Select,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import type { GroupDTO, UserDTO } from '@aether/contract';
import { useState, useTransition } from 'react';
import {
  IoBookOutline,
  IoBulbOutline,
  IoCheckboxOutline,
  IoLayersOutline,
  IoPeopleCircleOutline,
  IoRadioButtonOnOutline,
} from 'react-icons/io5';

import { ConnectionChip, ConnectionRow } from '@/components/connection-chip';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { hasAny, initialsOf, type Connections } from '@/lib/person-connections';
import { fullName } from '@/lib/person-display';
import { displayTitle } from '@/lib/resource-order';

import { editUserAction } from '../actions';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * One person, and everything in the workspace that names them.
 *
 * The connections are the substance. A person on their own is a name and a
 * phone number — what makes the page worth opening is that it answers "what is
 * this person to me", and the answer lives in the ideas, goals, projects,
 * tasks and resources that mention them rather than on the person.
 *
 * Each row is empty far more often than not, so an empty one is not rendered:
 * five blank labels would make every new contact look broken.
 */
export function PersonDetail({
  person,
  group,
  groups,
  connections,
}: {
  person: UserDTO;
  /** The group they belong to, where it still resolves. */
  group: GroupDTO | null;
  /** Everywhere they could belong, for the picker. */
  groups: GroupDTO[];
  connections: Connections;
}) {
  const [editing, setEditing] = useState<'note' | 'group' | null>(null);
  const [note, setNote] = useState(person.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(changes: Record<string, unknown>, onDone?: () => void) {
    setError(null);

    startTransition(async () => {
      const result = await editUserAction(person.id, changes);

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

  return (
    <div className="flex flex-col gap-8">
      <PageBreadcrumbs leaf={fullName(person)} />

      <div className="flex items-center gap-5">
        <Avatar
          size="xl"
          fallback={initialsOf(person.firstName, person.lastName)}
        />

        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>Person</Eyebrow>
          <Heading level={1} size="heading-large">
            {fullName(person)}
          </Heading>
          {/* The one line that says what they are to you. Only the parts that
              exist — a person with neither reads as a name, which is honest. */}
          {group && <Text tone="muted">{group.name}</Text>}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {editing === 'note' ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={6}
                autoFocus
                aria-label="Note"
                placeholder="How they like to be contacted, what they are working through, who introduced them…"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    change(
                      // "" is not a note, and the update shape takes `null` to
                      // mean remove it.
                      { note: note.trim() === '' ? null : note.trim() },
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
                    setNote(person.note ?? '');
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
              onClick={() => setEditing('note')}
              className="rounded-lg border border-border p-5 text-left transition-colors hover:border-muted-foreground/40"
            >
              {person.note ? (
                <p className="whitespace-pre-wrap text-foreground">
                  {person.note}
                </p>
              ) : (
                <p className="text-muted-foreground">Nothing noted yet.</p>
              )}
            </button>
          )}

          {hasAny(connections) && (
            <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
              <Eyebrow>Connections</Eyebrow>

              <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4">
                {connections.projects.length > 0 && (
                  <ConnectionRow label="With">
                    {connections.projects.map((project) => (
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

                {connections.goals.length > 0 && (
                  <ConnectionRow label="For">
                    {connections.goals.map((goal) => (
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

                {connections.tasks.length > 0 && (
                  <ConnectionRow label="Assigned to">
                    {connections.tasks.map((task) => (
                      <ConnectionChip
                        key={task.id}
                        href={`/telos/tasks/${task.id}`}
                        icon={
                          <IoCheckboxOutline
                            className="size-4 text-primary"
                            aria-hidden
                          />
                        }
                      >
                        {task.title}
                      </ConnectionChip>
                    ))}
                  </ConnectionRow>
                )}

                {connections.ideas.length > 0 && (
                  <ConnectionRow label="About">
                    {connections.ideas.map((idea) => (
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

                {connections.resources.length > 0 && (
                  <ConnectionRow label="Source">
                    {connections.resources.map((resource) => (
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
              </div>
            </div>
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-6 lg:w-64 lg:border-l lg:border-border lg:pl-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>Group</Eyebrow>
            {editing === 'group' ? (
              <Select
                aria-label="Group"
                autoFocus
                defaultValue={person.groupId ?? ''}
                disabled={pending}
                onChange={(event) =>
                  change(
                    {
                      groupId:
                        event.target.value === '' ? null : event.target.value,
                    },
                    () => setEditing(null),
                  )
                }
                className="w-52"
              >
                <option value="">None</option>
                {groups.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            ) : (
              <button
                type="button"
                onClick={() => setEditing('group')}
                className="flex w-fit items-center gap-2 text-left text-sm text-foreground"
              >
                <IoPeopleCircleOutline
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                {group ? (
                  group.name
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>Email</Eyebrow>
            <a
              href={`mailto:${person.email}`}
              className="break-words text-sm text-primary hover:underline"
            >
              {person.email}
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>Phone</Eyebrow>
            <a
              href={`tel:${person.phoneNumber}`}
              className="text-sm text-primary hover:underline"
            >
              {person.phoneNumber}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
