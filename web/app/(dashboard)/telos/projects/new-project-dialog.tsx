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
  Select,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import { PRIORITY_MAX, PRIORITY_MIN, type UserDTO } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { PersonAutocomplete } from '@/components/person-autocomplete';
import { priorityWord } from '@/lib/goal-priority';

import { addProjectAction } from './actions';

const PRIORITIES = Array.from(
  { length: PRIORITY_MAX - PRIORITY_MIN + 1 },
  (_, index) => PRIORITY_MIN + index,
);

/**
 * Starting a project. A title is the only thing required.
 *
 * Nothing here asks what the project is for. That link is made from the goal —
 * "Realize with project" — because a project started from the projects page is
 * usually work somebody already knows about, where naming its goal is a
 * decision made while looking at the goal.
 */
export function NewProjectDialog({
  people,
  open,
  onOpenChange,
}: {
  people: UserDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAt, setTargetAt] = useState('');
  const [priority, setPriority] = useState('');
  const [involves, setInvolves] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function close() {
    setTitle('');
    setDescription('');
    setTargetAt('');
    setPriority('');
    setInvolves([]);
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
      const result = await addProjectAction({
        title: title.trim(),
        targetAt,
        description,
        involves,
        ...(priority ? { priority: Number(priority) } : {}),
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
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Work with a beginning and an end. It starts planned, because
              writing one down is planning it.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <Field>
            <Label htmlFor="new-project-title">Title</Label>
            <Input
              id="new-project-title"
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
            <Label htmlFor="new-project-description">Description</Label>
            <Textarea
              id="new-project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional. What does reaching it look like?"
            />
          </Field>

          <div className="flex flex-wrap gap-4">
            <Field className="min-w-40 flex-1">
              <Label htmlFor="new-project-target">Deadline</Label>
              <Input
                id="new-project-target"
                type="date"
                value={targetAt}
                onChange={(event) => setTargetAt(event.target.value)}
              />
              {fieldErrors.targetAt && (
                <Text tone="destructive" size="body-small">
                  {fieldErrors.targetAt}
                </Text>
              )}
            </Field>

            <Field className="w-40">
              <Label htmlFor="new-project-priority">Priority</Label>
              <Select
                id="new-project-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="">Unranked</option>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value} · {priorityWord(value)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field>
            <Label htmlFor="new-project-involves">Involves</Label>
            <PersonAutocomplete
              id="new-project-involves"
              people={people}
              selected={involves}
              onChange={setInvolves}
              disabled={pending}
            />
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
