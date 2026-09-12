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
  createUserSchema,
  updateUserSchema,
  type CreateUserDTO,
  type UpdateUserDTO,
  type UserDTO,
} from '@aether/contract';

import { UserService } from './user.service';

/**
 * The people prosopone knows about.
 *
 * Authenticated, without saying so: organon registers its pistis guard as an
 * `APP_GUARD`, so every route here requires a valid token because nobody opted
 * it out.
 *
 * **Organization-scoped**, like every other service in the workspace.
 * `OrganizationGuard` checks the id in the path against the caller's `orgs`
 * claim and hands the handler an `Actor` narrowed to it; the handlers take the
 * organization from *that* rather than from the path parameter. The two are
 * equal once the guard has run, and reaching for the actor means a route that
 * ever loses its guard fails loudly instead of quietly querying an
 * organization nobody checked.
 *
 * This used to be `/users`, unscoped. It had to change: the event a create
 * publishes has to name a tenant, or arachni drops it, mneme drops it, and
 * akouo cannot insert the person at all — its `organizationId` column is NOT
 * NULL.
 */
@Controller('organizations/:organizationId/users')
@UseGuards(OrganizationGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<UserDTO[]> {
    return this.users.list(actor);
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such person" for something that could never
   * have been one.
   */
  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserDTO> {
    return this.users.get(actor, id);
  }

  /**
   * The pipe is bound to the argument rather than the handler, so it validates
   * the body and nothing else — and what reaches the method is the *parsed*
   * value, with unknown keys stripped and the email already lowercased.
   */
  @Post()
  create(
    /*
     * The actor carries both the tenant the person is filed under and the
     * subject the published event names as its cause.
     */
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createUserSchema)) user: CreateUserDTO,
  ): Promise<UserDTO> {
    return this.users.create(actor, user);
  }

  /**
   * PATCH rather than PUT: the body is the fields that changed, and an absent
   * one means "leave it alone". A PUT here would have to mean "replace", which
   * silently clears anything the caller forgot to send.
   */
  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) changes: UpdateUserDTO,
  ): Promise<UserDTO> {
    return this.users.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about a person who is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.users.remove(actor, id);
  }
}
