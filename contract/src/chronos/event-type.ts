import { z } from 'zod';

/**
 * What kind of thing is happening.
 *
 * The set is deliberately small. Each entry is a promise that something
 * downstream will treat it differently — a different icon, a different default
 * duration, a different question asked when it is made — and a type nothing
 * ever branches on is a field everyone has to fill in for no one's benefit.
 *
 * What each is *for*:
 *
 * - `MEETING` — people gathered at a time, by arrangement among themselves.
 * - `APPOINTMENT` — a slot somebody else owns and you attend: a viewing, a
 *   doctor, a delivery window. The distinction from a meeting is who set it,
 *   which decides whether moving it is yours to do.
 * - `CALL` — a meeting that is remote by nature. Worth its own entry rather
 *   than a meeting with no location, because it tells "deliberately nowhere"
 *   from "nobody said where" — and only one of those is worth prompting about.
 * - `DEADLINE` — the moment something is due. A point rather than a span, and
 *   the reason {@link eventSchema}'s `endsAt` is optional.
 * - `REMINDER` — a nudge at a time, usually with nobody else in it.
 * - `OUT_OF_OFFICE` — time that is spoken for without being an occasion. It
 *   exists so that "busy" and "attending something" stop being the same claim.
 *
 * Notably absent: birthdays and anniversaries. Those are a rule that generates
 * occurrences, which is what a `Schedule` is for — modelling them as a type
 * here would mean storing a row per year for ever.
 */
export const EVENT_TYPES = [
  'MEETING',
  'APPOINTMENT',
  'CALL',
  'DEADLINE',
  'REMINDER',
  'OUT_OF_OFFICE',
] as const;

export const eventTypeSchema = z.enum(EVENT_TYPES);

export type EventType = (typeof EVENT_TYPES)[number];
