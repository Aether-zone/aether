'use client';

import {
  Alert,
  AlertDescription,
  Button,
  EmptyState,
  Input,
  Text,
} from '@aether-zone/kosmos';
import {
  RESOURCE_TYPES,
  type ResourceDTO,
  type ResourceType,
  type UserDTO,
} from '@aether/contract';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { IoAddOutline, IoSearchOutline, IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import { fullName } from '@/lib/person-display';
import { displayTitle, isUntitled, snippet } from '@/lib/resource-order';
import { formatAge, matches } from '@/lib/resource-search';

import { removeResourceAction } from './actions';
import { KINDS } from './kinds';
import { NewResourceDialog } from './new-resource-dialog';

const RESOURCES = '/tekmerion/resources';

/**
 * What tekmerion is holding, with a way to find things in it.
 *
 * Filtering happens here rather than at the api, and that is a deliberate
 * limit rather than a shortcut: it searches the list already on the page, so
 * it is instant and it cannot search what has not been fetched. The moment
 * this list is long enough to paginate, the search has to move to the server —
 * and when it does, it should go to mneme rather than to a `LIKE`, because
 * "searchable by meaning" is mneme's whole job.
 */
export function ResourcesView({
  resources,
  people,
}: {
  resources: ResourceDTO[];
  people: UserDTO[];
}) {
  const [filing, setFiling] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ResourceType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(
    () =>
      resources.filter(
        (resource) =>
          (kind === null || resource.type === kind) &&
          matches(resource, query, people),
      ),
    [resources, kind, query, people],
  );

  /*
   * Only the kinds actually present get a chip, plus whichever is selected so
   * it does not vanish from under the cursor when the last of its kind is
   * deleted. A row of eight filters over three resources is a row of dead ends.
   */
  const kinds = RESOURCE_TYPES.filter(
    (candidate) =>
      candidate === kind ||
      resources.some((resource) => resource.type === candidate),
  );

  function remove(resource: ResourceDTO) {
    setError(null);
    setBusyId(resource.id);

    startTransition(async () => {
      const result = await removeResourceAction(resource.id);

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

      <div className="flex justify-end">
        <Button type="button" onClick={() => setFiling(true)}>
          <IoAddOutline className="size-4" aria-hidden />
          New resource
        </Button>
      </div>

      <NewResourceDialog
        people={people}
        open={filing}
        onOpenChange={setFiling}
      />

      <div className="relative">
        <IoSearchOutline
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search resources by topic, person or tag…"
          aria-label="Search resources"
          className="h-14 pl-12 text-base"
        />
      </div>

      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={kind === null} onClick={() => setKind(null)}>
            All
          </FilterChip>
          {kinds.map((candidate) => (
            <FilterChip
              key={candidate}
              active={kind === candidate}
              onClick={() => setKind(candidate)}
            >
              {KINDS[candidate].label}
            </FilterChip>
          ))}
        </div>
      )}

      {resources.length === 0 ? (
        <EmptyState
          title="Nothing filed"
          description="A resource is the artefact itself — a note, a document, a page, a recording. What it means is arachni's business and what it says is mneme's."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description="This searches titles, descriptions, tags and the people a resource is about — not the text inside it. Searching what a document says is mneme's job, and this page does not ask it yet."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((resource) => {
            const line = snippet(resource.description ?? resource.content, 140);
            const age = formatAge(resource.createdAt);

            const labels = [
              ...resource.tags,
              ...resource.involves
                .map((id) => people.find((person) => person.id === id))
                .filter((person): person is UserDTO => person !== undefined)
                .map(fullName),
            ];

            return (
              <li
                key={resource.id}
                className={[
                  'flex flex-col gap-3 rounded-lg border border-border p-5 transition-colors hover:border-muted-foreground/40',
                  busyId === resource.id && 'opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`${RESOURCES}/${resource.id}`}
                    className={[
                      'font-medium hover:underline',
                      isUntitled(resource)
                        ? 'italic text-muted-foreground'
                        : 'text-foreground',
                    ].join(' ')}
                  >
                    {displayTitle(resource)}
                  </Link>

                  <span className="shrink-0 rounded border border-primary/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
                    {KINDS[resource.type].label}
                  </span>
                </div>

                {line && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {line}
                  </p>
                )}

                <div className="mt-auto flex items-end justify-between gap-4 pt-2">
                  {/* Tags and people in one run, separated by middots. They
                      answer the same question — what is this filed under —
                      and two rows would imply they are read differently. */}
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {labels.join(' · ')}
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    {age && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {age}
                      </span>
                    )}
                    <IconButton
                      aria-label={`Delete ${displayTitle(resource)}`}
                      disabled={pending}
                      onClick={() => remove(resource)}
                    >
                      <IoTrashOutline className="size-4" aria-hidden />
                    </IconButton>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {shown.length === resources.length
          ? resources.length === 1
            ? '1 resource'
            : `${resources.length} resources`
          : `${shown.length} of ${resources.length} resources`}
      </Text>
    </div>
  );
}

/** A filter that reads as pressed when it is. */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-md border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-transparent bg-muted text-foreground'
          : 'border-border text-muted-foreground hover:border-muted-foreground/40',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
