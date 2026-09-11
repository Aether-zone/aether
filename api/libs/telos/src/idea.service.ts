import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { IDEA_CREATED, IDEA_DELETED, IDEA_UPDATED } from '@aether/contract';
import type { CreateIdeaDTO, IdeaDTO, UpdateIdeaDTO } from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEventType,
} from '@aether-zone/organon';

import { announce } from '@aether/events';

import { IdeaEntity } from './idea.entity';
import { ideaIri, toIdeaDocument } from './telos.json-ld';

/**
 * The ideas telos is holding.
 *
 * **Backed by SQLite**, through the repository `TelosModule` asks for with
 * `TypeOrmModule.forFeature`.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced and can only see that organization's ideas, so there is no
 * call path that reads across the boundary.
 *
 * **Announces every change on the exchange**, as people, places and calendar
 * entries do. A publish that fails is logged and swallowed: the record has
 * already changed, and failing the request would tell the caller their write
 * did not happen when it did.
 */
@Injectable()
export class IdeaService {
  private readonly logger = new Logger(IdeaService.name);

  constructor(
    @InjectRepository(IdeaEntity)
    private readonly ideas: Repository<IdeaEntity>,
    private readonly events: EventPublisher,
  ) {}

  /** Every idea in this organization, oldest first. */
  async list(actor: Actor): Promise<IdeaRecord[]> {
    const rows = await this.ideas.find({
      where: { organizationId: actor.organizationId },
      order: { createdAt: 'ASC' },
    });

    return rows.map(toDto);
  }

  /**
   * One idea, or a 404.
   *
   * An idea in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<IdeaRecord> {
    return toDto(await this.stored(actor, id));
  }

  /**
   * Writes one down.
   *
   * `createdBy` comes from the actor and never from the body — the contract
   * omits it from the create shape for the same reason. A caller that could
   * set it could file an idea under somebody else's name.
   *
   * Every idea starts `CAPTURED`. Letting a caller choose would make "written
   * down just now" and "already decided against" indistinguishable at the
   * moment of capture.
   */
  async create(actor: Actor, input: CreateIdeaDTO): Promise<IdeaRecord> {
    const now = new Date().toISOString();

    const idea = await this.ideas.save(
      this.ideas.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        status: 'CAPTURED',
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? null,
        involves: input.involves,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.id,
      }),
    );

    await this.announce(IDEA_CREATED, 'aether:ResourceCreated', idea, actor);

    return toDto(idea);
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * A partial update rather than a replace, matching `updateIdeaSchema`: a
   * caller promoting an idea should not have to send the description back, and
   * a replace would silently clear anything they left out.
   */
  async update(
    actor: Actor,
    id: string,
    changes: UpdateIdeaDTO,
  ): Promise<IdeaRecord> {
    const existing = await this.stored(actor, id);

    const updated = await this.ideas.save({
      ...existing,
      ...changes,
      /*
       * For both of these, `undefined` leaves the field alone and `null`
       * removes it — spreading `changes` would otherwise write the `null`
       * straight through as a value the stored shape does not have.
       */
      description: merge(existing.description, changes.description),
      priority: merge(existing.priority, changes.priority),
      updatedAt: new Date().toISOString(),
    });

    await this.announce(IDEA_UPDATED, 'aether:ResourceUpdated', updated, actor);

    return toDto(updated);
  }

  /** Forgets an idea. Deleting one that is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const idea = await this.stored(actor, id);

    await this.ideas.remove({ ...idea });

    await this.announce(IDEA_DELETED, 'aether:ResourceDeleted', idea, actor);
  }

  private announce(
    routingKey: string,
    type: AetherEventType,
    idea: StoredIdea,
    actor: Actor,
  ): Promise<void> {
    return announce(this.events, this.logger, {
      routingKey,
      type,
      subject: ideaIri(idea.id),
      organizationId: idea.organizationId,
      actor,
      document: toIdeaDocument(toDto(idea)),
    });
  }

  private async stored(actor: Actor, id: string): Promise<IdeaEntity> {
    // The tenant is part of the lookup, not a check after it.
    const idea = await this.ideas.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!idea) {
      throw new NotFoundException(`No idea with id ${id}.`);
    }

    return idea;
  }
}

/**
 * An idea as this service deals in it: everything but `inspired`.
 *
 * That field is the goals naming this idea, which only `GoalService` knows —
 * so it is composed at the controller rather than invented here. Leaving it
 * off the type is what stops this service quietly returning an empty list that
 * reads as "nothing came of it".
 */
export type IdeaRecord = Omit<IdeaDTO, 'inspired'>;

/**
 * An idea as held here: the record plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `IdeaDTO`. It is in the URL of every
 * route that can reach the record, so returning it in the body would restate
 * what the caller already said — and a client that read it from the body might
 * start sending it *as* the body.
 */
type StoredIdea = IdeaEntity;

/** `undefined` keeps what is there; `null` clears it. */
const merge = <T>(current: T | null, change: T | null | undefined): T | null =>
  change === undefined ? current : change;

/** A row as the api answers with it: tenant dropped, `null` becomes absent. */
const toDto = (idea: IdeaEntity): IdeaRecord => ({
  id: idea.id,
  title: idea.title,
  ...(idea.description === null ? {} : { description: idea.description }),
  status: idea.status,
  ...(idea.priority === null ? {} : { priority: idea.priority }),
  involves: idea.involves,
  createdAt: idea.createdAt,
  updatedAt: idea.updatedAt,
  createdBy: idea.createdBy,
});
