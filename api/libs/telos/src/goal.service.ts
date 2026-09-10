import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  CreateGoalDTO,
  GoalDTO,
  UpdateGoalDTO,
} from '@aether/contract';
import type { Actor } from '@aether-zone/organon';

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
  private readonly goals: StoredGoal[] = [];

  /*
   * One direction only. A goal validates the ideas it names, so it needs the
   * ideas; an idea's `inspired` is read back out of the goals, and doing that
   * here rather than in `IdeaService` is what keeps these two from depending
   * on each other. `IdeaController` composes the other end.
   */
  constructor(private readonly ideas: IdeaService) {}

  /**
   * The goals in this organization that name a given idea.
   *
   * This is `IdeaDTO.inspired`, computed rather than stored. Keeping a copy on
   * the idea as well would give two records of one fact, and nothing could say
   * which was right when they disagreed.
   */
  idsInspiredBy(actor: Actor, ideaId: string): string[] {
    return this.goals
      .filter(
        (goal) =>
          goal.organizationId === actor.organizationId &&
          goal.inspiredBy.includes(ideaId),
      )
      .map((goal) => goal.id);
  }

  /**
   * Fails unless every idea named exists in this organization.
   *
   * A 404 rather than dropping the unknown ones: a caller who said an idea
   * inspired this goal and got a goal inspired by nothing has been told
   * nothing, and would find out much later.
   */
  private requireIdeas(actor: Actor, ideaIds: string[]): void {
    for (const ideaId of ideaIds) {
      // `get` throws for one this organization does not have, which is the
      // answer: the caller named something that is not here.
      this.ideas.get(actor, ideaId);
    }
  }

  /** Every goal in this organization, oldest first. */
  list(actor: Actor): GoalDTO[] {
    return this.goals
      .filter((goal) => goal.organizationId === actor.organizationId)
      .map(toDto);
  }

  /**
   * One goal, or a 404.
   *
   * A goal in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  get(actor: Actor, id: string): GoalDTO {
    return toDto(this.stored(actor, id));
  }

  /**
   * Sets one.
   *
   * Every goal starts `ACTIVE`: setting a goal you have already abandoned is
   * not a thing anyone does, and a caller able to choose could record one
   * completed before any work existed.
   */
  create(actor: Actor, input: CreateGoalDTO): GoalDTO {
    this.requireIdeas(actor, input.inspiredBy);

    const now = new Date().toISOString();

    const goal: StoredGoal = {
      id: randomUUID(),
      organizationId: actor.organizationId,
      status: 'ACTIVE',
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.goals.push(goal);

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
  update(actor: Actor, id: string, changes: UpdateGoalDTO): GoalDTO {
    const existing = this.stored(actor, id);

    if (changes.inspiredBy) {
      this.requireIdeas(actor, changes.inspiredBy);
    }

    const updated: StoredGoal = {
      ...existing,
      ...changes,
      /*
       * `undefined` leaves a date alone and `null` removes it — spreading
       * `changes` would otherwise write the `null` straight through as a value
       * the stored shape does not have.
       */
      startsAt: merge(existing.startsAt, changes.startsAt),
      targetAt: merge(existing.targetAt, changes.targetAt),
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

    this.goals[this.goals.indexOf(existing)] = updated;

    return toDto(updated);
  }

  /** Forgets a goal. Deleting one that is not here is a 404, not a shrug. */
  remove(actor: Actor, id: string): void {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const goal = this.stored(actor, id);

    this.goals.splice(this.goals.indexOf(goal), 1);
  }

  private stored(actor: Actor, id: string): StoredGoal {
    const goal = this.goals.find(
      (candidate) =>
        candidate.id === id &&
        candidate.organizationId === actor.organizationId,
    );

    if (!goal) {
      throw new NotFoundException(`No goal with id ${id}.`);
    }

    return goal;
  }
}

/** `undefined` keeps what is there; `null` clears it. */
const merge = (
  current: string | undefined,
  change: string | null | undefined,
): string | undefined => (change === undefined ? current : (change ?? undefined));

/**
 * A goal as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `GoalDTO`. It is in the URL of every
 * route that can reach the record, so returning it would restate what the
 * caller already said.
 */
type StoredGoal = GoalDTO & { organizationId: string };

const toDto = ({
  organizationId: _organizationId,
  ...goal
}: StoredGoal): GoalDTO => goal;
