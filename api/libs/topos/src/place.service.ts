import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  AETHER_SOURCE,
  PLACE_CREATED,
  PLACE_DELETED,
  PLACE_UPDATED,
} from '@aether/contract';
import type {
  CreatePlaceDTO,
  PlaceDTO,
  UpdatePlaceDTO,
} from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEvent,
  type AetherEventType,
} from '@aether-zone/organon';

import { placeIri, toPlaceDocument, type PlaceJsonLD } from './place.json-ld';

/**
 * The places topos knows about.
 *
 * **In memory, deliberately and temporarily.** Everything is lost on restart
 * and nothing is shared between instances, so this is a placeholder for a
 * repository rather than a cache in front of one. It exists so the controller
 * and the console can be built against a real shape now; swapping it for a
 * persistent store should change nothing above this class, which is why the
 * methods take an `Actor` and return plain DTOs.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced and can only see that organization's places, so there is no
 * call path that reads across the boundary — the tenant is a parameter rather
 * than something a caller may remember to filter by.
 *
 * No uniqueness rule, unlike people. Two rooms may both be called "Meeting
 * Room" and two places may share an address; nothing here is a natural key
 * except the id.
 */
@Injectable()
export class PlaceService {
  private readonly logger = new Logger(PlaceService.name);

  constructor(private readonly events: EventPublisher) {}

  /**
   * An array, which is what a placeholder wants: it reads as the list it is,
   * and its order is the order things were added.
   *
   * The cost is that every lookup is a scan. That is irrelevant at this size
   * and would be the wrong thing to optimise — the fix is a database, not a
   * cleverer structure in front of one.
   */
  private readonly places: StoredPlace[] = [];

  /** Every place in this organization, oldest first. */
  list(actor: Actor): PlaceDTO[] {
    return this.places
      .filter((place) => place.organizationId === actor.organizationId)
      .map(toDto);
  }

  /**
   * One place, or a 404.
   *
   * A place in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  get(actor: Actor, id: string): PlaceDTO {
    return toDto(this.stored(actor, id));
  }

  /** Records a new place. The id is generated here, never accepted. */
  async create(actor: Actor, input: CreatePlaceDTO): Promise<PlaceDTO> {
    const place: StoredPlace = {
      id: randomUUID(),
      organizationId: actor.organizationId,
      ...input,
    };

    this.places.push(place);

    await this.announce(PLACE_CREATED, 'aether:ResourceCreated', place, actor);

    return toDto(place);
  }

  /**
   * Tells the rest of aether-zone what happened to a place.
   *
   * Published *after* the store, so nothing can hear about a place that is not
   * there. The reverse gap is real and accepted: the store can succeed and the
   * publish fail, leaving a place nobody downstream knows about. That is
   * logged loudly rather than swallowed, and the record is still here to
   * replay from.
   *
   * A failure here does not fail the request. The place *was* recorded, and
   * answering 500 would invite a retry that creates a second one.
   */
  private async announce(
    routingKey: string,
    type: AetherEventType,
    place: StoredPlace,
    actor: Actor,
  ): Promise<void> {
    const event: AetherEvent<PlaceJsonLD> = {
      /*
       * Overwritten before it leaves — `EventPublisher` spreads its transport
       * envelope last, so the id on the wire is the message's. Set anyway
       * because the type requires it.
       */
      id: randomUUID(),
      type,
      source: AETHER_SOURCE,
      time: new Date().toISOString(),
      subject: placeIri(place.id),
      /*
       * Which tenant the place belongs to. Not decoration: arachni refuses to
       * write a node it cannot scope, mneme refuses to index text it cannot
       * file, and akouo's `organizationId` column is NOT NULL — an event
       * without this is accepted by the schema and dropped by everyone.
       */
      organizationId: place.organizationId,
      // A delete carries no `data`: there is nothing left to describe, and
      // organon's schema has no field for it on that variant.
      ...(type === 'aether:ResourceDeleted'
        ? {}
        : { data: toPlaceDocument(toDto(place)) }),
      actor: { id: actor.id, type: 'User' },
    } as AetherEvent<PlaceJsonLD>;

    try {
      await this.events.publish(routingKey, event);
    } catch (cause) {
      this.logger.error(
        `Place ${event.subject} changed but "${routingKey}" could not be published`,
        cause,
      );
    }
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * A partial update rather than a replace, matching `updatePlaceSchema`: a
   * caller correcting a longitude should not have to send the description
   * back, and a replace would silently clear anything they left out.
   */
  async update(
    actor: Actor,
    id: string,
    changes: UpdatePlaceDTO,
  ): Promise<PlaceDTO> {
    const existing = this.stored(actor, id);
    const updated: StoredPlace = { ...existing, ...changes };

    this.places[this.places.indexOf(existing)] = updated;

    /*
     * The whole document, not the changed fields. An Aether event describes
     * the resource as it now is: a consumer holding a copy replaces it, and
     * one hearing about this place for the first time still ends up with
     * everything.
     */
    await this.announce(PLACE_UPDATED, 'aether:ResourceUpdated', updated, actor);

    return toDto(updated);
  }

  /** Forgets a place. Deleting one that is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const place = this.stored(actor, id);

    this.places.splice(this.places.indexOf(place), 1);

    await this.announce(PLACE_DELETED, 'aether:ResourceDeleted', place, actor);
  }

  /** The stored record, including the tenant the DTO does not carry. */
  private stored(actor: Actor, id: string): StoredPlace {
    const place = this.places.find(
      (candidate) =>
        candidate.id === id &&
        candidate.organizationId === actor.organizationId,
    );

    if (!place) {
      throw new NotFoundException(`No place with id ${id}.`);
    }

    return place;
  }
}

/**
 * A place as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `PlaceDTO`. It is in the URL of
 * every route that can reach the record, so returning it in the body would
 * restate what the caller already said — and a client that read it from the
 * body might start sending it *as* the body.
 */
type StoredPlace = PlaceDTO & { organizationId: string };

const toDto = ({
  organizationId: _organizationId,
  ...place
}: StoredPlace): PlaceDTO => place;
