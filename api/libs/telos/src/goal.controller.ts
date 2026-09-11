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

import { GoalService, type GoalRecord } from './goal.service';
import { ProjectService } from './project.service';

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
  constructor(
    private readonly goals: GoalService,
    private readonly projects: ProjectService,
  ) {}

  /**
   * Fills in `realizedBy` — the projects working towards this goal.
   *
   * Composed here rather than in `GoalService` because only `ProjectService`
   * knows the answer, and having the two services ask each other would make
   * them mutually dependent for one derived field. The controller is the one
   * place that already knows about both.
   */
  private async withRealizedBy(
    actor: Actor,
    goal: GoalRecord,
  ): Promise<GoalDTO> {
    return {
      ...goal,
      realizedBy: await this.projects.idsPursuing(actor, goal.id),
    };
  }

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<GoalDTO[]> {
    // `Promise.all` over the page: each composition is its own read, and
    // awaiting them in turn would make a list N round trips deep.
    return Promise.all(
      (await this.goals.list(actor)).map((goal) =>
        this.withRealizedBy(actor, goal),
      ),
    );
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such goal" for something that could never
   * have been one.
   */
  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GoalDTO> {
    return this.withRealizedBy(actor, await this.goals.get(actor, id));
  }

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createGoalSchema)) goal: CreateGoalDTO,
  ): Promise<GoalDTO> {
    // Newly set, so nothing can be working towards it yet — composed the same
    // way rather than hard-coded to `[]`, so there is one path and not two.
    return this.withRealizedBy(actor, await this.goals.create(actor, goal));
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
    @Body(new ZodValidationPipe(updateGoalSchema)) changes: UpdateGoalDTO,
  ): Promise<GoalDTO> {
    return this.withRealizedBy(
      actor,
      await this.goals.update(actor, id, changes),
    );
  }

  /** 204: there is nothing useful to say about a goal that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.goals.remove(actor, id);
  }
}
