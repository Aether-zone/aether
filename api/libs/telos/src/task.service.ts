import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Not, Repository } from 'typeorm';

import {
  CLOSED_STATUSES,
  TASK_CREATED,
  TASK_DELETED,
  TASK_UPDATED,
  type CreateTaskDTO,
  type TaskDTO,
  type TaskStatus,
  type UpdateTaskDTO,
} from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEventType,
} from '@aether-zone/organon';

import { announce } from '@aether/events';

import { TaskEntity } from './task.entity';
import { ProjectService } from './project.service';
import { taskIri, toTaskDocument } from './telos.json-ld';

/**
 * The tasks telos is holding.
 *
 * **In memory, deliberately and temporarily** — a placeholder for a
 * repository, not a cache in front of one. Swapping it for a persistent store
 * should change nothing above this class.
 *
 * **Scoped to an organization.** Every method takes the actor the route's
 * guard produced and can only see that organization's tasks.
 *
 * Depends on `ProjectService` in one direction only, to refuse a task filed
 * under a project that does not exist. The reverse — which tasks a project
 * has — is read back out of these records at the controller if it is ever
 * wanted, the same arrangement `GoalService` has with ideas.
 */
@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasks: Repository<TaskEntity>,
    private readonly projects: ProjectService,
    private readonly events: EventPublisher,
  ) {}

  /** Every task in this organization, oldest first. */
  async list(actor: Actor): Promise<TaskDTO[]> {
    const rows = await this.tasks.find({
      where: { organizationId: actor.organizationId },
      order: { createdAt: 'ASC' },
    });

    return rows.map(toDto);
  }

  /**
   * One task, or a 404.
   *
   * A task in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<TaskDTO> {
    return toDto(await this.stored(actor, id));
  }

  /** The ids of the tasks filed under a project, oldest first. */
  async idsInProject(actor: Actor, projectId: string): Promise<string[]> {
    const rows = await this.tasks.find({
      where: { organizationId: actor.organizationId, projectId },
      order: { createdAt: 'ASC' },
      // Only the ids leave this method, so only the ids are read.
      select: { id: true },
    });

    return rows.map((task) => task.id);
  }

  /**
   * How many tasks a project has, and how many are finished.
   *
   * `DONE` counts as finished; `CANCELLED` does not count at all — it is work
   * that turned out not to be needed, and leaving it in the denominator would
   * make a project that dropped half its scope look permanently half-done.
   */
  async countsForProject(
    actor: Actor,
    projectId: string,
  ): Promise<{ done: number; total: number }> {
    /*
     * Two counts rather than a fetch-and-filter: the rows themselves are never
     * looked at, and a project with a thousand tasks would otherwise load a
     * thousand rows to produce two numbers.
     */
    const scope = { organizationId: actor.organizationId, projectId };

    const [total, done] = await Promise.all([
      this.tasks.count({ where: { ...scope, status: Not('CANCELLED') } }),
      this.tasks.count({ where: { ...scope, status: 'DONE' } }),
    ]);

    return { done, total };
  }

  /**
   * Writes one down.
   *
   * Every task begins `TODO`: writing one down is not doing it, and a caller
   * able to choose could record work as finished that was never started.
   */
  async create(actor: Actor, input: CreateTaskDTO): Promise<TaskDTO> {
    if (input.projectId) {
      await this.requireProject(actor, input.projectId);
    }

    const now = new Date().toISOString();

    const task = await this.tasks.save(
      this.tasks.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        status: 'TODO',
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? null,
        projectId: input.projectId ?? null,
        dueAt: input.dueAt ?? null,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.announce(TASK_CREATED, 'aether:ResourceCreated', task, actor);

    return toDto(task);
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * `closedAt` is maintained here rather than accepted from the caller, so a
   * task cannot claim to have been finished at a time its status disagrees
   * with. It is set the first time the status becomes a closed one, kept
   * across later edits to a task that is still closed, and cleared when one
   * reopens.
   */
  async update(
    actor: Actor,
    id: string,
    changes: UpdateTaskDTO,
  ): Promise<TaskDTO> {
    const existing = await this.stored(actor, id);

    if (changes.projectId) {
      await this.requireProject(actor, changes.projectId);
    }

    const status = changes.status ?? existing.status;
    const now = new Date().toISOString();

    const updated: TaskEntity = {
      ...existing,
      ...changes,
      /*
       * `undefined` leaves each of these alone and `null` removes it —
       * spreading `changes` would otherwise write the `null` straight through
       * as a value the stored shape does not have.
       */
      description: merge(existing.description, changes.description),
      priority: merge(existing.priority, changes.priority),
      projectId: merge(existing.projectId, changes.projectId),
      dueAt: merge(existing.dueAt, changes.dueAt),
      closedAt: closingTime(existing, status, now),
      updatedAt: now,
    };

    await this.tasks.save(updated);

    await this.announce(TASK_UPDATED, 'aether:ResourceUpdated', updated, actor);

    return toDto(updated);
  }

  /** Forgets a task. Deleting one that is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const task = await this.stored(actor, id);

    await this.tasks.remove({ ...task });

    await this.announce(TASK_DELETED, 'aether:ResourceDeleted', task, actor);
  }

  private announce(
    routingKey: string,
    type: AetherEventType,
    task: StoredTask,
    actor: Actor,
  ): Promise<void> {
    return announce(this.events, this.logger, {
      routingKey,
      type,
      subject: taskIri(task.id),
      organizationId: task.organizationId,
      actor,
      document: toTaskDocument(toDto(task)),
    });
  }

  /**
   * Throws unless the project is one this actor can see.
   *
   * Checked rather than stored blindly: an id pointing at nothing would show
   * up as a task filed under a project that cannot be opened, with no way to
   * tell whether the project was deleted or never existed.
   */
  private async requireProject(actor: Actor, projectId: string): Promise<void> {
    await this.projects.get(actor, projectId);
  }

  private async stored(actor: Actor, id: string): Promise<TaskEntity> {
    // The tenant is part of the lookup, not a check after it.
    const task = await this.tasks.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!task) {
      throw new NotFoundException(`No task with id ${id}.`);
    }

    return task;
  }
}

const isClosed = (status: TaskStatus): boolean =>
  CLOSED_STATUSES.includes(status);

/**
 * When a task stopped being open, given where it has just got to.
 *
 * Kept rather than recomputed while it stays closed: the moment work finished
 * is a fact about the work, and editing the title afterwards does not change
 * it.
 */
const closingTime = (
  existing: TaskEntity,
  status: TaskStatus,
  now: string,
): string | null => {
  if (!isClosed(status)) {
    return null;
  }

  return existing.closedAt ?? now;
};

/** `undefined` keeps what is there; `null` clears it. */
/** `undefined` keeps what is there; `null` clears it. */
const merge = <T>(current: T | null, change: T | null | undefined): T | null =>
  change === undefined ? current : change;

/**
 * A task as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `TaskDTO`. It is in the URL of every
 * route that can reach the record, so returning it would restate what the
 * caller already said.
 */
type StoredTask = TaskEntity;

/** A row as the api answers with it: tenant dropped, `null` becomes absent. */
const toDto = (task: TaskEntity): TaskDTO => ({
  id: task.id,
  title: task.title,
  ...(task.description === null ? {} : { description: task.description }),
  status: task.status,
  ...(task.priority === null ? {} : { priority: task.priority }),
  ...(task.projectId === null ? {} : { projectId: task.projectId }),
  ...(task.dueAt === null ? {} : { dueAt: task.dueAt }),
  ...(task.closedAt === null ? {} : { closedAt: task.closedAt }),
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});
