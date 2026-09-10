'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from '@aether-zone/kosmos';
import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';

import { addPlaceAction } from './actions';

/** Every field as the form holds it — text, because that is what inputs give. */
type Draft = {
  name: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
};

const EMPTY: Draft = {
  name: '',
  description: '',
  address: '',
  lat: '',
  lng: '',
};

/**
 * The form for a new place.
 *
 * Coordinates are kept as strings here and converted in the action. A number
 * input that holds a number cannot distinguish "empty" from "zero" — and zero
 * is a real latitude — so the text is the honest state, and the conversion
 * happens once, where a failure has somewhere to be reported.
 */
export function PlaceForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (field: keyof Draft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));

    // Clear this field's error as soon as it is touched; leaving it makes the
    // form look broken while it is being fixed.
    setFieldErrors((current) => {
      if (!(field in current)) {
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
      /*
       * On success the action redirects, which it signals by throwing — so
       * nothing after this runs, and there is no "saved" state to hold here.
       */
      const result = await addPlaceAction(draft);

      if (result?.fieldErrors) {
        setFieldErrors(result.fieldErrors);

        return;
      }

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <TextField
        label="Name"
        value={draft.name}
        onChange={set('name')}
        error={fieldErrors.name}
        placeholder="Het Sieraad"
        autoFocus
      />

      <Field>
        <FieldLabel>Description</FieldLabel>
        <Textarea
          value={draft.description}
          onChange={(event) => set('description')(event.target.value)}
          placeholder="A converted school building."
          rows={3}
        />
        {fieldErrors.description ? (
          <FieldError>{fieldErrors.description}</FieldError>
        ) : (
          <span className="text-xs text-muted-foreground">Optional.</span>
        )}
      </Field>

      <TextField
        label="Address"
        value={draft.address}
        onChange={set('address')}
        error={fieldErrors.address}
        placeholder="Postjesweg 1, 1057 DT Amsterdam"
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Latitude"
          value={draft.lat}
          onChange={set('lat')}
          error={fieldErrors.lat}
          placeholder="52.3676"
          hint="-90 to 90"
        />
        <TextField
          label="Longitude"
          value={draft.lng}
          onChange={set('lng')}
          error={fieldErrors.lng}
          placeholder="4.8776"
          hint="-180 to 180"
        />
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add place'}
        </Button>
        {/* A link, not a button: cancelling is navigating away, and kosmos's
            Button renders a real <button> with no `asChild` to wrap an anchor
            in. This also works before any JavaScript has loaded. */}
        <Link
          href="/topos/places"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
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
