import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import {
  PROJECT_CREATED,
  PROJECT_DELETED,
  PROJECT_UPDATED,
} from '@aether/contract';
import type {
  CreateProjectDTO,
  ProjectDTO,
  UpdateProjectDTO,
} from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEventType,
} from '@aether-zone/organon';

import { announce } from '@aether/events';

import { ProjectEntity } from './project.entity';
import { projectIri, toProjectDocument } from './telos.json-ld';

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
  private readonly logger = new Logger(ProjectService.name);
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    private readonly events: EventPublisher,
  ) {}

  /**
   * The ids of the projects pursuing a goal, oldest first.
   *
   * How a goal answers "what is being done about me" without storing the
   * answer: the link lives on the project, and this reads it from the other
   * end so the two can never disagree.
   */
  async idsPursuing(actor: Actor, goalId: string): Promise<string[]> {
    // Matched in memory for the reason `GoalService.idsInspiredBy` explains:
    // a `LIKE` over a comma-joined column matches substrings of other ids.
    const rows = await this.projects.find({
      where: { organizationId: actor.organizationId },
      order: { createdAt: 'ASC' },
    });

    return rows
      .filter((project) => project.pursues.includes(goalId))
      .map((project) => project.id);
  }

  /** Every project in this organization, oldest first. */
  async list(actor: Actor): Promise<ProjectRecord[]> {
    const rows = await this.projects.find({
      where: { organizationId: actor.organizationId },
      order: { createdAt: 'ASC' },
    });

    return rows.map(toDto);
  }

  /**
   * One project, or a 404.
   *
   * A project in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<ProjectRecord> {
    return toDto(await this.stored(actor, id));
  }

  /**
   * Starts one.
   *
   * Every project begins `PLANNED` — writing one down is planning it, and a
   * caller able to choose could record work as completed before any of it
   * existed. This is where a project differs from a goal, which begins
   * `ACTIVE` because you are aiming at it the moment you set it.
   */
  async create(actor: Actor, input: CreateProjectDTO): Promise<ProjectRecord> {
    const now = new Date().toISOString();

    const project = await this.projects.save(
      this.projects.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        status: 'PLANNED',
        title: input.title,
        description: input.description ?? null,
        startsAt: input.startsAt ?? null,
        targetAt: input.targetAt ?? null,
        priority: input.priority ?? null,
        pursues: input.pursues,
        involves: input.involves,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.announce(
      PROJECT_CREATED,
      'aether:ResourceCreated',
      project,
      actor,
    );

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
  async update(
    actor: Actor,
    id: string,
    changes: UpdateProjectDTO,
  ): Promise<ProjectRecord> {
    const existing = await this.stored(actor, id);

    const updated: ProjectEntity = {
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
        message: 'A project cannot be due before it starts.',
        errors: [
          {
            path: 'targetAt',
            message: 'A project cannot be due before it starts.',
          },
        ],
      });
    }

    await this.projects.save(updated);

    await this.announce(
      PROJECT_UPDATED,
      'aether:ResourceUpdated',
      updated,
      actor,
    );

    return toDto(updated);
  }

  /** Forgets a project. Deleting one that is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const project = await this.stored(actor, id);

    await this.projects.remove({ ...project });

    await this.announce(
      PROJECT_DELETED,
      'aether:ResourceDeleted',
      project,
      actor,
    );
  }

  private announce(
    routingKey: string,
    type: AetherEventType,
    project: StoredProject,
    actor: Actor,
  ): Promise<void> {
    return announce(this.events, this.logger, {
      routingKey,
      type,
      subject: projectIri(project.id),
      organizationId: project.organizationId,
      actor,
      document: toProjectDocument(toDto(project)),
    });
  }

  private async stored(actor: Actor, id: string): Promise<ProjectEntity> {
    // The tenant is part of the lookup, not a check after it.
    const project = await this.projects.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!project) {
      throw new NotFoundException(`No project with id ${id}.`);
    }

    return project;
  }
}

/** `undefined` keeps what is there; `null` clears it. */
/** `undefined` keeps what is there; `null` clears it. */
const merge = <T>(current: T | null, change: T | null | undefined): T | null =>
  change === undefined ? current : change;

/**
 * A project as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `ProjectDTO`. It is in the URL of every
 * route that can reach the record, so returning it would restate what the
 * caller already said.
 */
/**
 * A project as this service deals in it: everything but `tasks`.
 *
 * Those counts come from `TaskService`, so they are composed at the controller
 * rather than invented here. Leaving them off the type is what stops this
 * service quietly returning `0/0` for a project that has plenty of work in it.
 */
export type ProjectRecord = Omit<ProjectDTO, 'tasks'>;

type StoredProject = ProjectEntity;

/** A row as the api answers with it: tenant dropped, `null` becomes absent. */
const toDto = (project: ProjectEntity): ProjectRecord => ({
  id: project.id,
  title: project.title,
  ...(project.description === null ? {} : { description: project.description }),
  status: project.status,
  ...(project.startsAt === null ? {} : { startsAt: project.startsAt }),
  ...(project.targetAt === null ? {} : { targetAt: project.targetAt }),
  ...(project.priority === null ? {} : { priority: project.priority }),
  pursues: project.pursues,
  involves: project.involves,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});
