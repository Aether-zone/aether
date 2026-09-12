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

import { addGoalAction } from './actions';

const PRIORITIES = Array.from(
  { length: PRIORITY_MAX - PRIORITY_MIN + 1 },
  (_, index) => PRIORITY_MIN + index,
);

/** Setting a goal. A title is the only thing required. */
export function NewGoalDialog({
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
      const result = await addGoalAction({
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
            <DialogTitle>New goal</DialogTitle>
            <DialogDescription>
              Something to aim at. It starts active, because setting one is
              committing to it.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <Field>
            <Label htmlFor="new-goal-title">Title</Label>
            <Input
              id="new-goal-title"
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
            <Label htmlFor="new-goal-description">Description</Label>
            <Textarea
              id="new-goal-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional. What does reaching it look like?"
            />
          </Field>

          <div className="flex flex-wrap gap-4">
            <Field className="min-w-40 flex-1">
              <Label htmlFor="new-goal-target">Target date</Label>
              <Input
                id="new-goal-target"
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
              <Label htmlFor="new-goal-priority">Priority</Label>
              <Select
                id="new-goal-priority"
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
            <Label htmlFor="new-goal-involves">Involves</Label>
            <PersonAutocomplete
              id="new-goal-involves"
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
              Set goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
