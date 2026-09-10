import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  CLOSED_STATUSES,
  type CreateTaskDTO,
  type TaskDTO,
  type TaskStatus,
  type UpdateTaskDTO,
} from '@aether/contract';
import type { Actor } from '@aether-zone/organon';

import { ProjectService } from './project.service';

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
  private readonly tasks: StoredTask[] = [];

  constructor(private readonly projects: ProjectService) {}

  /** Every task in this organization, oldest first. */
  list(actor: Actor): TaskDTO[] {
    return this.tasks
      .filter((task) => task.organizationId === actor.organizationId)
      .map(toDto);
  }

  /**
   * One task, or a 404.
   *
   * A task in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  get(actor: Actor, id: string): TaskDTO {
    return toDto(this.stored(actor, id));
  }

  /** The ids of the tasks filed under a project, oldest first. */
  idsInProject(actor: Actor, projectId: string): string[] {
    return this.tasks
      .filter(
        (task) =>
          task.organizationId === actor.organizationId &&
          task.projectId === projectId,
      )
      .map((task) => task.id);
  }

  /**
   * Writes one down.
   *
   * Every task begins `TODO`: writing one down is not doing it, and a caller
   * able to choose could record work as finished that was never started.
   */
  create(actor: Actor, input: CreateTaskDTO): TaskDTO {
    if (input.projectId) {
      this.requireProject(actor, input.projectId);
    }

    const now = new Date().toISOString();

    const task: StoredTask = {
      id: randomUUID(),
      organizationId: actor.organizationId,
      status: 'TODO',
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.push(task);

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
  update(actor: Actor, id: string, changes: UpdateTaskDTO): TaskDTO {
    const existing = this.stored(actor, id);

    if (changes.projectId) {
      this.requireProject(actor, changes.projectId);
    }

    const status = changes.status ?? existing.status;
    const now = new Date().toISOString();

    const updated: StoredTask = {
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

    this.tasks[this.tasks.indexOf(existing)] = updated;

    return toDto(updated);
  }

  /** Forgets a task. Deleting one that is not here is a 404, not a shrug. */
  remove(actor: Actor, id: string): void {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const task = this.stored(actor, id);

    this.tasks.splice(this.tasks.indexOf(task), 1);
  }

  /**
   * Throws unless the project is one this actor can see.
   *
   * Checked rather than stored blindly: an id pointing at nothing would show
   * up as a task filed under a project that cannot be opened, with no way to
   * tell whether the project was deleted or never existed.
   */
  private requireProject(actor: Actor, projectId: string): void {
    this.projects.get(actor, projectId);
  }

  private stored(actor: Actor, id: string): StoredTask {
    const task = this.tasks.find(
      (candidate) =>
        candidate.id === id &&
        candidate.organizationId === actor.organizationId,
    );

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
  existing: StoredTask,
  status: TaskStatus,
  now: string,
): string | undefined => {
  if (!isClosed(status)) {
    return undefined;
  }

  return existing.closedAt ?? now;
};

/** `undefined` keeps what is there; `null` clears it. */
const merge = <T>(
  current: T | undefined,
  change: T | null | undefined,
): T | undefined => (change === undefined ? current : (change ?? undefined));

/**
 * A task as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `TaskDTO`. It is in the URL of every
 * route that can reach the record, so returning it would restate what the
 * caller already said.
 */
type StoredTask = TaskDTO & { organizationId: string };

const toDto = ({
  organizationId: _organizationId,
  ...task
}: StoredTask): TaskDTO => task;
