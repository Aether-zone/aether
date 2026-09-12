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
import { TaskService } from './task.service';

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
    private readonly tasks: TaskService,
  ) {}

  /**
   * Fills in what is read from the projects working towards this goal:
   * `realizedBy`, which is those projects, and `progress`, which is counted
   * from the tasks inside them.
   *
   * Composed here rather than in `GoalService` because only `ProjectService`
   * and `TaskService` know the answers, and having the services ask each other
   * would make them mutually dependent for two derived fields. The controller
   * is the one place that already knows about all three.
   */
  private async withWorkDone(actor: Actor, goal: GoalRecord): Promise<GoalDTO> {
    const realizedBy = await this.projects.idsPursuing(actor, goal.id);

    /*
     * The tasks of every project pursuing this goal, added together — not an
     * average of each project's percentage. A project holding one task and one
     * holding fifty are not half the answer each, and averaging would let a
     * finished afterthought drag a barely-started rewrite up to 50%.
     */
    const counts = await Promise.all(
      realizedBy.map((projectId) =>
        this.tasks.countsForProject(actor, projectId),
      ),
    );

    const done = counts.reduce((sum, count) => sum + count.done, 0);
    const total = counts.reduce((sum, count) => sum + count.total, 0);

    return {
      ...goal,
      realizedBy,
      // No tasks anywhere under it is 0, which reads the same as a goal nobody
      // has started — right in both cases, since nothing has been finished.
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<GoalDTO[]> {
    // `Promise.all` over the page: each composition is its own read, and
    // awaiting them in turn would make a list N round trips deep.
    return Promise.all(
      (await this.goals.list(actor)).map((goal) =>
        this.withWorkDone(actor, goal),
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
    return this.withWorkDone(actor, await this.goals.get(actor, id));
  }

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createGoalSchema)) goal: CreateGoalDTO,
  ): Promise<GoalDTO> {
    // Newly set, so nothing can be working towards it yet — composed the same
    // way rather than hard-coded to `[]`, so there is one path and not two.
    return this.withWorkDone(actor, await this.goals.create(actor, goal));
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
    return this.withWorkDone(
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
