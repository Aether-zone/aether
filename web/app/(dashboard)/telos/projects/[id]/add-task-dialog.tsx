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
} from '@aether-zone/kosmos';
import { PRIORITY_MAX, PRIORITY_MIN, type ProjectDTO } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { priorityWord } from '@/lib/goal-priority';
import { toIsoInstant } from '@/lib/when';

import { addTaskAction } from '../../tasks/actions';

const PRIORITIES = Array.from(
  { length: PRIORITY_MAX - PRIORITY_MIN + 1 },
  (_, index) => PRIORITY_MIN + index,
);

/**
 * Adding a task to a project.
 *
 * The project is not a field: you are already looking at it, and offering a
 * picker pre-filled with the answer is a chance to get it wrong for no gain.
 */
export function AddTaskDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function close() {
    setTitle('');
    setDueAt('');
    setPriority('');
    setError(null);
    setFieldErrors({});
    onOpenChange(false);
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setError(null);
    setFieldErrors({});

    /*
     * A date alone means the end of that day in the reader's own zone. Midnight
     * at the *start* would make a task due today read as overdue from the
     * moment it was written down.
     */
    const due = dueAt.trim()
      ? toIsoInstant(`${dueAt.trim()}T23:59`)
      : undefined;

    if (dueAt.trim() && !due) {
      setFieldErrors({ dueAt: 'That is not a date.' });

      return;
    }

    startTransition(async () => {
      const result = await addTaskAction({
        title: title.trim(),
        projectId: project.id,
        ...(due ? { dueAt: due } : {}),
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
        <form onSubmit={add} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add a task</DialogTitle>
            <DialogDescription>
              It will be filed under “{project.title}” and start as to do.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <Field>
            <Label htmlFor="new-task-title">Title</Label>
            <Input
              id="new-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs doing?"
              autoFocus
            />
            {fieldErrors.title && (
              <Text tone="destructive" size="body-small">
                {fieldErrors.title}
              </Text>
            )}
          </Field>

          <div className="flex flex-wrap gap-4">
            <Field className="min-w-40 flex-1">
              <Label htmlFor="new-task-due">Due</Label>
              <Input
                id="new-task-due"
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
              {fieldErrors.dueAt && (
                <Text tone="destructive" size="body-small">
                  {fieldErrors.dueAt}
                </Text>
              )}
            </Field>

            <Field className="w-40">
              <Label htmlFor="new-task-priority">Priority</Label>
              <Select
                id="new-task-priority"
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

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
