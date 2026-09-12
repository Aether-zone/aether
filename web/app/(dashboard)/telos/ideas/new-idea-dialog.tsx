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
import type { UserDTO } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { PersonAutocomplete } from '@/components/person-autocomplete';

import { addIdeaAction } from './actions';

/**
 * Capturing one, with room for who it is about.
 *
 * A dialog rather than the single field this list used to carry, and the
 * trade is deliberate: an idea can now name the people it involves, and a
 * people picker does not belong on a line you are meant to type into and
 * forget. A title is still the only thing required, so the fast path is open,
 * type, Enter.
 */
export function NewIdeaDialog({
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
  const [involves, setInvolves] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle('');
    setDescription('');
    setInvolves([]);
    setError(null);
  }

  function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await addIdeaAction({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        involves,
      });

      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            result.fieldErrors?.title ??
            'That could not be saved.',
        );

        return;
      }

      // Cleared only on success, so a failed capture does not lose what was
      // typed.
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={capture} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New idea</DialogTitle>
            <DialogDescription>
              A title is all that is needed. The rest can wait, or never come.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <Field>
            <Label htmlFor="new-idea-title">Title</Label>
            <Input
              id="new-idea-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Write it down…"
              autoFocus
            />
          </Field>

          <Field>
            <Label htmlFor="new-idea-description">Description</Label>
            <Textarea
              id="new-idea-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional. What is the idea, and why is it worth having?"
            />
          </Field>

          <Field>
            <Label htmlFor="new-idea-involves">Involves</Label>
            <PersonAutocomplete
              id="new-idea-involves"
              people={people}
              selected={involves}
              onChange={setInvolves}
              disabled={pending}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              Capture
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
