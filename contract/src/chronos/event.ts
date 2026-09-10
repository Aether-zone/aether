import { z } from 'zod';

import { userSchema } from '../prosopone/user.js';
import { placeSchema } from '../topos/place.js';

import { eventStatusSchema } from './event-status.js';
import { eventTypeSchema } from './event-type.js';

/**
 * Something happening at a time — a meeting, a deadline, a doctor's
 * appointment.
 *
 * One resource with a {@link EventType} rather than a resource per kind. They
 * share every field that matters, they all belong on the same calendar, and
 * "show me everything on Tuesday" is the question a calendar exists to answer
 * — which a union of six tables cannot answer without six queries and a merge.
 * What differs between kinds is presentation and prompting, and neither needs
 * its own schema.
 *
 * Three things about the shape are worth reading before changing it.
 *
 * **Times are ISO 8601 strings, not `Date`s.** A DTO crosses a process
 * boundary as JSON, where a `Date` arrives as a string anyway — so typing it
 * as `Date` would make every consumer's value disagree with its own type, and
 * `JSON.parse` would hand back something that fails the schema it is supposed
 * to satisfy. organon's `AetherEvent.time` is a string for exactly this
 * reason. Turning one into a `Date` is the reader's job, at the edge where it
 * is used.
 *
 * **`endsAt` is optional, because not every kind is a span.** A `DEADLINE` and
 * a `REMINDER` are moments: giving them an end would mean inventing one, and
 * every reader would then have to know it was invented. When it is present it
 * must be after the start.
 *
 * **The read shape embeds people and place; the write shape names them by id.**
 * A caller putting something in the calendar has ids and nothing else, and asking it to
 * send whole `Person` objects would invite it to send *stale* ones — a name
 * corrected in prosopone would be quietly overwritten by whatever the client
 * happened to be holding. A reader, meanwhile, wants the names without a
 * second request. See {@link createMeetingSchema}.
 */

const TITLE_MAX = 500;
const DESCRIPTION_MAX = 5000;

export const eventSchema = z
  .object({
    id: z.uuid(),

    title: z.string().trim().min(1, 'A title is required.').max(TITLE_MAX),
    /** Optional: a title is often the whole of what there is to say. */
    description: z.string().trim().max(DESCRIPTION_MAX).optional(),

    /** ISO 8601, in UTC. See the note above on why these are not `Date`s. */
    startsAt: z.iso.datetime(),
    /** Absent for a kind that is a moment rather than a span. */
    endsAt: z.iso.datetime().optional(),

    type: eventTypeSchema,

    /**
     * Where it is, embedded rather than referenced.
     *
     * Absent for something that is nowhere — a call is not somewhere — which
     * is why this is optional rather than nullable: "not stated" and "stated
     * as nothing" are the same claim here, and one spelling is enough.
     */
    location: placeSchema.optional(),

    status: eventStatusSchema,

    /**
     * Who called it, as a pistis subject.
     *
     * Optional because a meeting can arrive from somewhere with no such
     * concept — an imported calendar, an event another service announced —
     * and refusing those would be inventing a requirement the data does not
     * have.
     */
    organizerId: z.uuid().optional(),

    /**
     * Everyone expected, as people rather than ids.
     *
     * Always present, possibly empty: a reminder normally has nobody in it,
     * and a meeting with nobody is strange but legitimate — where a *missing*
     * array would just be a caller who forgot.
     */
    attendees: z.array(userSchema),

    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine((event) => !event.endsAt || event.endsAt > event.startsAt, {
    path: ['endsAt'],
    /*
     * A string comparison, which is exact for ISO 8601 in UTC: the format is
     * ordered lexicographically by design, so this needs no parsing and
     * cannot drift with a timezone.
     */
    error: 'An event has to end after it starts.',
  });

/**
 * What a caller may send to put one in the calendar.
 *
 * The id, the timestamps and the status are the api's to set — a client that
 * could choose an id could overwrite an event by guessing one, and a client
 * that could set `createdAt` could rewrite when it was booked.
 *
 * People and place arrive as **ids**: the caller has them, and sending whole
 * objects would let a stale copy of a person overwrite what prosopone knows.
 */
export const createEventSchema = z
  .object({
    /*
     * Required, and deliberately not defaulted to `MEETING`. A default would
     * make the commonest kind the silent one, so a caller that forgot the
     * field and a caller that meant a meeting would be indistinguishable —
     * and the first is worth catching.
     */
    type: eventTypeSchema,
    title: z.string().trim().min(1, 'A title is required.').max(TITLE_MAX),
    description: z.string().trim().max(DESCRIPTION_MAX).optional(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().optional(),
    /** A place in topos. Absent for something that is nowhere. */
    locationId: z.uuid().optional(),
    organizerId: z.uuid().optional(),
    /** Defaulted, so a caller scheduling for one person need not send `[]`. */
    attendeeIds: z.array(z.uuid()).default([]),
  })
  .refine((event) => !event.endsAt || event.endsAt > event.startsAt, {
    path: ['endsAt'],
    error: 'An event has to end after it starts.',
  });

/**
 * What a caller may send to change one.
 *
 * Every field optional, so a caller can send only what moved. `null` on
 * `locationId` clears the location, where absent leaves it alone — the one
 * place the distinction is needed, because "nowhere" is a real answer.
 *
 * `status` is here and not on create: an event is `SCHEDULED` when it is
 * made, and moves through its life afterwards.
 *
 * No `refine` on the times. A partial update may carry one of them, and
 * comparing it against a value this schema cannot see would either reject
 * valid changes or pass invalid ones. That check belongs where both are
 * known, which is the service.
 */
export const updateEventSchema = z.object({
  /*
   * Changeable: a call that becomes a meeting in a room is the same occasion
   * moved, not a new one — and cancelling and re-creating it would lose
   * everyone's acceptance.
   */
  type: eventTypeSchema.optional(),
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  locationId: z.uuid().nullable().optional(),
  organizerId: z.uuid().nullable().optional(),
  status: eventStatusSchema.optional(),
  /** The whole set, when sent: whoever is missing from it is taken off. */
  attendeeIds: z.array(z.uuid()).optional(),
});

export type EventDTO = z.infer<typeof eventSchema>;
export type CreateEventDTO = z.infer<typeof createEventSchema>;
export type UpdateEventDTO = z.infer<typeof updateEventSchema>;
