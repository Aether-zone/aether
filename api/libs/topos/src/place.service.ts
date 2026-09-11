import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

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

import { PlaceEntity } from './place.entity';
import { placeIri, toPlaceDocument, type PlaceJsonLD } from './place.json-ld';

/**
 * The places topos knows about.
 *
 * **Backed by SQLite**, through the repository `ToposModule` asks for with
 * `TypeOrmModule.forFeature`. It used to hold an array; nothing above this
 * class changed when it stopped, which is what the `Actor`-in, DTO-out shape
 * was for.
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

  constructor(
    @InjectRepository(PlaceEntity)
    private readonly places: Repository<PlaceEntity>,
    private readonly events: EventPublisher,
  ) {}

  /**
   * Every place in this organization, oldest first.
   *
   * Ordered by when the row was written, then by id to break a tie. A uuid
   * primary key carries no order of its own, so without `recordedAt` the list
   * would reshuffle between reads and an edit would move a row.
   */
  async list(actor: Actor): Promise<PlaceDTO[]> {
    const rows = await this.places.find({
      where: { organizationId: actor.organizationId },
      order: { recordedAt: 'ASC', id: 'ASC' },
    });

    return rows.map(toDto);
  }

  /**
   * One place, or a 404.
   *
   * A place in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<PlaceDTO> {
    return toDto(await this.stored(actor, id));
  }

  /** Records a new place. The id is generated here, never accepted. */
  async create(actor: Actor, input: CreatePlaceDTO): Promise<PlaceDTO> {
    const place = await this.places.save(
      this.places.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        ...input,
        description: input.description ?? null,
        recordedAt: new Date().toISOString(),
      }),
    );

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
    const existing = await this.stored(actor, id);
    const updated = await this.places.save({ ...existing, ...changes });

    /*
     * The whole document, not the changed fields. An Aether event describes
     * the resource as it now is: a consumer holding a copy replaces it, and
     * one hearing about this place for the first time still ends up with
     * everything.
     */
    await this.announce(
      PLACE_UPDATED,
      'aether:ResourceUpdated',
      updated,
      actor,
    );

    return toDto(updated);
  }

  /** Forgets a place. Deleting one that is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const place = await this.stored(actor, id);

    await this.places.remove({ ...place });

    await this.announce(PLACE_DELETED, 'aether:ResourceDeleted', place, actor);
  }

  /** The stored record, including the tenant the DTO does not carry. */
  private async stored(actor: Actor, id: string): Promise<PlaceEntity> {
    /*
     * The tenant is part of the lookup, not a check after it. A `findOneBy`
     * on the id alone followed by an `if` would be one forgotten `if` away
     * from reading across the boundary; asked this way the query cannot
     * return another organization's row at all.
     */
    const place = await this.places.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

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
type StoredPlace = PlaceEntity;

/**
 * A row as the api answers with it.
 *
 * The tenant is dropped, and `null` becomes absent. Those are the two places
 * a store and a DTO always disagree: SQL has no "not stated", and the contract
 * has no `null`.
 */
const toDto = (place: PlaceEntity): PlaceDTO => ({
  id: place.id,
  name: place.name,
  ...(place.description === null ? {} : { description: place.description }),
  address: place.address,
  lat: place.lat,
  lng: place.lng,
});
