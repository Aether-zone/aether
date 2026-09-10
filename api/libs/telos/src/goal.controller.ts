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
  createGoalSchema,
  updateGoalSchema,
  type CreateGoalDTO,
  type GoalDTO,
  type UpdateGoalDTO,
} from '@aether/contract';

import { GoalService } from './goal.service';

/**
 * The goals telos is holding.
 *
 * Guarded twice over: organon's pistis guard is an `APP_GUARD`, so a token is
 * required because nobody opted out, and `OrganizationGuard` then checks the
 * path's organization against the caller's `orgs` claim. The handlers take the
 * tenant from the `Actor` it produces rather than from the path, so a route
 * that ever loses its guard fails loudly instead of quietly querying an
 * organization nobody checked.
 */
@Controller('organizations/:organizationId/goals')
@UseGuards(OrganizationGuard)
export class GoalController {
  constructor(private readonly goals: GoalService) {}

  @Get()
  list(@CurrentActor() actor: Actor): GoalDTO[] {
    return this.goals.list(actor);
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such goal" for something that could never
   * have been one.
   */
  @Get(':id')
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): GoalDTO {
    return this.goals.get(actor, id);
  }

  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createGoalSchema)) goal: CreateGoalDTO,
  ): GoalDTO {
    return this.goals.create(actor, goal);
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
    @Body(new ZodValidationPipe(updateGoalSchema)) changes: UpdateGoalDTO,
  ): GoalDTO {
    return this.goals.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about a goal that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): void {
    this.goals.remove(actor, id);
  }
}
