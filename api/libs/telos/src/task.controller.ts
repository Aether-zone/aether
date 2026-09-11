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
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskDTO,
  type TaskDTO,
  type UpdateTaskDTO,
} from '@aether/contract';

import { TaskService } from './task.service';

/**
 * The tasks telos is holding.
 *
 * Guarded twice over: organon's pistis guard is an `APP_GUARD`, so a token is
 * required because nobody opted out, and `OrganizationGuard` then checks the
 * path's organization against the caller's `orgs` claim. The handlers take the
 * tenant from the `Actor` it produces rather than from the path, so a route
 * that ever loses its guard fails loudly instead of quietly querying an
 * organization nobody checked.
 */
@Controller('organizations/:organizationId/tasks')
@UseGuards(OrganizationGuard)
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<TaskDTO[]> {
    return this.tasks.list(actor);
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such task" for something that could never
   * have been one.
   */
  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskDTO> {
    return this.tasks.get(actor, id);
  }

  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createTaskSchema)) task: CreateTaskDTO,
  ): Promise<TaskDTO> {
    return this.tasks.create(actor, task);
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
    @Body(new ZodValidationPipe(updateTaskSchema)) changes: UpdateTaskDTO,
  ): Promise<TaskDTO> {
    return this.tasks.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about a task that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tasks.remove(actor, id);
  }
}
