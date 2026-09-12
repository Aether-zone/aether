/**
 * Reading coordinates out of a form.
 *
 * Pure, and deliberately not in `lib/places.ts`, which is `server-only`: this
 * is the one piece of real logic on the way in, and it should be reachable
 * without a session behind it.
 *
 * The conversion happens here rather than in a coercing zod schema so that
 * "about fifty-two" fails *as text* with something to say about it, instead of
 * becoming `NaN` and failing later as a number nobody can explain.
 */
export type CoordinateFields = { lat: string; lng: string };

export type CoordinateResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; fieldErrors: Record<string, string> };

export function readCoordinates(input: CoordinateFields): CoordinateResult {
  const fieldErrors: Record<string, string> = {};
  const values: Record<string, number> = {};

  for (const field of ['lat', 'lng'] as const) {
    const text = input[field].trim();

    /*
     * Empty is checked separately because `Number('')` is 0 — a real latitude,
     * on the equator — so an unanswered field would otherwise save as a
     * confident claim about the Gulf of Guinea.
     */
    if (text === '') {
      fieldErrors[field] = 'Enter a number.';
      continue;
    }

    const value = Number(text);

    if (Number.isNaN(value)) {
      fieldErrors[field] = 'Enter a number.';
      continue;
    }

    values[field] = value;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, lat: values.lat, lng: values.lng };
}
