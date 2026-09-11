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
import type { GoalDTO } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { addProjectAction } from '../../projects/actions';

/**
 * Starting the work meant to reach a goal.
 *
 * The link is stored on the *project*, not the goal — a project is started
 * knowing what it is for, where a goal outlives any particular attempt at it.
 * So this creates a project that names the goal, and the goal reads it back.
 * There is nothing written to the goal at all.
 *
 * The title starts as the goal's, because the first project towards a goal is
 * usually the goal restated as work. Editable, since "usually" is not
 * "always".
 */
export function RealizeWithProjectDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: GoalDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState('');
  const [targetAt, setTargetAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function close() {
    setTitle(goal.title);
    setDescription('');
    setTargetAt('');
    setError(null);
    setFieldErrors({});
    onOpenChange(false);
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await addProjectAction({
        title: title.trim(),
        targetAt,
        description,
        pursues: [goal.id],
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
        <form onSubmit={start} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Realize with a project</DialogTitle>
            <DialogDescription>
              The project will record that it is working towards “{goal.title}”.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <Field>
            <Label htmlFor="project-title">Title</Label>
            <Input
              id="project-title"
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
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional. What is in scope, and what is not?"
            />
          </Field>

          <Field>
            <Label htmlFor="project-target">Deadline</Label>
            <Input
              id="project-target"
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
              Optional. The project starts planned, not active — writing one
              down is planning it.
            </Text>
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              Start project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
