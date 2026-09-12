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
  createGroupSchema,
  updateGroupSchema,
  type CreateGroupDTO,
  type GroupDTO,
  type UpdateGroupDTO,
} from '@aether/contract';

import { GroupService } from './group.service';

/**
 * The groups prosopone is holding.
 *
 * `/organizations/:organizationId/groups` — the first segment is the tenant,
 * as on every route in this api, and the last is this resource. The two names
 * being different is the whole point of calling it a group: `:organizationId`
 * is who is asking, and the `:id` below is which group they are asking about.
 *
 * Guarded twice over: organon's pistis guard is an `APP_GUARD`, so a token is
 * required because nobody opted out, and `OrganizationGuard` then checks the
 * path's group against the caller's `orgs` claim. The handlers take the
 * tenant from the `Actor` it produces rather than from the path, so a route
 * that ever loses its guard fails loudly instead of quietly querying an
 * group nobody checked.
 */
@Controller('organizations/:organizationId/groups')
@UseGuards(OrganizationGuard)
export class GroupController {
  constructor(private readonly groups: GroupService) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<GroupDTO[]> {
    // `Promise.all` over the page: each count is its own pair of queries, and
    // awaiting them in turn would make a list N round trips deep.
    return this.groups.list(actor);
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such group" for something that could never
   * have been one.
   */
  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GroupDTO> {
    return this.groups.get(actor, id);
  }

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createGroupSchema))
    group: CreateGroupDTO,
  ): Promise<GroupDTO> {
    return this.groups.create(actor, group);
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
    @Body(new ZodValidationPipe(updateGroupSchema))
    changes: UpdateGroupDTO,
  ): Promise<GroupDTO> {
    return this.groups.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about a group that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.groups.remove(actor, id);
  }
}
