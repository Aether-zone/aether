'use client';

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Field,
  FieldError,
  Heading,
  Input,
  Label,
  Select,
  Separator,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import {
  RESOURCE_TYPES,
  type FileDTO,
  type ResourceDTO,
  type UserDTO,
} from '@aether/contract';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { IoPersonOutline, IoTrashOutline } from 'react-icons/io5';

import { PersonAutocomplete } from '@/components/person-autocomplete';
import { fullName } from '@/lib/person-display';
import { displayTitle, formatMoment, isUntitled } from '@/lib/resource-order';

import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

import { changeResourceAction, removeResourceAction } from '../actions';
import { FileCard } from './file-card';
import { KINDS } from '../kinds';

const RESOURCES = '/tekmerion/resources';

/**
 * One resource, and the only place its content can be read.
 *
 * Title, description, kind and content are a form with a Save rather than
 * applying as you touch them. Free text is the difference — a select has
 * finished changing the moment you let go of it, but a sentence being typed is
 * not an instruction until the person says it is.
 *
 * What the resource came from is shown and not edited. `source`, `externalId`
 * and `url` are the record of where this artefact was found, and a console
 * that let someone retype them would let them make the record say the wrong
 * thing — the api still accepts changes, for whatever imported it.
 */
export function ResourceDetail({
  resource,
  file,
  people,
}: {
  resource: ResourceDTO;
  /** The stored object, where this resource is one. */
  file: FileDTO | null;
  /** Everyone who could be named, for the picker. */
  people: UserDTO[];
}) {
  const router = useRouter();
  const [type, setType] = useState(resource.type);
  const [title, setTitle] = useState(resource.title ?? '');
  const [description, setDescription] = useState(resource.description ?? '');
  const [content, setContent] = useState(resource.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tags, setTags] = useState(resource.tags.join(', '));
  const [involves, setInvolves] = useState<string[]>(resource.involves);
  const [editingAbout, setEditingAbout] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty =
    type !== resource.type ||
    title !== (resource.title ?? '') ||
    description !== (resource.description ?? '') ||
    content !== (resource.content ?? '') ||
    tags !== resource.tags.join(', ');

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setFieldErrors({});
    setSaved(false);

    startTransition(async () => {
      const result = await changeResourceAction(resource.id, {
        type,
        // "" is not a value, and the update shape takes `null` to mean remove
        // it — leaving the key out would mean leave it alone.
        title: title.trim() === '' ? null : title.trim(),
        description: description.trim() === '' ? null : description.trim(),
        content: content === '' ? null : content,
        /*
         * Split on commas, not spaces: "personal knowledge" is one label, and
         * splitting on whitespace would quietly make it two nobody meant.
         */
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      if (result.error || result.fieldErrors) {
        setError(result.error ?? 'That could not be saved.');
        setFieldErrors(result.fieldErrors ?? {});

        return;
      }

      setSaved(true);
    });
  }

  /** One field at a time, for the parts of the page that are not the form. */
  function change(changes: Record<string, unknown>, onDone?: () => void) {
    setError(null);

    startTransition(async () => {
      const result = await changeResourceAction(resource.id, changes);

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
      const result = await removeResourceAction(resource.id);

      if (result.error) {
        setError(result.error);

        return;
      }

      // Back to the list: this page's subject no longer exists, and leaving it
      // on screen would invite editing something that is gone.
      router.push(RESOURCES);
    });
  }

  const Icon = KINDS[resource.type].icon;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* The trail replaces the back link this page used to carry: it says
            the same thing and also says where "back" goes. */}
        <PageBreadcrumbs leaf={displayTitle(resource)} />

        <div className="flex flex-wrap items-center gap-3">
          <Icon
            className="size-6 text-muted-foreground"
            aria-label={KINDS[resource.type].label}
          />
          <Heading level={1} size="heading-large">
            <span className={isUntitled(resource) ? 'italic' : undefined}>
              {displayTitle(resource)}
            </span>
          </Heading>
          <Badge variant="secondary">{KINDS[resource.type].label}</Badge>
        </div>

        <Text tone="muted" size="body-small">
          Filed {formatMoment(resource.createdAt)}
          {resource.updatedAt !== resource.createdAt &&
            `, last changed ${formatMoment(resource.updatedAt)}`}
        </Text>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Above the form, because the file *is* the resource when there is one
          — the fields below describe it. */}
      {file && <FileCard file={file} />}

      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          <Field className="w-48">
            <Label htmlFor="resource-type">Kind</Label>
            <Select
              id="resource-type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as ResourceDTO['type'])
              }
            >
              {RESOURCE_TYPES.map((kind) => (
                <option key={kind} value={kind}>
                  {KINDS[kind].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="min-w-64 flex-1">
            <Label htmlFor="resource-title">Title</Label>
            <Input
              id="resource-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                isUntitled(resource) ? displayTitle(resource) : undefined
              }
              aria-invalid={fieldErrors.title ? true : undefined}
            />
            {fieldErrors.title && <FieldError>{fieldErrors.title}</FieldError>}
          </Field>
        </div>

        <Field>
          <Label htmlFor="resource-description">Description</Label>
          <Input
            id="resource-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this, and why was it kept?"
          />
          {fieldErrors.description && (
            <FieldError>{fieldErrors.description}</FieldError>
          )}
        </Field>

        <Field>
          <Label htmlFor="resource-tags">Tags</Label>
          <Input
            id="resource-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="graph, modelling, reference"
          />
          <Text tone="muted" size="body-small">
            Separated by commas. Lowercased, so one word is one label.
          </Text>
          {fieldErrors.tags && <FieldError>{fieldErrors.tags}</FieldError>}
        </Field>

        <Field>
          <Label htmlFor="resource-content">Content</Label>
          {/* A monospace box and a lot of rows: this is as likely to be a
              transcript or a page of markup as a paragraph, and reflowing it
              into prose width would make it harder to read, not easier. */}
          <Textarea
            id="resource-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={18}
            className="font-mono text-xs"
            placeholder="Nothing was kept with this one."
          />
          {fieldErrors.content && (
            <FieldError>{fieldErrors.content}</FieldError>
          )}
        </Field>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending || !dirty}>
            Save
          </Button>
          {saved && !dirty && (
            <Text tone="success" size="body-small">
              Saved
            </Text>
          )}

          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={remove}
            className="ml-auto text-destructive"
          >
            <IoTrashOutline className="size-4" aria-hidden />
            Delete
          </Button>
        </div>
      </form>

      <Separator />

      <div className="flex flex-col gap-3">
        <Heading level={2} size="heading-small">
          About
        </Heading>

        {editingAbout ? (
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
                  change({ involves }, () => setEditingAbout(false))
                }
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setInvolves(resource.involves);
                  setEditingAbout(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {resource.involves
              .map((id) => people.find((person) => person.id === id))
              .filter((person): person is UserDTO => person !== undefined)
              .map((person) => (
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setInvolves(resource.involves);
                setEditingAbout(true);
              }}
            >
              {resource.involves.length === 0 ? 'Add someone' : 'Change'}
            </Button>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Heading level={2} size="heading-small">
          Where it came from
        </Heading>

        {!resource.source && !resource.url && !resource.externalId ? (
          <Text tone="muted" size="body-small">
            Nothing recorded. This one arrived without saying where from.
          </Text>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {resource.source && (
              <>
                <dt className="text-muted-foreground">System</dt>
                <dd className="min-w-0 break-words text-foreground">
                  {resource.source.name ?? resource.source.type}
                  {resource.source.name && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {resource.source.type}
                    </span>
                  )}
                </dd>
              </>
            )}

            {resource.source?.id && (
              <>
                <dt className="text-muted-foreground">Account</dt>
                <dd className="min-w-0 break-words font-mono text-xs text-foreground">
                  {resource.source.id}
                </dd>
              </>
            )}

            {resource.externalId && (
              <>
                <dt className="text-muted-foreground">Their id</dt>
                <dd className="min-w-0 break-words font-mono text-xs text-foreground">
                  {resource.externalId}
                </dd>
              </>
            )}

            {resource.url && (
              <>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="min-w-0 break-words">
                  {/* `rel="noreferrer"` because this URL came from whatever
                      filed the resource, which may be anywhere. */}
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {resource.url}
                  </a>
                </dd>
              </>
            )}
          </dl>
        )}

        {resource.metadata && Object.keys(resource.metadata).length > 0 && (
          <div className="flex flex-col gap-2">
            <Text tone="muted" size="body-small">
              {/* Shown raw on purpose: it is whatever the source wanted to keep,
                  in no agreed vocabulary, so there is nothing to render it as. */}
              What the source kept with it
            </Text>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
              {JSON.stringify(resource.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
