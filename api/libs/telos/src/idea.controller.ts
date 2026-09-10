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
  createIdeaSchema,
  updateIdeaSchema,
  type CreateIdeaDTO,
  type IdeaDTO,
  type UpdateIdeaDTO,
} from '@aether/contract';

import { GoalService } from './goal.service';
import { IdeaService, type IdeaRecord } from './idea.service';

/**
 * The ideas telos is holding.
 *
 * Guarded twice over: organon's pistis guard is an `APP_GUARD`, so a token is
 * required because nobody opted out, and `OrganizationGuard` then checks the
 * path's organization against the caller's `orgs` claim. The handlers take the
 * tenant from the `Actor` it produces rather than from the path, so a route
 * that ever loses its guard fails loudly instead of quietly querying an
 * organization nobody checked.
 */
@Controller('organizations/:organizationId/ideas')
@UseGuards(OrganizationGuard)
export class IdeaController {
  constructor(
    private readonly ideas: IdeaService,
    private readonly goals: GoalService,
  ) {}

  /**
   * Fills in `inspired` — the goals that name this idea.
   *
   * Composed here rather than in `IdeaService` because only `GoalService`
   * knows the answer, and having the two services ask each other would make
   * them mutually dependent for one derived field. The controller is the one
   * place that already knows about both.
   */
  private withInspired(actor: Actor, idea: IdeaRecord): IdeaDTO {
    return { ...idea, inspired: this.goals.idsInspiredBy(actor, idea.id) };
  }

  @Get()
  list(@CurrentActor() actor: Actor): IdeaDTO[] {
    return this.ideas
      .list(actor)
      .map((idea) => this.withInspired(actor, idea));
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such idea" for something that could never
   * have been one.
   */
  @Get(':id')
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): IdeaDTO {
    return this.withInspired(actor, this.ideas.get(actor, id));
  }

  /**
   * The pipe is bound to the argument rather than the handler, so it validates
   * the body and nothing else — and what reaches the method is the *parsed*
   * value, with unknown keys stripped. That is what stops a caller setting
   * `createdBy`: the field is not in the create shape, so it never arrives.
   */
  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createIdeaSchema)) idea: CreateIdeaDTO,
  ): IdeaDTO {
    // Newly captured, so nothing can have been inspired by it yet — but it is
    // composed the same way rather than hard-coded to `[]`, so there is one
    // path and not two.
    return this.withInspired(actor, this.ideas.create(actor, idea));
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
    @Body(new ZodValidationPipe(updateIdeaSchema)) changes: UpdateIdeaDTO,
  ): IdeaDTO {
    return this.withInspired(actor, this.ideas.update(actor, id, changes));
  }

  /** 204: there is nothing useful to say about an idea that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): void {
    this.ideas.remove(actor, id);
  }
}
