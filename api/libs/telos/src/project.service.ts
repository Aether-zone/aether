import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  CreateProjectDTO,
  ProjectDTO,
  UpdateProjectDTO,
} from '@aether/contract';
import type { Actor } from '@aether-zone/organon';

/**
 * The projects telos is holding.
 *
 * **In memory, deliberately and temporarily** — a placeholder for a
 * repository, not a cache in front of one. Swapping it for a persistent store
 * should change nothing above this class.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced and can only see that organization's projects.
 */
@Injectable()
export class ProjectService {
  private readonly projects: StoredProject[] = [];

  /** Every project in this organization, oldest first. */
  list(actor: Actor): ProjectDTO[] {
    return this.projects
      .filter((project) => project.organizationId === actor.organizationId)
      .map(toDto);
  }

  /**
   * One project, or a 404.
   *
   * A project in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  get(actor: Actor, id: string): ProjectDTO {
    return toDto(this.stored(actor, id));
  }

  /**
   * Starts one.
   *
   * Every project begins `PLANNED` — writing one down is planning it, and a
   * caller able to choose could record work as completed before any of it
   * existed. This is where a project differs from a goal, which begins
   * `ACTIVE` because you are aiming at it the moment you set it.
   */
  create(actor: Actor, input: CreateProjectDTO): ProjectDTO {
    const now = new Date().toISOString();

    const project: StoredProject = {
      id: randomUUID(),
      organizationId: actor.organizationId,
      status: 'PLANNED',
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.projects.push(project);

    return toDto(project);
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * The dates are compared **here** rather than in the schema. A partial
   * update may carry one and not the other, and the second is known only once
   * the change has been merged with what is stored — so a schema doing this
   * would either reject valid changes or pass invalid ones.
   */
  update(actor: Actor, id: string, changes: UpdateProjectDTO): ProjectDTO {
    const existing = this.stored(actor, id);

    const updated: StoredProject = {
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
        message: 'A project cannot be due before it starts.',
        errors: [
          {
            path: 'targetAt',
            message: 'A project cannot be due before it starts.',
          },
        ],
      });
    }

    this.projects[this.projects.indexOf(existing)] = updated;

    return toDto(updated);
  }

  /** Forgets a project. Deleting one that is not here is a 404, not a shrug. */
  remove(actor: Actor, id: string): void {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const project = this.stored(actor, id);

    this.projects.splice(this.projects.indexOf(project), 1);
  }

  private stored(actor: Actor, id: string): StoredProject {
    const project = this.projects.find(
      (candidate) =>
        candidate.id === id &&
        candidate.organizationId === actor.organizationId,
    );

    if (!project) {
      throw new NotFoundException(`No project with id ${id}.`);
    }

    return project;
  }
}

/** `undefined` keeps what is there; `null` clears it. */
const merge = (
  current: string | undefined,
  change: string | null | undefined,
): string | undefined => (change === undefined ? current : (change ?? undefined));

/**
 * A project as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `ProjectDTO`. It is in the URL of every
 * route that can reach the record, so returning it would restate what the
 * caller already said.
 */
type StoredProject = ProjectDTO & { organizationId: string };

const toDto = ({
  organizationId: _organizationId,
  ...project
}: StoredProject): ProjectDTO => project;
