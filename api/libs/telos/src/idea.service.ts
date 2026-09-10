import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  CreateIdeaDTO,
  IdeaDTO,
  UpdateIdeaDTO,
} from '@aether/contract';
import type { Actor } from '@aether-zone/organon';

/**
 * The ideas telos is holding.
 *
 * **In memory, deliberately and temporarily** — a placeholder for a
 * repository, not a cache in front of one. Everything is lost on restart and
 * nothing is shared between instances; swapping it for a persistent store
 * should change nothing above this class, which is why the methods take an
 * `Actor` and return plain DTOs.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced and can only see that organization's ideas, so there is no
 * call path that reads across the boundary.
 *
 * Nothing here announces itself on the exchange, unlike people, places and
 * calendar entries. Nothing consumes an idea, and announcing to an empty room
 * is wiring to maintain for no reader; when something does, this class is the
 * seam and `PlaceService` shows the shape.
 */
@Injectable()
export class IdeaService {
  /**
   * An array, which is what a placeholder wants: it reads as the list it is,
   * and its order is the order things were captured. Every lookup is a scan,
   * which is irrelevant at this size and the wrong thing to optimise — the fix
   * is a database, not a cleverer structure in front of one.
   */
  private readonly ideas: StoredIdea[] = [];

  /** Every idea in this organization, oldest first. */
  list(actor: Actor): IdeaRecord[] {
    return this.ideas
      .filter((idea) => idea.organizationId === actor.organizationId)
      .map(toDto);
  }

  /**
   * One idea, or a 404.
   *
   * An idea in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  get(actor: Actor, id: string): IdeaRecord {
    return toDto(this.stored(actor, id));
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
  create(actor: Actor, input: CreateIdeaDTO): IdeaRecord {
    const now = new Date().toISOString();

    const idea: StoredIdea = {
      id: randomUUID(),
      organizationId: actor.organizationId,
      status: 'CAPTURED',
      ...input,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
    };

    this.ideas.push(idea);

    return toDto(idea);
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * A partial update rather than a replace, matching `updateIdeaSchema`: a
   * caller promoting an idea should not have to send the description back, and
   * a replace would silently clear anything they left out.
   */
  update(actor: Actor, id: string, changes: UpdateIdeaDTO): IdeaRecord {
    const existing = this.stored(actor, id);

    const updated: StoredIdea = {
      ...existing,
      ...changes,
      /*
       * For both of these, `undefined` leaves the field alone and `null`
       * removes it — spreading `changes` would otherwise write the `null`
       * straight through as a value the stored shape does not have.
       */
      description:
        changes.description === undefined
          ? existing.description
          : (changes.description ?? undefined),
      priority:
        changes.priority === undefined
          ? existing.priority
          : (changes.priority ?? undefined),
      updatedAt: new Date().toISOString(),
    };

    this.ideas[this.ideas.indexOf(existing)] = updated;

    return toDto(updated);
  }

  /** Forgets an idea. Deleting one that is not here is a 404, not a shrug. */
  remove(actor: Actor, id: string): void {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const idea = this.stored(actor, id);

    this.ideas.splice(this.ideas.indexOf(idea), 1);
  }

  private stored(actor: Actor, id: string): StoredIdea {
    const idea = this.ideas.find(
      (candidate) =>
        candidate.id === id &&
        candidate.organizationId === actor.organizationId,
    );

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
type StoredIdea = IdeaRecord & { organizationId: string };

const toDto = ({
  organizationId: _organizationId,
  ...idea
}: StoredIdea): IdeaRecord => idea;
