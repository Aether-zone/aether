'use client';

import {
  Alert,
  AlertDescription,
  Autocomplete,
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from '@aether-zone/kosmos';
import { EVENT_TYPES, type EventType } from '@aether/contract';
import type { PlaceDTO, UserDTO } from '@aether/contract';
import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';

import { addEventAction } from './actions';

/** How each kind reads in a dropdown, and whether it is a span or a moment. */
const KINDS: Record<EventType, { label: string; hasEnd: boolean }> = {
  MEETING: { label: 'Meeting', hasEnd: true },
  APPOINTMENT: { label: 'Appointment', hasEnd: true },
  CALL: { label: 'Call', hasEnd: true },
  DEADLINE: { label: 'Deadline', hasEnd: false },
  REMINDER: { label: 'Reminder', hasEnd: false },
  OUT_OF_OFFICE: { label: 'Out of office', hasEnd: true },
};

type Draft = {
  type: EventType;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationId: string;
  attendeeIds: string[];
};

const EMPTY: Draft = {
  type: 'MEETING',
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  locationId: '',
  attendeeIds: [],
};

/**
 * The form for a new calendar entry.
 *
 * The kind is first because it changes what the rest of the form asks: a
 * deadline has no end, and showing an "ends" field for one would invite
 * somebody to invent a value the schema then has to reject.
 */
export function EventForm({
  people,
  places,
}: {
  people: UserDTO[];
  places: PlaceDTO[];
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [locationText, setLocationText] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const kind = KINDS[draft.type];

  const set = <K extends keyof Draft>(field: K) => (value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));

    setFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const next = { ...current };

      delete next[field as string];

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
       * nothing after this runs, and there is no "saved" state to hold.
       */
      const result = await addEventAction({
        ...draft,
        // A kind that is a moment sends no end, whatever is left in the field
        // from a previous selection.
        endsAt: kind.hasEnd ? draft.endsAt : '',
      });

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

      <Field>
        <FieldLabel>Kind</FieldLabel>
        <Select
          value={draft.type}
          onChange={(event) => set('type')(event.target.value as EventType)}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {KINDS[type].label}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <FieldLabel>Title</FieldLabel>
        <Input
          value={draft.title}
          onChange={(event) => set('title')(event.target.value)}
          aria-invalid={fieldErrors.title ? true : undefined}
          placeholder="Quarterly planning"
          autoFocus
        />
        {fieldErrors.title && <FieldError>{fieldErrors.title}</FieldError>}
      </Field>

      <Field>
        <FieldLabel>Description</FieldLabel>
        <Textarea
          value={draft.description}
          onChange={(event) => set('description')(event.target.value)}
          rows={3}
        />
        <span className="text-xs text-muted-foreground">Optional.</span>
      </Field>

      <div className={kind.hasEnd ? 'grid grid-cols-2 gap-3' : ''}>
        <Field>
          <FieldLabel>{kind.hasEnd ? 'Starts' : 'When'}</FieldLabel>
          <Input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(event) => set('startsAt')(event.target.value)}
            aria-invalid={fieldErrors.startsAt ? true : undefined}
          />
          {fieldErrors.startsAt && (
            <FieldError>{fieldErrors.startsAt}</FieldError>
          )}
        </Field>

        {/* A deadline and a reminder are moments. Offering an end would invite
            somebody to invent one the schema then rejects. */}
        {kind.hasEnd && (
          <Field>
            <FieldLabel>Ends</FieldLabel>
            <Input
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) => set('endsAt')(event.target.value)}
              aria-invalid={fieldErrors.endsAt ? true : undefined}
            />
            {fieldErrors.endsAt && <FieldError>{fieldErrors.endsAt}</FieldError>}
          </Field>
        )}
      </div>

      <Field>
        <FieldLabel>Location</FieldLabel>
        <Autocomplete
          options={places.map((place) => ({
            value: place.id,
            label: place.name,
          }))}
          value={locationText}
          onValueChange={(text) => {
            setLocationText(text);

            // Typing after a selection means the selection no longer matches
            // what is on screen.
            if (draft.locationId) {
              set('locationId')('');
            }
          }}
          onSelect={(option) => {
            set('locationId')(option.value);
            setLocationText(option.label);
          }}
          placeholder={
            places.length === 0 ? 'No places recorded yet' : 'Somewhere, or nowhere'
          }
          disabled={places.length === 0}
          emptyMessage="No place by that name."
        />
        {fieldErrors.locationId ? (
          <FieldError>{fieldErrors.locationId}</FieldError>
        ) : (
          <span className="text-xs text-muted-foreground">
            Optional — places come from Topos.
          </span>
        )}
      </Field>

      <Field>
        <FieldLabel>Attendees</FieldLabel>
        {people.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Nobody in Prosopone yet.
          </span>
        ) : (
          /* A list of checkboxes rather than a multi-select: the set is small,
             and seeing who is on it beats opening a control to find out. */
          <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
            {people.map((person) => (
              <label
                key={person.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                {/* kosmos's Checkbox is a real `<input type="checkbox">`,
                    so this is `onChange` and not a controlled-component
                    callback of its own. */}
                <Checkbox
                  checked={draft.attendeeIds.includes(person.id)}
                  onChange={(event) =>
                    set('attendeeIds')(
                      event.target.checked
                        ? [...draft.attendeeIds, person.id]
                        : draft.attendeeIds.filter((id) => id !== person.id),
                    )
                  }
                />
                {person.firstName} {person.lastName}
              </label>
            ))}
          </div>
        )}
      </Field>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add to calendar'}
        </Button>
        <Link
          href="/chronos/events"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
