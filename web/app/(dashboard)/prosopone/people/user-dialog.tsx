'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from '@aether-zone/kosmos';
import type { UserDTO } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { addUserAction, editUserAction } from './actions';

/** The editable half of a user — everything but the id, which the api owns. */
type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

const EMPTY: Draft = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
};

const draftOf = (user: UserDTO | null): Draft =>
  user
    ? {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      }
    : EMPTY;

/**
 * Adds a person, or edits one.
 *
 * One dialog for both because the fields and the validation are identical —
 * the only difference is which action runs and what the buttons say. Two
 * components would be the same form twice, and the second copy is where a
 * field gets forgotten.
 *
 * `user` being null means "add". The dialog resets to that person's details
 * whenever it opens, so reopening after a cancelled edit does not show the
 * abandoned draft.
 */
export function UserDialog({
  open,
  onOpenChange,
  user = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserDTO | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(user));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * Reset when the dialog opens — adjusting state during render rather than in
   * an effect. React re-renders immediately without committing the first pass,
   * so the form never paints with the previous person's details; an effect
   * would show them for a frame, and `react-hooks/set-state-in-effect` refuses
   * it for that reason.
   *
   * On open rather than on close: closing animates, and clearing the fields
   * mid-animation shows the form emptying itself as it disappears.
   */
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setDraft(draftOf(user));
      setFieldErrors({});
      setError(null);
    }
  }

  const set = (field: keyof Draft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));

    // Clear this field's error as soon as it is touched; leaving it makes the
    // form look broken while it is being fixed.
    setFieldErrors((current) => {
      if (!(field in current)) {
        // Same object back, so nothing downstream re-renders for a no-op.
        return current;
      }

      const next = { ...current };

      delete next[field];

      return next;
    });
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = user
        ? await editUserAction(user.id, draft)
        : await addUserAction(draft);

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);

        return;
      }

      if (result.error) {
        setError(result.error);

        return;
      }

      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{user ? 'Edit person' : 'Add a person'}</DialogTitle>
            <DialogDescription>
              {user
                ? 'Only what you change is sent.'
                : 'Prosopone keeps the people aether knows about.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="First name"
                value={draft.firstName}
                onChange={set('firstName')}
                error={fieldErrors.firstName}
                autoFocus
              />
              <TextField
                label="Last name"
                value={draft.lastName}
                onChange={set('lastName')}
                error={fieldErrors.lastName}
              />
            </div>

            <TextField
              label="Email"
              type="email"
              value={draft.email}
              onChange={set('email')}
              error={fieldErrors.email}
              placeholder="ada@example.com"
            />

            <TextField
              label="Phone number"
              type="tel"
              value={draft.phoneNumber}
              onChange={set('phoneNumber')}
              error={fieldErrors.phoneNumber}
              placeholder="+31612345678"
              // The api requires E.164, so say so before it refuses rather
              // than after.
              hint="International format, starting with +."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : user ? 'Save changes' : 'Add person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {/* The hint gives way to the error rather than stacking with it: two
          lines of guidance under one box is one too many. */}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </Field>
  );
}
