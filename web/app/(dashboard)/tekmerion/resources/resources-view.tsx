'use client';

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  EmptyState,
  Input,
  Select,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import { RESOURCE_TYPES, type ResourceDTO } from '@aether/contract';
import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';
import { IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import {
  displayTitle,
  formatMoment,
  isUntitled,
  snippet,
} from '@/lib/resource-order';

import { addResourceAction, removeResourceAction } from './actions';
import { KINDS } from './kinds';

const RESOURCES = '/tekmerion/resources';

/**
 * What tekmerion is holding, and a way to add to it.
 *
 * The filing form asks for a kind and text rather than a title, which is the
 * opposite of idea capture and deliberate: an idea is a sentence someone wants
 * out of their head, where a resource is a *thing* — its substance is what it
 * says, and a title is something a person adds later if it turns out to
 * matter. Requiring one would mean naming a document before reading it.
 *
 * Rows link through to the one, because a resource cannot be edited in place
 * the way an idea can: its content does not fit on a line.
 */
export function ResourcesView({ resources }: { resources: ResourceDTO[] }) {
  const [type, setType] = useState<string>('NOTE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A note is worth filing with text alone; anything else needs at least a
  // name, or the row would be an icon and a date.
  const fileable = content.trim() !== '' || title.trim() !== '';

  function file(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fileable) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await addResourceAction({
        type,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(content.trim() ? { content } : {}),
        source: { type: 'console', name: 'Typed into the console' },
      });

      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0] ??
            'That could not be filed.',
        );

        return;
      }

      // Cleared only on success, so a failed save does not lose the text.
      setTitle('');
      setContent('');
    });
  }

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

      <form
        onSubmit={file}
        className="flex flex-col gap-2 rounded-md border border-border p-3"
      >
        <div className="flex gap-2">
          <Select
            aria-label="Kind"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="w-40"
          >
            {RESOURCE_TYPES.map((kind) => (
              <option key={kind} value={kind}>
                {KINDS[kind].label}
              </option>
            ))}
          </Select>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title (optional)"
            aria-label="Title"
            className="flex-1"
          />
        </div>

        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste or write the thing itself…"
          aria-label="Content"
          rows={3}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !fileable}>
            File it
          </Button>
        </div>
      </form>

      {resources.length === 0 ? (
        <EmptyState
          title="Nothing filed"
          description="A resource is the artefact itself — a note, a document, a page, a recording. What it means is arachni's business and what it says is mneme's; this is where it came from and what it is."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {resources.map((resource) => {
            const Icon = KINDS[resource.type].icon;
            const line = snippet(resource.content);

            return (
              <li
                key={resource.id}
                className={[
                  'flex items-start gap-3 rounded-md border border-border p-3',
                  busyId === resource.id && 'opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-label={KINDS[resource.type].label}
                />

                <span className="min-w-0 flex-1">
                  <Link
                    href={`${RESOURCES}/${resource.id}`}
                    className={[
                      'block truncate font-medium hover:underline',
                      // An invented title is not the resource's own, and a row
                      // that showed the two the same way would be claiming
                      // someone named this.
                      isUntitled(resource)
                        ? 'text-muted-foreground italic'
                        : 'text-foreground',
                    ].join(' ')}
                  >
                    {displayTitle(resource)}
                  </Link>

                  {line && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {line}
                    </span>
                  )}

                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    {resource.source && (
                      <Badge variant="secondary" size="sm">
                        {resource.source.name ?? resource.source.type}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatMoment(resource.createdAt)}
                    </span>
                  </span>
                </span>

                <IconButton
                  aria-label={`Delete ${displayTitle(resource)}`}
                  disabled={busyId === resource.id}
                  onClick={() => remove(resource)}
                >
                  <IoTrashOutline className="size-4" aria-hidden />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {resources.length === 1
          ? '1 resource'
          : `${resources.length} resources`}
      </Text>
    </div>
  );
}
