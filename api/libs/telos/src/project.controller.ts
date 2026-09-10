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

import { ProjectService } from './project.service';

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
  constructor(private readonly projects: ProjectService) {}

  @Get()
  list(@CurrentActor() actor: Actor): ProjectDTO[] {
    return this.projects.list(actor);
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such project" for something that could never
   * have been one.
   */
  @Get(':id')
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): ProjectDTO {
    return this.projects.get(actor, id);
  }

  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createProjectSchema)) project: CreateProjectDTO,
  ): ProjectDTO {
    return this.projects.create(actor, project);
  }

  /**
   * PATCH rather than PUT: the body is the fields that changed, and an absent
   * one means "leave it alone". A PUT would have to mean "replace", which
   * silently clears anything the caller forgot to send.
   */
  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) changes: UpdateProjectDTO,
  ): ProjectDTO {
    return this.projects.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about a project that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): void {
    this.projects.remove(actor, id);
  }
}
