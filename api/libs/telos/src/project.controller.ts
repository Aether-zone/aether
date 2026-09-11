import {
  CurrentActor,
  OrganizationGuard,
  ZodValidationPipe,
  type Actor,
} from '@aether-zone/organon';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectDTO,
  type ProjectDTO,
  type UpdateProjectDTO,
} from '@aether/contract';

import { ProjectService, type ProjectRecord } from './project.service';
import { TaskService } from './task.service';

/**
 * The projects telos is holding.
 *
 * Guarded twice over: organon's pistis guard is an `APP_GUARD`, so a token is
 * required because nobody opted out, and `OrganizationGuard` then checks the
 * path's organization against the caller's `orgs` claim. The handlers take the
 * tenant from the `Actor` it produces rather than from the path, so a route
 * that ever loses its guard fails loudly instead of quietly querying an
 * organization nobody checked.
 */
@Controller('organizations/:organizationId/projects')
@UseGuards(OrganizationGuard)
export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
  ) {}

  /**
   * Counts the work in a project.
   *
   * Composed here rather than in `ProjectService` because only `TaskService`
   * knows, and having the two ask each other would make them mutually
   * dependent — `TaskService` already depends on `ProjectService` to refuse a
   * task filed under a project that does not exist, so the arrow can only go
   * one way. The controller is the one place that knows about both.
   */
  private async withTasks(
    actor: Actor,
    project: ProjectRecord,
  ): Promise<ProjectDTO> {
    return {
      ...project,
      tasks: await this.tasks.countsForProject(actor, project.id),
    };
  }

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<ProjectDTO[]> {
    // `Promise.all` over the page: each count is its own pair of queries, and
    // awaiting them in turn would make a list N round trips deep.
    return Promise.all(
      (await this.projects.list(actor)).map((project) =>
        this.withTasks(actor, project),
      ),
    );
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such project" for something that could never
   * have been one.
   */
  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDTO> {
    return this.withTasks(actor, await this.projects.get(actor, id));
  }

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createProjectSchema)) project: CreateProjectDTO,
  ): Promise<ProjectDTO> {
    // Newly started, so it has no tasks yet — counted the same way rather than
    // hard-coded, so there is one path and not two.
    return this.withTasks(actor, await this.projects.create(actor, project));
  }

  /**
   * PATCH rather than PUT: the body is the fields that changed, and an absent
   * one means "leave it alone". A PUT would have to mean "replace", which
   * silently clears anything the caller forgot to send.
   */
  @Patch(':id')
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) changes: UpdateProjectDTO,
  ): Promise<ProjectDTO> {
    return this.withTasks(
      actor,
      await this.projects.update(actor, id, changes),
    );
  }

  /** 204: there is nothing useful to say about a project that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.projects.remove(actor, id);
  }
}
