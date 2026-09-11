'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Heading,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import type { GoalDTO, IdeaDTO, UserDTO } from '@aether/contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  IoArchiveOutline,
  IoFlagOutline,
  IoPersonOutline,
  IoRadioButtonOnOutline,
  IoTrashOutline,
} from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { PersonAutocomplete } from '@/components/person-autocomplete';
import { fullName } from '@/lib/person-display';

import { StatusPill } from '../status-pill';
import { changeIdeaAction, removeIdeaAction } from '../actions';
import { InspireGoalDialog } from './inspire-goal-dialog';

const IDEAS = '/telos/ideas';

/** "Sep 9, 2026" — the day, which is all a captured-on date is good for. */
function formatDay(iso: string): string {
  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? '—'
    : at.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

/** A small caps label for the facts beside the idea. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * One idea: what it says, who it is about, and what came of it.
 *
 * A reading page with editing available, rather than a form. An idea is
 * looked at far more often than it is changed, and a screen of populated
 * inputs makes the reader do the work of telling content from chrome. The
 * description turns into a field when clicked; everything else changes through
 * a named action.
 */
export function IdeaDetail({
  idea,
  inspired,
  people,
}: {
  idea: IdeaDTO;
  inspired: GoalDTO[] | null;
  /** Everyone who could be named, for the picker. */
  people: UserDTO[];
}) {
  const router = useRouter();
  const [inspiring, setInspiring] = useState(false);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(idea.description ?? '');
  const [editingPeople, setEditingPeople] = useState(false);
  const [involves, setInvolves] = useState<string[]>(idea.involves);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(changes: Record<string, unknown>, onDone?: () => void) {
    setError(null);

    startTransition(async () => {
      const result = await changeIdeaAction(idea.id, changes);

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

  function saveDescription() {
    change(
      // "" is not a description, and the update shape takes `null` to mean
      // remove it — leaving the key out would mean leave it alone.
      { description: description.trim() === '' ? null : description.trim() },
      () => setEditing(false),
    );
  }

  function remove() {
    setError(null);

    startTransition(async () => {
      const result = await removeIdeaAction(idea.id);

      if (result.error) {
        setError(result.error);

        return;
      }

      // Back to the list: this page's subject no longer exists, and leaving it
      // on screen would invite editing something that is gone.
      router.push(IDEAS);
    });
  }

  const dropped = idea.status === 'DROPPED';

  const byId = new Map(people.map((person) => [person.id, person]));

  // Only the people still known. An id that resolves to nobody is someone
  // removed from prosopone since; a chip with no name would say less than one
  // fewer chip — the editor names them instead, since it is the reader there
  // who can fix it.
  const involved = (idea.involves || [])
    .map((personId) => byId.get(personId))
    .filter((person): person is UserDTO => person !== undefined);

  return (
    <div className="flex flex-col gap-8">
      <PageBreadcrumbs leaf={idea.title} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow>Idea</Eyebrow>
          <Heading level={1} size="heading-large">
            {idea.title}
          </Heading>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={() => setInspiring(true)}>
            <IoRadioButtonOnOutline className="size-4" aria-hidden />
            Inspire goal
          </Button>

          {/* Dropping an idea is the archive: it stays for its reason, out of
              the way. Reversible, so it is a toggle and not a warning. */}
          {/* Outlined rather than ghost: these sit beside a filled button and
              need an edge of their own, or they read as decoration next to it. */}
          <IconButton
            variant="outline"
            aria-label={dropped ? 'Restore this idea' : 'Archive this idea'}
            title={dropped ? 'Restore' : 'Archive'}
            disabled={pending}
            onClick={() => change({ status: dropped ? 'CAPTURED' : 'DROPPED' })}
          >
            <IoArchiveOutline className="size-4" aria-hidden />
          </IconButton>

          <IconButton
            variant="outline"
            aria-label="Delete this idea"
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

      <InspireGoalDialog
        idea={idea}
        open={inspiring}
        onOpenChange={setInspiring}
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                autoFocus
                aria-label="Description"
                placeholder="What is the idea, and why is it worth having?"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={saveDescription}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDescription(idea.description ?? '');
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* The whole card is the edit affordance. A pencil in the corner
               would be a smaller target for the same action, on a card whose
               only purpose is the text inside it. */
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-border p-5 text-left transition-colors hover:border-muted-foreground/40"
            >
              {idea.description ? (
                <p className="whitespace-pre-wrap text-foreground">
                  {idea.description}
                </p>
              ) : (
                <p className="text-muted-foreground">No description yet.</p>
              )}
            </button>
          )}

          <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
            <Eyebrow>Connections</Eyebrow>

            <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4">
              <span className="pt-1.5 text-sm text-muted-foreground">
                About
              </span>
              {editingPeople ? (
                <div className="flex flex-col gap-3">
                  <PersonAutocomplete
                    people={people}
                    selected={involves || []}
                    onChange={setInvolves}
                    disabled={pending}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        change({ involves }, () => setEditingPeople(false))
                      }
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setInvolves(idea.involves);
                        setEditingPeople(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {involved.map((person) => (
                    <Link
                      key={person.id}
                      href="/prosopone/people"
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-muted-foreground/40"
                    >
                      <IoPersonOutline
                        className="size-4 text-destructive"
                        aria-hidden
                      />
                      {fullName(person)}
                    </Link>
                  ))}

                  {/* The only way to change who an idea is about after it was
                      captured. Worded as the thing it does in each case, so an
                      idea about nobody does not offer to "edit" an empty row. */}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setInvolves(idea.involves);
                      setEditingPeople(true);
                    }}
                  >
                    {involved.length === 0 ? 'Add someone' : 'Change'}
                  </Button>
                </div>
              )}

              {/* Only when there is something to show: an empty "Led to" row
                  on every idea would make the common case look unfinished. */}
              {idea.inspired.length > 0 && (
                <>
                  <span className="pt-1.5 text-sm text-muted-foreground">
                    Led to
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {inspired === null ? (
                      <Text tone="muted" size="body-small">
                        {idea.inspired.length === 1
                          ? '1 goal, which could not be read just now.'
                          : `${idea.inspired.length} goals, which could not be read just now.`}
                      </Text>
                    ) : (
                      inspired.map((goal) => (
                        <Link
                          key={goal.id}
                          href={`/telos/goals/${goal.id}`}
                          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-muted-foreground/40"
                        >
                          <IoFlagOutline
                            className="size-4 text-success"
                            aria-hidden
                          />
                          {goal.title}
                        </Link>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="flex shrink-0 flex-col gap-6 lg:w-64 lg:border-l lg:border-border lg:pl-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>Status</Eyebrow>
            <span>
              <StatusPill status={idea.status} />
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>Captured</Eyebrow>
            <Text>{formatDay(idea.createdAt)}</Text>
          </div>

          {idea.priority !== undefined && (
            <div className="flex flex-col gap-2">
              <Eyebrow>Priority</Eyebrow>
              <Text>{idea.priority}</Text>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
