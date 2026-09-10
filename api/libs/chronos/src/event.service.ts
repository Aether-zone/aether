import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  AETHER_SOURCE,
  EVENT_CREATED,
  EVENT_DELETED,
  EVENT_UPDATED,
} from '@aether/contract';
import type {
  CreateEventDTO,
  EventDTO,
  UpdateEventDTO,
  PlaceDTO,
  UserDTO,
} from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEvent,
  type AetherEventType,
} from '@aether-zone/organon';

import { PlaceService } from '@aether/topos';
import { UserService } from '@aether/prosopone';

import { eventIri, toEventDocument, type EventJsonLD } from './event.json-ld';

/**
 * What is in the calendar.
 *
 * **In memory, deliberately and temporarily** — a placeholder for a
 * repository, not a cache in front of one. Swapping it for a persistent store
 * should change nothing above this class.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced, so there is no call path that reads across the boundary.
 *
 * People and place are stored as *ids* and resolved on the way out. Storing
 * copies would mean a name corrected in prosopone staying wrong on every
 * event that had ever mentioned that person.
 */
@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  private readonly events: StoredEvent[] = [];

  constructor(
    private readonly publisher: EventPublisher,
    private readonly people: UserService,
    private readonly places: PlaceService,
  ) {}

  list(actor: Actor): EventDTO[] {
    return this.events
      .filter((event) => event.organizationId === actor.organizationId)
      .map((event) => this.resolve(actor, event));
  }

  get(actor: Actor, id: string): EventDTO {
    return this.resolve(actor, this.stored(actor, id));
  }

  async create(actor: Actor, input: CreateEventDTO): Promise<EventDTO> {
    // Resolved before anything is stored, so an unknown attendee is a 404
    // rather than an event that exists and cannot be read back.
    this.requireReferences(actor, input.attendeeIds, input.locationId);

    const now = new Date().toISOString();

    const event: StoredEvent = {
      id: randomUUID(),
      organizationId: actor.organizationId,
      type: input.type,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      locationId: input.locationId ?? null,
      organizerId: input.organizerId,
      attendeeIds: input.attendeeIds,
      // Every event starts scheduled; the status moves afterwards.
      status: 'SCHEDULED',
      createdAt: now,
      updatedAt: now,
    };

    this.events.push(event);

    const dto = this.resolve(actor, event);

    await this.announce(EVENT_CREATED, 'aether:ResourceCreated', dto, actor);

    return dto;
  }

  async update(
    actor: Actor,
    id: string,
    changes: UpdateEventDTO,
  ): Promise<EventDTO> {
    const existing = this.stored(actor, id);

    this.requireReferences(
      actor,
      changes.attendeeIds,
      // `undefined` means "leave it alone", `null` means "clear it" — only a
      // value needs checking.
      changes.locationId ?? undefined,
    );

    const updated: StoredEvent = {
      ...existing,
      ...changes,
      /*
       * `undefined` leaves these alone and `null` clears them — the merge has
       * to spell that out, because spreading `changes` would otherwise write
       * the `null` straight through as a value the stored shape does not have.
       */
      locationId:
        changes.locationId === undefined
          ? existing.locationId
          : changes.locationId,
      organizerId:
        changes.organizerId === undefined
          ? existing.organizerId
          : (changes.organizerId ?? undefined),
      attendeeIds: changes.attendeeIds ?? existing.attendeeIds,
      updatedAt: new Date().toISOString(),
    };

    /*
     * The times are compared here rather than in the schema. A partial update
     * may carry only one of them, and the other is only known once it has been
     * merged with what is stored.
     */
    if (updated.endsAt && updated.endsAt <= updated.startsAt) {
      throw new BadRequestException({
        message: 'An event has to end after it starts.',
        errors: [
          { path: 'endsAt', message: 'An event has to end after it starts.' },
        ],
      });
    }

    this.events[this.events.indexOf(existing)] = updated;

    const dto = this.resolve(actor, updated);

    await this.announce(EVENT_UPDATED, 'aether:ResourceUpdated', dto, actor);

    return dto;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const event = this.stored(actor, id);
    const dto = this.resolve(actor, event);

    this.events.splice(this.events.indexOf(event), 1);

    await this.announce(EVENT_DELETED, 'aether:ResourceDeleted', dto, actor);
  }

  /**
   * Tells the rest of aether-zone what happened.
   *
   * Published *after* the store, so nothing can hear about an event that is
   * not there. A failure here does not fail the request: the event *was*
   * recorded, and answering 500 would invite a retry that creates a second
   * one. The honest fix for the gap is an outbox, which needs a transaction
   * this store does not have.
   */
  private async announce(
    routingKey: string,
    type: AetherEventType,
    event: EventDTO,
    actor: Actor,
  ): Promise<void> {
    const message: AetherEvent<EventJsonLD> = {
      // Overwritten before it leaves: `EventPublisher` spreads its transport
      // envelope last. Set anyway because the type requires it.
      id: randomUUID(),
      type,
      source: AETHER_SOURCE,
      time: new Date().toISOString(),
      subject: eventIri(event.id),
      /*
       * Which tenant this belongs to. Without it arachni refuses to write a
       * node it cannot scope and mneme refuses to index text it cannot file —
       * the event is accepted by the schema and dropped by everyone.
       */
      organizationId: actor.organizationId,
      ...(type === 'aether:ResourceDeleted'
        ? {}
        : { data: toEventDocument(event) }),
      actor: { id: actor.id, type: 'User' },
    } as AetherEvent<EventJsonLD>;

    try {
      await this.publisher.publish(routingKey, message);
    } catch (cause) {
      this.logger.error(
        `Event ${message.subject} changed but "${routingKey}" could not be published`,
        cause,
      );
    }
  }

  /** Fails unless every person and place named exists in this organization. */
  private requireReferences(
    actor: Actor,
    attendeeIds: string[] | undefined,
    locationId: string | undefined,
  ): void {
    for (const attendeeId of attendeeIds ?? []) {
      // `get` throws a 404 for someone this organization does not have, which
      // is the answer: the caller named somebody who is not here.
      this.people.get(actor, attendeeId);
    }

    if (locationId) {
      this.places.get(actor, locationId);
    }
  }

  /** The stored record as a DTO, with people and place filled in. */
  private resolve(actor: Actor, event: StoredEvent): EventDTO {
    const attendees: UserDTO[] = [];

    for (const attendeeId of event.attendeeIds) {
      try {
        attendees.push(this.people.get(actor, attendeeId));
      } catch {
        /*
         * Someone removed from prosopone since. Skipped rather than failing
         * the read: an event whose attendee has left is still an event, and
         * refusing to show it would make one deletion hide a calendar.
         */
      }
    }

    let location: PlaceDTO | undefined;

    if (event.locationId) {
      try {
        location = this.places.get(actor, event.locationId);
      } catch {
        // Likewise: a place deleted since leaves the event somewhere unstated.
      }
    }

    return {
      id: event.id,
      type: event.type,
      title: event.title,
      ...(event.description ? { description: event.description } : {}),
      startsAt: event.startsAt,
      ...(event.endsAt ? { endsAt: event.endsAt } : {}),
      ...(location ? { location } : {}),
      status: event.status,
      ...(event.organizerId ? { organizerId: event.organizerId } : {}),
      attendees,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private stored(actor: Actor, id: string): StoredEvent {
    const event = this.events.find(
      (candidate) =>
        candidate.id === id &&
        candidate.organizationId === actor.organizationId,
    );

    if (!event) {
      throw new NotFoundException(`No event with id ${id}.`);
    }

    return event;
  }
}

/**
 * An event as held here: ids rather than the resources they name.
 *
 * Storing whole people would mean a name corrected in prosopone staying wrong
 * on every event that ever mentioned them.
 */
type StoredEvent = {
  id: string;
  organizationId: string;
  type: EventDTO['type'];
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  locationId: string | null;
  organizerId?: string;
  attendeeIds: string[];
  status: EventDTO['status'];
  createdAt: string;
  updatedAt: string;
};
