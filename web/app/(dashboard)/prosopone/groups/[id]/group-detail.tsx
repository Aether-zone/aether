'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Heading,
  Select,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import { GROUP_TYPES, type GroupDTO } from '@aether/contract';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

import { changeGroupAction, removeGroupAction } from '../actions';
import { TYPES, UNSTATED } from '../types';

const GROUPS = '/prosopone/groups';

/** "3 Feb 2026" — the day, which is all a recorded-on date is good for. */
function formatDay(iso: string): string {
  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? '—'
    : at.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * One group.
 *
 * A reading page with editing available, like the rest of the console: the
 * description turns into a field when clicked, the kind into a select, and
 * everything else changes through a named action.
 */
export function GroupDetail({ group }: { group: GroupDTO }) {
  const router = useRouter();
  const [editing, setEditing] = useState<'description' | 'type' | null>(null);
  const [description, setDescription] = useState(group.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const kind = group.type ? TYPES[group.type] : UNSTATED;
  const Icon = kind.icon;

  function change(changes: Record<string, unknown>, onDone?: () => void) {
    setError(null);

    startTransition(async () => {
      const result = await changeGroupAction(group.id, changes);

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
      const result = await removeGroupAction(group.id);

      if (result.error) {
        setError(result.error);

        return;
      }

      // Back to the list: this page's subject no longer exists, and leaving it
      // on screen would invite editing something that is gone.
      router.push(GROUPS);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageBreadcrumbs leaf={group.name} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow>Group</Eyebrow>
          <div className="flex items-center gap-3">
            <Icon
              className="size-6 text-muted-foreground"
              aria-label={kind.label}
            />
            <Heading level={1} size="heading-large">
              {group.name}
            </Heading>
          </div>
        </div>

        <IconButton
          variant="outline"
          aria-label="Delete this group"
          title="Delete"
          disabled={pending}
          onClick={remove}
          className="text-destructive"
        >
          <IoTrashOutline className="size-4" aria-hidden />
        </IconButton>
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
                placeholder="Who they are, and what they are to you."
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
                    setDescription(group.description ?? '');
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
              {group.description ? (
                <p className="whitespace-pre-wrap text-foreground">
                  {group.description}
                </p>
              ) : (
                <p className="text-muted-foreground">No description yet.</p>
              )}
            </button>
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-6 lg:w-64 lg:border-l lg:border-border lg:pl-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>Kind</Eyebrow>
            {editing === 'type' ? (
              <Select
                aria-label="Kind"
                autoFocus
                defaultValue={group.type ?? ''}
                disabled={pending}
                onChange={(event) =>
                  change(
                    {
                      // `null` clears it; the empty option is "unstated", which
                      // is a different answer from `OTHER`.
                      type:
                        event.target.value === '' ? null : event.target.value,
                    },
                    () => setEditing(null),
                  )
                }
                className="w-44"
              >
                <option value="">Unstated</option>
                {GROUP_TYPES.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {TYPES[candidate].label}
                  </option>
                ))}
              </Select>
            ) : (
              <button
                type="button"
                onClick={() => setEditing('type')}
                className={[
                  'w-fit rounded-full border border-border px-2.5 py-1 text-xs',
                  group.type
                    ? 'text-muted-foreground'
                    : 'italic text-muted-foreground/60',
                ].join(' ')}
              >
                {kind.label}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>Recorded</Eyebrow>
            <Text>{formatDay(group.createdAt)}</Text>
          </div>
        </aside>
      </div>
    </div>
  );
}
