import { z } from 'zod';

/**
 * Where an event is in its life.
 *
 * These are *scheduling* states, deliberately. akouo has a `MeetingStatus`
 * too — `INITIAL | RECORDED | TRANSCRIBED` — but that one tracks how far a
 * recording has got through akouo's pipeline, which is a different question
 * about a different thing. An event can be `COMPLETED` here and have no
 * recording at all.
 *
 * `CANCELLED` rather than deleting: something called off still happened as a
 * fact about people's calendars, and everyone who was invited has a reason to
 * see that it is not going ahead.
 *
 * The same four fit every {@link EventType}, if loosely: a `DEADLINE` is
 * `IN_PROGRESS` only in the sense that its moment is now. Splitting the set
 * per type would mean a status field whose valid values depend on another
 * field, which is a great deal of ceremony for one odd reading.
 */
export const EVENT_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export const eventStatusSchema = z.enum(EVENT_STATUSES);

export type EventStatus = (typeof EVENT_STATUSES)[number];
