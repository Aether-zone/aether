import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { GOAL_CREATED, GOAL_DELETED, GOAL_UPDATED } from '@aether/contract';
import type { CreateGoalDTO, GoalDTO, UpdateGoalDTO } from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEventType,
} from '@aether-zone/organon';

import { announce } from '@aether/events';

import { GoalEntity } from './goal.entity';
import { goalIri, toGoalDocument } from './telos.json-ld';

import { IdeaService } from './idea.service';

/**
 * The goals telos is holding.
 *
 * **In memory, deliberately and temporarily** — a placeholder for a
 * repository, not a cache in front of one. Swapping it for a persistent store
 * should change nothing above this class.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced and can only see that organization's goals.
 */
@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);
  /*
   * One direction only. A goal validates the ideas it names, so it needs the
   * ideas; an idea's `inspired` is read back out of the goals, and doing that
   * here rather than in `IdeaService` is what keeps these two from depending
   * on each other. `IdeaController` composes the other end.
   */
  constructor(
    @InjectRepository(GoalEntity)
    private readonly goals: Repository<GoalEntity>,
    private readonly ideas: IdeaService,
    private readonly events: EventPublisher,
  ) {}

  /**
   * The goals in this organization that name a given idea.
   *
   * This is `IdeaDTO.inspired`, computed rather than stored. Keeping a copy on
   * the idea as well would give two records of one fact, and nothing could say
   * which was right when they disagreed.
   */
  async idsInspiredBy(actor: Actor, ideaId: string): Promise<string[]> {
    /*
     * `inspiredBy` is a comma-joined column, so the match happens in memory
     * over this tenant's goals rather than in SQL. A `LIKE '%id%'` would push
     * it into the query and match a goal whose *other* id merely contained
     * this one as a substring — wrong for the sake of looking clever. When
     * there are enough goals for that to matter, the fix is a join table.
     */
    const rows = await this.goals.find({
      where: { organizationId: actor.organizationId },
      order: { createdAt: 'ASC' },
    });

    return rows
      .filter((goal) => goal.inspiredBy.includes(ideaId))
      .map((goal) => goal.id);
  }

  /**
   * Fails unless every idea named exists in this organization.
   *
   * A 404 rather than dropping the unknown ones: a caller who said an idea
   * inspired this goal and got a goal inspired by nothing has been told
   * nothing, and would find out much later.
   */
  private async requireIdeas(actor: Actor, ideaIds: string[]): Promise<void> {
    // `get` rejects for one this organization does not have, which is the
    // answer: the caller named something that is not here. Awaited in turn
    // rather than in parallel, so the first missing id is the one reported —
    // `Promise.all` would surface whichever query happened to finish first.
    for (const ideaId of ideaIds) {
      await this.ideas.get(actor, ideaId);
    }
  }

  /** Every goal in this organization, oldest first. */
  async list(actor: Actor): Promise<GoalRecord[]> {
    const rows = await this.goals.find({
      where: { organizationId: actor.organizationId },
      order: { createdAt: 'ASC' },
    });

    return rows.map(toDto);
  }

  /**
   * One goal, or a 404.
   *
   * A goal in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<GoalRecord> {
    return toDto(await this.stored(actor, id));
  }

  /**
   * Sets one.
   *
   * Every goal starts `ACTIVE`: setting a goal you have already abandoned is
   * not a thing anyone does, and a caller able to choose could record one
   * completed before any work existed.
   */
  async create(actor: Actor, input: CreateGoalDTO): Promise<GoalRecord> {
    await this.requireIdeas(actor, input.inspiredBy);

    const now = new Date().toISOString();

    const goal = await this.goals.save(
      this.goals.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        /*
         * `ACTIVE`, not `PLANNED`. Setting a goal is committing to it — you are
         * aiming at it from the moment you write it down, and starting every one
         * as planned would mean a second action before anything counts as being
         * worked on. `PLANNED` is for a goal deliberately parked, which is a
         * thing someone does on purpose rather than a state to default into.
         */
        status: 'ACTIVE',
        title: input.title,
        description: input.description ?? null,
        startsAt: input.startsAt ?? null,
        targetAt: input.targetAt ?? null,
        priority: input.priority ?? null,
        inspiredBy: input.inspiredBy,
        involves: input.involves,
        sources: input.sources,
        scheduled: input.scheduled,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.announce(GOAL_CREATED, 'aether:ResourceCreated', goal, actor);

    return toDto(goal);
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * The dates are compared **here** rather than in the schema. A partial
   * update may carry one and not the other, and the second is known only once
   * the change has been merged with what is stored — so a schema doing this
   * would either reject valid changes or pass invalid ones.
   */
  async update(
    actor: Actor,
    id: string,
    changes: UpdateGoalDTO,
  ): Promise<GoalRecord> {
    const existing = await this.stored(actor, id);

    if (changes.inspiredBy) {
      await this.requireIdeas(actor, changes.inspiredBy);
    }

    const updated: GoalEntity = {
      ...existing,
      ...changes,
      /*
       * `undefined` leaves a date alone and `null` removes it — spreading
       * `changes` would otherwise write the `null` straight through as a value
       * the stored shape does not have.
       */
      startsAt: merge(existing.startsAt, changes.startsAt),
      targetAt: merge(existing.targetAt, changes.targetAt),
      priority: merge(existing.priority, changes.priority),
      updatedAt: new Date().toISOString(),
    };

    if (
      updated.startsAt &&
      updated.targetAt &&
      updated.targetAt <= updated.startsAt
    ) {
      throw new BadRequestException({
        message: 'A goal cannot be due before it starts.',
        errors: [
          {
            path: 'targetAt',
            message: 'A goal cannot be due before it starts.',
          },
        ],
      });
    }

    await this.goals.save(updated);

    await this.announce(GOAL_UPDATED, 'aether:ResourceUpdated', updated, actor);

    return toDto(updated);
  }

  /** Forgets a goal. Deleting one that is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const goal = await this.stored(actor, id);

    await this.goals.remove({ ...goal });

    await this.announce(GOAL_DELETED, 'aether:ResourceDeleted', goal, actor);
  }

  private announce(
    routingKey: string,
    type: AetherEventType,
    goal: StoredGoal,
    actor: Actor,
  ): Promise<void> {
    return announce(this.events, this.logger, {
      routingKey,
      type,
      subject: goalIri(goal.id),
      organizationId: goal.organizationId,
      actor,
      document: toGoalDocument(toDto(goal)),
    });
  }

  private async stored(actor: Actor, id: string): Promise<GoalEntity> {
    // The tenant is part of the lookup, not a check after it.
    const goal = await this.goals.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!goal) {
      throw new NotFoundException(`No goal with id ${id}.`);
    }

    return goal;
  }
}

/** `undefined` keeps what is there; `null` clears it. */
/** `undefined` keeps what is there; `null` clears it. */
const merge = <T>(current: T | null, change: T | null | undefined): T | null =>
  change === undefined ? current : change;

/**
 * A goal as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `GoalDTO`. It is in the URL of every
 * route that can reach the record, so returning it would restate what the
 * caller already said.
 */
/**
 * A goal as this service deals in it: everything but `realizedBy`.
 *
 * Both are read from the projects naming this goal, which only
 * `ProjectService` and `TaskService` know — so they are composed at the
 * controller rather than invented here. Leaving them off the type is what
 * stops this service quietly returning an empty list and a `0` that read as
 * "nothing is being done about it".
 */
export type GoalRecord = Omit<GoalDTO, 'realizedBy' | 'progress'>;

type StoredGoal = GoalEntity;

/** A row as the api answers with it: tenant dropped, `null` becomes absent. */
const toDto = (goal: GoalEntity): GoalRecord => ({
  id: goal.id,
  title: goal.title,
  ...(goal.description === null ? {} : { description: goal.description }),
  status: goal.status,
  ...(goal.startsAt === null ? {} : { startsAt: goal.startsAt }),
  ...(goal.targetAt === null ? {} : { targetAt: goal.targetAt }),
  ...(goal.priority === null ? {} : { priority: goal.priority }),
  inspiredBy: goal.inspiredBy,
  involves: goal.involves,
  sources: goal.sources,
  scheduled: goal.scheduled,
  createdAt: goal.createdAt,
  updatedAt: goal.updatedAt,
});
