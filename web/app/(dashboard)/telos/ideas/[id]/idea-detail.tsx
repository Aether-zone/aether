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
  IDEA_STATUSES,
  PRIORITY_MAX,
  PRIORITY_MIN,
  type GoalDTO,
  type IdeaDTO,
} from '@aether/contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { IoArrowBackOutline, IoTrashOutline } from 'react-icons/io5';

import { STATUSES as GOAL_STATUS_LABELS } from '../../goals/statuses';
import { changeIdeaAction, removeIdeaAction } from '../actions';
import { STATUSES } from '../statuses';

const PRIORITIES = Array.from(
  { length: PRIORITY_MAX - PRIORITY_MIN + 1 },
  (_, index) => PRIORITY_MIN + index,
);

const IDEAS = '/telos/ideas';

/** "3 Feb 2026, 14:20", in the reader's zone rather than the api's. */
function formatMoment(iso: string): string {
  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? '—'
    : at.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/**
 * One idea: what it says, what state it is in, and what came of it.
 *
 * Title and description are a form with a Save, unlike the list's controls,
 * which apply as you touch them. Free text is the difference — a select has
 * finished changing the moment you let go of it, but a sentence being typed
 * is not an instruction until the person says it is.
 */
export function IdeaDetail({
  idea,
  inspired,
}: {
  idea: IdeaDTO;
  inspired: GoalDTO[] | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty =
    title !== idea.title || description !== (idea.description ?? '');

  function apply(changes: Record<string, unknown>, onDone?: () => void) {
    setError(null);
    setFieldErrors({});
    setSaved(false);

    startTransition(async () => {
      const result = await changeIdeaAction(idea.id, changes);

      if (result.error || result.fieldErrors) {
        setError(result.error ?? 'That could not be saved.');
        setFieldErrors(result.fieldErrors ?? {});

        return;
      }

      onDone?.();
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    apply(
      {
        title,
        // "" is not a description, and the update shape takes `null` to mean
        // remove it — leaving the key out would mean leave it alone.
        description: description.trim() === '' ? null : description,
      },
      () => setSaved(true),
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={IDEAS}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <IoArrowBackOutline className="size-4" aria-hidden />
          Ideas
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1} size="heading-large">
            {idea.title}
          </Heading>
          <Badge variant={STATUSES[idea.status].variant}>
            {STATUSES[idea.status].label}
          </Badge>
        </div>

        <Text tone="muted" size="body-small">
          Captured {formatMoment(idea.createdAt)}
          {idea.updatedAt !== idea.createdAt &&
            `, last changed ${formatMoment(idea.updatedAt)}`}
        </Text>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={save} className="flex flex-col gap-4">
        <Field>
          <Label htmlFor="idea-title">Title</Label>
          <Input
            id="idea-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={fieldErrors.title ? true : undefined}
          />
          {fieldErrors.title && <FieldError>{fieldErrors.title}</FieldError>}
        </Field>

        <Field>
          <Label htmlFor="idea-description">Description</Label>
          <Textarea
            id="idea-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="What is the idea, and why is it worth having?"
          />
          {fieldErrors.description && (
            <FieldError>{fieldErrors.description}</FieldError>
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
        </div>
      </form>

      <Separator />

      <div className="flex flex-wrap items-end gap-4">
        <Field className="w-32">
          <Label htmlFor="idea-status">Status</Label>
          <Select
            id="idea-status"
            value={idea.status}
            disabled={pending}
            onChange={(event) => apply({ status: event.target.value })}
          >
            {IDEA_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUSES[status].label}
              </option>
            ))}
          </Select>
        </Field>

        <Field className="w-32">
          <Label htmlFor="idea-priority">Priority</Label>
          <Select
            id="idea-priority"
            value={idea.priority === undefined ? '' : String(idea.priority)}
            disabled={pending}
            onChange={(event) =>
              apply({
                priority:
                  event.target.value === ''
                    ? null
                    : Number(event.target.value),
              })
            }
          >
            <option value="">Unranked</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
                {priority === PRIORITY_MIN ? ' (top)' : ''}
              </option>
            ))}
          </Select>
        </Field>

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

      <Separator />

      <div className="flex flex-col gap-3">
        <Heading level={2} size="heading-small">
          What came of it
        </Heading>

        {inspired === null && idea.inspired.length > 0 && (
          <Text tone="muted" size="body-small">
            {idea.inspired.length === 1
              ? '1 goal came of this, but the goals could not be read just now.'
              : `${idea.inspired.length} goals came of this, but the goals could not be read just now.`}
          </Text>
        )}

        {idea.inspired.length === 0 && (
          <Text tone="muted" size="body-small">
            Nothing yet. A goal names the ideas it came from, so this fills in
            from the goals page rather than here.
          </Text>
        )}

        {inspired && inspired.length > 0 && (
          <ul className="flex flex-col gap-2">
            {inspired.map((goal) => (
              <li
                key={goal.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
              >
                <Link
                  href="/telos/goals"
                  className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline"
                >
                  {goal.title}
                </Link>
                <Badge
                  variant={GOAL_STATUS_LABELS[goal.status].variant}
                  size="sm"
                >
                  {GOAL_STATUS_LABELS[goal.status].label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
