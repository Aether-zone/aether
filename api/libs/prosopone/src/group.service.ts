import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { announce } from '@aether/events';
import { GROUP_CREATED, GROUP_DELETED, GROUP_UPDATED } from '@aether/contract';
import type {
  CreateGroupDTO,
  GroupDTO,
  UpdateGroupDTO,
} from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEventType,
} from '@aether-zone/organon';

import { GroupEntity } from './group.entity';
import { groupIri, toGroupDocument } from './group.json-ld';

/**
 * The groups prosopone is holding.
 *
 * A client, a community, the family — the way a person is somebody written
 * down. The tenant is the `Actor`'s `organizationId`, which scopes every
 * method here and never appears in what they return; it is a different thing
 * from the group, which is why the group is not called an group.
 *
 * Backed by SQLite, through the repository `ProsoponeModule` asks for with
 * `TypeOrmModule.forFeature`.
 *
 * **Announces every change on the exchange.** A publish that fails is logged
 * and swallowed: the record has already changed, and failing the request would
 * tell the caller their write did not happen when it did.
 */
@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    private readonly events: EventPublisher,
  ) {}

  /** Every group in this tenant, by name. */
  async list(actor: Actor): Promise<GroupDTO[]> {
    const rows = await this.groups.find({
      where: { organizationId: actor.organizationId },
      // By name rather than by age: a list of groups is scanned for one the
      // reader already has in mind, and alphabetical is how you find it.
      order: { name: 'ASC' },
    });

    return rows.map(toDto);
  }

  /**
   * One group, or a 404.
   *
   * One in another tenant gives the same 404 as one that does not exist.
   * Telling the two apart would answer "does this id exist somewhere" for
   * anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<GroupDTO> {
    return toDto(await this.stored(actor, id));
  }

  /** Records one. The id is generated here, never accepted. */
  async create(actor: Actor, input: CreateGroupDTO): Promise<GroupDTO> {
    const now = new Date().toISOString();

    const group = await this.groups.save(
      this.groups.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        name: input.name,
        description: input.description ?? null,
        type: input.type ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.announce(GROUP_CREATED, 'aether:ResourceCreated', group, actor);

    return toDto(group);
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * A partial update rather than a replace: a caller correcting a name should
   * not have to send the description back, and a replace would silently clear
   * anything they left out.
   */
  async update(
    actor: Actor,
    id: string,
    changes: UpdateGroupDTO,
  ): Promise<GroupDTO> {
    const existing = await this.stored(actor, id);

    const updated = await this.groups.save({
      ...existing,
      ...changes,
      /*
       * `undefined` leaves each of these alone and `null` removes it. The
       * spread cannot be trusted with the distinction: an absent optional key
       * is missing from `changes` and so leaves the value alone by accident,
       * where a `null` is written straight through — right here, and wrong the
       * moment somebody changes how the store represents "not stated".
       */
      description: merge(existing.description, changes.description),
      type: merge(existing.type, changes.type),
      updatedAt: new Date().toISOString(),
    });

    /*
     * The whole document, not the changed fields. An Aether event describes
     * the resource as it now is: a consumer holding a copy replaces it, and
     * one hearing about this group for the first time still ends up with
     * everything.
     */
    await this.announce(
      GROUP_UPDATED,
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
    const group = await this.stored(actor, id);

    await this.groups.remove({ ...group });

    await this.announce(GROUP_DELETED, 'aether:ResourceDeleted', group, actor);
  }

  private announce(
    routingKey: string,
    type: AetherEventType,
    group: GroupEntity,
    actor: Actor,
  ): Promise<void> {
    return announce(this.events, this.logger, {
      routingKey,
      type,
      subject: groupIri(group.id),
      // The *tenant*, which is what every consumer scopes by — not the id of
      // the group being described, which is in the subject.
      organizationId: group.organizationId,
      actor,
      document: toGroupDocument(toDto(group)),
    });
  }

  private async stored(actor: Actor, id: string): Promise<GroupEntity> {
    // The tenant is part of the lookup, not a check after it: asked this way
    // the query cannot return another tenant's row at all.
    const group = await this.groups.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!group) {
      throw new NotFoundException(`No group with id ${id}.`);
    }

    return group;
  }
}

/** `undefined` keeps what is there; `null` clears it. */
const merge = <T>(current: T | null, change: T | null | undefined): T | null =>
  change === undefined ? current : change;

/**
 * A row as the api answers with it.
 *
 * The tenant is dropped and `null` becomes absent — the two places a store and
 * a DTO always disagree, since SQL has no "not stated" and the contract has no
 * `null`.
 */
const toDto = (group: GroupEntity): GroupDTO => ({
  id: group.id,
  name: group.name,
  ...(group.description === null ? {} : { description: group.description }),
  ...(group.type === null ? {} : { type: group.type }),
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});
