/**
 * Rendering the times an event carries.
 *
 * Pure, and deliberately not `server-only`: the create form needs the same
 * conversions on the way in, and a value that round-trips through two
 * different implementations is a value that will eventually disagree with
 * itself.
 */

/**
 * "1 Mar 2026, 09:00 – 10:00", or just the start for a kind that is a moment.
 *
 * The api's times are ISO strings in UTC; `toLocaleString` renders them in the
 * reader's zone, which is the only zone that means anything to them.
 */
export function formatWhen(startsAt: string, endsAt?: string): string {
  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    return '—';
  }

  const date = start.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const from = start.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!endsAt) {
    return `${date}, ${from}`;
  }

  const end = new Date(endsAt);

  if (Number.isNaN(end.getTime())) {
    return `${date}, ${from}`;
  }

  const to = end.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Same day is the overwhelming case, and repeating the date reads as noise.
  const sameDay = start.toDateString() === end.toDateString();

  return sameDay
    ? `${date}, ${from} – ${to}`
    : `${date}, ${from} – ${end.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      })}, ${to}`;
}

/**
 * Turns the two halves of a `datetime-local` field into an ISO instant.
 *
 * The browser gives "2026-03-01T09:00" with no zone, meaning *the reader's*
 * zone — so it is parsed as local and converted, rather than having a `Z`
 * stapled on, which would silently shift every event by the offset.
 */
export function toIsoInstant(local: string): string | null {
  const trimmed = local.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
