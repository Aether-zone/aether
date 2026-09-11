'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import type { IdeaDTO } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { addGoalAction } from '../../goals/actions';

/**
 * Setting a goal from the idea that led to it.
 *
 * The link is the point: a goal set here records this idea in its
 * `inspiredBy`, which is the only place that fact is stored — the idea's own
 * "inspired" list is read back out of it. So this dialog is not a shortcut to
 * the goals page, it is the one screen where the connection gets made.
 *
 * The title starts as the idea's, because a goal set from an idea is usually
 * the same sentence said with intent. It is editable, since "usually" is not
 * "always".
 */
export function InspireGoalDialog({
  idea,
  open,
  onOpenChange,
}: {
  idea: IdeaDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState('');
  const [targetAt, setTargetAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function close() {
    // Back to the idea's title, not to what was typed and abandoned.
    setTitle(idea.title);
    setDescription('');
    setTargetAt('');
    setError(null);
    setFieldErrors({});
    onOpenChange(false);
  }

  function set(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await addGoalAction({
        title: title.trim(),
        targetAt,
        description,
        inspiredBy: [idea.id],
      });

      if (result.error || result.fieldErrors) {
        setError(result.error ?? null);
        setFieldErrors(result.fieldErrors ?? {});

        return;
      }

      close();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <form onSubmit={set} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Inspire a goal</DialogTitle>
            <DialogDescription>
              The goal will record that it came from “{idea.title}”.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <Field>
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
            {fieldErrors.title && (
              <Text tone="destructive" size="body-small">
                {fieldErrors.title}
              </Text>
            )}
          </Field>

          <Field>
            <Label htmlFor="goal-description">Description</Label>
            <Textarea
              id="goal-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional. What does reaching it look like?"
            />
          </Field>

          <Field>
            <Label htmlFor="goal-target">Target date</Label>
            <Input
              id="goal-target"
              type="date"
              value={targetAt}
              onChange={(event) => setTargetAt(event.target.value)}
            />
            {fieldErrors.targetAt && (
              <Text tone="destructive" size="body-small">
                {fieldErrors.targetAt}
              </Text>
            )}
            <Text tone="muted" size="body-small">
              Optional. A goal without one is unscheduled, not unimportant.
            </Text>
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              Set goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
