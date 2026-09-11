import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { announce } from '@aether/events';
import {
  RESOURCE_CREATED,
  RESOURCE_DELETED,
  RESOURCE_UPDATED,
} from '@aether/contract';
import type {
  CreateResourceDTO,
  ResourceDTO,
  UpdateResourceDTO,
} from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEventType,
} from '@aether-zone/organon';

import { ResourceEntity } from './resource.entity';
import { resourceIri, toResourceDocument } from './resource.json-ld';

/**
 * The resources tekmerion is holding.
 *
 * **Backed by SQLite**, through the repository `TekmerionModule` asks for with
 * `TypeOrmModule.forFeature`. This was the service that needed it most: a
 * resource can carry a whole transcript, and an array of those in a process's
 * heap was a memory ceiling rather than a slow query.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced and can only see that organization's resources, so there is
 * no call path that reads across the boundary.
 *
 * **Announces every change on the exchange.** These carry the most for any
 * event in aether — a resource is what mneme indexes and what arachni relates
 * everything else to. A publish that fails is logged and swallowed: the record
 * has already changed, and failing the request would tell the caller their
 * write did not happen when it did.
 */
@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(
    @InjectRepository(ResourceEntity)
    private readonly resources: Repository<ResourceEntity>,
    private readonly events: EventPublisher,
  ) {}

  /** Every resource in this organization, oldest first. */
  async list(actor: Actor): Promise<ResourceDTO[]> {
    const rows = await this.resources.find({
      where: { organizationId: actor.organizationId },
      // Newest first: a resource list is an inbox, and the console reads it
      // that way. Ordering here saves sending the whole table to be sorted.
      order: { createdAt: 'DESC' },
    });

    return rows.map(toDto);
  }

  /**
   * One resource, or a 404.
   *
   * A resource in another organization gives the same 404 as one that does
   * not exist. Telling the two apart would answer "does this id exist
   * somewhere" for anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<ResourceDTO> {
    return toDto(await this.stored(actor, id));
  }

  /**
   * The one a given system already gave us, if any.
   *
   * Matched on `source.type` and `externalId` together. `externalId` is only
   * unique within a source — two systems will both number their records from
   * 1 — so either alone is a question with no answer.
   *
   * `source.id` is deliberately not part of the match. It says *which*
   * mailbox or workspace, and a caller asking "have I already filed gmail
   * message 4471" usually knows the message id without knowing which of
   * several accounts it came through.
   */
  async findExternal(
    actor: Actor,
    sourceType: string,
    externalId: string,
  ): Promise<ResourceDTO | undefined> {
    /*
     * `externalId` is a column and `source.type` is inside a JSON blob, so
     * this narrows on the column first and reads the blob in memory. The
     * index on (organizationId, externalId) is what makes that cheap: an
     * external id is near-unique, so the second step almost always sees one
     * row.
     */
    const candidates = await this.resources.findBy({
      organizationId: actor.organizationId,
      externalId,
    });

    const found = candidates.find(
      (resource) => resource.source?.type === sourceType,
    );

    return found && toDto(found);
  }

  /** Files one. */
  async create(actor: Actor, input: CreateResourceDTO): Promise<ResourceDTO> {
    const now = new Date().toISOString();

    const resource = await this.resources.save(
      this.resources.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        type: input.type,
        title: input.title ?? null,
        description: input.description ?? null,
        content: input.content ?? null,
        source: input.source ?? null,
        externalId: input.externalId ?? null,
        url: input.url ?? null,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.announce(
      RESOURCE_CREATED,
      'aether:ResourceCreated',
      resource,
      actor,
    );

    return toDto(resource);
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * A partial update rather than a replace, matching `updateResourceSchema`:
   * a caller retitling a resource should not have to send a whole transcript
   * back with it, and a replace would silently clear anything they left out.
   */
  async update(
    actor: Actor,
    id: string,
    changes: UpdateResourceDTO,
  ): Promise<ResourceDTO> {
    const existing = await this.stored(actor, id);

    const updated = await this.resources.save({
      ...existing,
      ...changes,
      /*
       * `undefined` leaves each of these alone and `null` removes it. The
       * spread above cannot be trusted to do this: an absent optional key is
       * missing from `changes` and so leaves the value alone by accident, but
       * a `null` would be written straight through — which is right here and
       * was wrong when this was an array. Being explicit keeps the rule
       * readable either way.
       */
      title: merge(existing.title, changes.title),
      description: merge(existing.description, changes.description),
      content: merge(existing.content, changes.content),
      source: merge(existing.source, changes.source),
      externalId: merge(existing.externalId, changes.externalId),
      url: merge(existing.url, changes.url),
      /*
       * Replaced whole rather than merged key by key. A partial merge would
       * make it impossible to remove a single key, and a caller who sends
       * `metadata` has told us what it should be — guessing that they meant
       * "add these to whatever is there" is the sort of helpfulness that
       * leaves a stale key behind forever.
       */
      metadata: merge(existing.metadata, changes.metadata),
      updatedAt: new Date().toISOString(),
    });

    await this.announce(
      RESOURCE_UPDATED,
      'aether:ResourceUpdated',
      updated,
      actor,
    );

    return toDto(updated);
  }

  /** Forgets one. Deleting one that is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const resource = await this.stored(actor, id);

    await this.resources.remove({ ...resource });

    await this.announce(
      RESOURCE_DELETED,
      'aether:ResourceDeleted',
      resource,
      actor,
    );
  }

  private announce(
    routingKey: string,
    type: AetherEventType,
    resource: StoredResource,
    actor: Actor,
  ): Promise<void> {
    return announce(this.events, this.logger, {
      routingKey,
      type,
      subject: resourceIri(resource.id),
      organizationId: resource.organizationId,
      actor,
      document: toResourceDocument(toDto(resource)),
    });
  }

  private async stored(actor: Actor, id: string): Promise<ResourceEntity> {
    // The tenant is part of the lookup, not a check after it.
    const resource = await this.resources.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!resource) {
      throw new NotFoundException(`No resource with id ${id}.`);
    }

    return resource;
  }
}

/**
 * A resource as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `ResourceDTO`. It is in the URL of
 * every route that can reach the record, so returning it would restate what
 * the caller already said.
 */
/**
 * `undefined` keeps what is there; `null` clears it.
 *
 * Simpler than it was in memory, and the reason is worth noting: the store's
 * own vocabulary for "not stated" *is* `null`, so a clearing change no longer
 * has to be translated into an absent key on the way in. It only has to be
 * translated back out again, which `toDto` does.
 */
const merge = <T>(current: T | null, change: T | null | undefined): T | null =>
  change === undefined ? current : change;

type StoredResource = ResourceEntity;

/**
 * A row as the api answers with it.
 *
 * Every `null` becomes an absent key. SQL has no "not stated" and the contract
 * has no `null`, so this is where the two vocabularies are reconciled — in one
 * place, rather than at each of the nine fields that can be missing.
 */
const toDto = (resource: ResourceEntity): ResourceDTO => ({
  id: resource.id,
  type: resource.type,
  ...(resource.title === null ? {} : { title: resource.title }),
  ...(resource.description === null
    ? {}
    : { description: resource.description }),
  ...(resource.content === null ? {} : { content: resource.content }),
  ...(resource.source === null ? {} : { source: resource.source }),
  ...(resource.externalId === null ? {} : { externalId: resource.externalId }),
  ...(resource.url === null ? {} : { url: resource.url }),
  ...(resource.metadata === null ? {} : { metadata: resource.metadata }),
  createdAt: resource.createdAt,
  updatedAt: resource.updatedAt,
});
