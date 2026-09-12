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
import { GROUP_TYPES } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { addGroupAction } from './actions';
import { TYPES } from './types';

/**
 * Recording a group.
 *
 * A name is the only required field, and the kind is offered rather than
 * asked: the kind is often the least certain thing about a group, and a
 * required select would make somebody guess at the door.
 */
export function NewGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function close() {
    setName('');
    setDescription('');
    setType('');
    setError(null);
    setFieldErrors({});
    onOpenChange(false);
  }

  function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await addGroupAction({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(type ? { type } : {}),
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
        <form onSubmit={record} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>
              A group of people — a client, a community, a family. Not the group
              you signed in as.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <Field>
            <Label htmlFor="new-group-name">Name</Label>
            <Input
              id="new-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            {fieldErrors.name && (
              <Text tone="destructive" size="body-small">
                {fieldErrors.name}
              </Text>
            )}
          </Field>

          <Field className="w-56">
            <Label htmlFor="new-group-type">Kind</Label>
            <Select
              id="new-group-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {/* Blank first and selected by default: the kind is often the
                  least certain thing about a group, and "Unstated" is a real
                  answer rather than a gap. */}
              <option value="">Unstated</option>
              {GROUP_TYPES.map((kind) => (
                <option key={kind} value={kind}>
                  {TYPES[kind].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="new-group-description">Description</Label>
            <Textarea
              id="new-group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional. Who they are, and what they are to you."
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              Record it
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
