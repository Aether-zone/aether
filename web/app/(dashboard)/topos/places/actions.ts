'use server';

import { createPlaceSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { readCoordinates } from '@/lib/coordinates';
import { createPlace } from '@/lib/places';

const PLACES = '/topos/places';

export type PlaceFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Turns an api refusal into something a form can render.
 *
 * The api validates with the same schema this file does, so its per-field
 * messages are the authoritative ones.
 */
function toFormResult(failure: ApiFailure): PlaceFormResult {
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
        'You do not belong to an organization, and places are kept per organization.',
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
 * Records a place, then goes back to the list.
 *
 * Validated here as well as on the server: this catches a typo before a round
 * trip and puts the message under the right input, while the api's check is
 * the one that actually protects the store — a form is not a security
 * boundary. Both read the same schema, so they cannot disagree about what is
 * valid.
 *
 * The coordinates arrive as strings, because every form field does. They are
 * turned into numbers *here* rather than by a coercing schema, so that "about
 * fifty-two" fails as a number rather than silently becoming `NaN` somewhere
 * a map has to deal with it.
 */
export async function addPlaceAction(input: {
  name: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
}): Promise<PlaceFormResult> {
  const coordinates = readCoordinates(input);

  if (!coordinates.ok) {
    return { fieldErrors: coordinates.fieldErrors };
  }

  const fieldErrors: Record<string, string> = {};

  const parsed = createPlaceSchema.safeParse({
    name: input.name,
    // Absent rather than empty: the schema treats a description as optional,
    // and "" is a description of nothing.
    ...(input.description.trim() ? { description: input.description } : {}),
    address: input.address,
    lat: coordinates.lat,
    lng: coordinates.lng,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');

      // First message per field: later ones are usually consequences of the
      // first, and a box can only show one.
      if (path && !fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }

    return { fieldErrors };
  }

  const result = await createPlace(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(PLACES);

  // Outside any try/catch: redirect() signals by throwing.
  redirect(PLACES);
}
