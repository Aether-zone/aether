import type { EventDTO, EventType } from '@aether/contract';
import type { JsonLdDocument, JsonLdReference } from '@aether-zone/organon';

/**
 * A calendar entry as the rest of aether-zone sees it.
 *
 * Not `EventDTO`. That one is aether's HTTP shape, and putting it on the bus
 * would make every consumer depend on this api's idea of an event. This is the
 * same occasion described in a vocabulary anything can read, keyed by an IRI
 * rather than a bare uuid.
 *
 * **Do not confuse this with an Aether event.** `AetherEvent` is the envelope
 * that says *something happened to a resource*; this is a resource that
 * happens to be a thing in a calendar. One of them travels, the other is
 * carried. The words collide and the concepts do not.
 */

/** The vocabulary aether-zone publishes under. */
export const AETHER_VOCAB = 'https://aether.zone/vocab/';

export const EVENT_CONTEXT = {
  aether: AETHER_VOCAB,
  title: 'aether:title',
  description: 'aether:description',
  startTime: 'aether:startTime',
  endTime: 'aether:endTime',
  location: 'aether:location',
  attendee: 'aether:attendee',
  organizer: 'aether:organizer',
  eventStatus: 'aether:eventStatus',
} as const;

/**
 * The second `@type` each kind carries.
 *
 * Every document is an `aether:Event`; a meeting is *also* an
 * `aether:Meeting`. JSON-LD allows both, and it is what a graph store wants:
 * arachni turns `@type` into labels, so "every calendar entry on Tuesday" and
 * "every meeting" are each one query rather than one of them being a scan with
 * a property filter.
 *
 * It also lands aether's meetings on the same label akouo already publishes,
 * so a consumer asking for meetings gets both without knowing there are two
 * producers. They stay separate *nodes* — the IRIs differ — which is correct:
 * they are different records of possibly different occasions.
 */
const KIND_TYPES: Record<EventType, string> = {
  MEETING: 'aether:Meeting',
  APPOINTMENT: 'aether:Appointment',
  CALL: 'aether:Call',
  DEADLINE: 'aether:Deadline',
  REMINDER: 'aether:Reminder',
  OUT_OF_OFFICE: 'aether:OutOfOffice',
};

export interface EventJsonLD extends JsonLdDocument {
  '@type': string[];
  '@context': typeof EVENT_CONTEXT;

  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  eventStatus: string;

  /** References, not nested resources: a person and a place outlive the
   * occasion they were at, so a consumer must not delete them with it. */
  location?: JsonLdReference;
  organizer?: JsonLdReference;
  attendee: JsonLdReference[];
}

/**
 * The IRI an event is known by outside aether.
 *
 * A URN rather than a URL: it names the resource without promising anything
 * answers if you fetch it, which is the honest claim for an id on a bus.
 */
export const eventIri = (id: string): string => `urn:aether:event:${id}`;

/** The IRIs of the resources an event points at, minted by the same rules. */
export const personIri = (id: string): string => `urn:aether:person:${id}`;
export const placeIri = (id: string): string => `urn:aether:place:${id}`;

/**
 * An event as a JSON-LD document.
 *
 * Attendees and the location are **references** rather than nested resources,
 * which is the whole difference between "delete this and the people go too"
 * and "delete this and the people remain". arachni cascades a delete through
 * nested resources only — see its `PART_OF` edges — so getting this wrong
 * would take a person out of the graph when a meeting was cancelled.
 *
 * They also point at the IRIs prosopone and topos already announced, so an
 * event joins onto nodes those services put there rather than minting
 * lookalikes.
 */
export function toEventDocument(event: EventDTO): EventJsonLD {
  return {
    '@context': EVENT_CONTEXT,
    '@id': eventIri(event.id),
    '@type': ['aether:Event', KIND_TYPES[event.type]],
    title: event.title,
    ...(event.description ? { description: event.description } : {}),
    startTime: event.startsAt,
    // Omitted rather than null for a kind that is a moment: absent means "not
    // stated", where null would assert that it ends at no time.
    ...(event.endsAt ? { endTime: event.endsAt } : {}),
    eventStatus: event.status,
    ...(event.location
      ? { location: { '@id': placeIri(event.location.id) } }
      : {}),
    ...(event.organizerId
      ? { organizer: { '@id': personIri(event.organizerId) } }
      : {}),
    attendee: event.attendees.map((attendee) => ({
      '@id': personIri(attendee.id),
    })),
  };
}
