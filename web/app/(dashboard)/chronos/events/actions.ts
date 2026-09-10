'use server';

import { createEventSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { createEvent } from '@/lib/events';
import { toIsoInstant } from '@/lib/when';

const EVENTS = '/chronos/events';

export type EventFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFormResult(failure: ApiFailure): EventFormResult {
  const fieldErrors: Record<string, string> = {};

  for (const issue of failure.body?.errors ?? []) {
    if (issue.path && issue.message) {
      fieldErrors[issue.path] = issue.message;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  if (failure.reason === 'noOrganization') {
    return {
      error:
        'You do not belong to an organization, and the calendar is kept per organization.',
    };
  }

  if (failure.reason === 'unauthenticated') {
    return { error: 'Your session is no longer valid. Sign out and back in.' };
  }

  if (failure.reason === 'unavailable') {
    return { error: 'The aether api did not answer. Try again in a moment.' };
  }

  return { error: failure.body?.message ?? 'That could not be saved.' };
}

/**
 * Puts something in the calendar, then goes back to the list.
 *
 * Validated here as well as on the server: this catches a mistake before a
 * round trip and puts the message under the right input, while the api's check
 * is the one that actually protects the store. Both read the same schema, so
 * they cannot disagree about what is valid.
 */
export async function addEventAction(input: {
  type: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationId: string;
  attendeeIds: string[];
}): Promise<EventFormResult> {
  /*
   * The form's times are `datetime-local` values in the reader's zone. They
   * are converted here, once, rather than by a coercing schema — so "sometime
   * tuesday" fails as text with something to say, instead of arriving as an
   * Invalid Date the api has to describe.
   */
  const startsAt = toIsoInstant(input.startsAt);
  const endsAt = toIsoInstant(input.endsAt);
  const fieldErrors: Record<string, string> = {};

  if (!startsAt) {
    fieldErrors.startsAt = 'Pick when it starts.';
  }

  if (input.endsAt.trim() && !endsAt) {
    fieldErrors.endsAt = 'That is not a time.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const parsed = createEventSchema.safeParse({
    type: input.type,
    title: input.title,
    // Absent rather than empty: the schema treats these as optional, and ""
    // is a description of nothing.
    ...(input.description.trim() ? { description: input.description } : {}),
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    ...(input.locationId ? { locationId: input.locationId } : {}),
    attendeeIds: input.attendeeIds,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');

      if (path && !fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }

    return { fieldErrors };
  }

  const result = await createEvent(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(EVENTS);

  // Outside any try/catch: redirect() signals by throwing.
  redirect(EVENTS);
}
