import {
  CurrentActor,
  OrganizationGuard,
  ZodValidationPipe,
  type Actor,
} from '@aether-zone/organon';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  createResourceSchema,
  updateResourceSchema,
  type CreateResourceDTO,
  type ResourceDTO,
  type UpdateResourceDTO,
} from '@aether/contract';

import { ResourceService } from './resource.service';

/**
 * The resources tekmerion is holding.
 *
 * Guarded twice over: organon's pistis guard is an `APP_GUARD`, so a token is
 * required because nobody opted out, and `OrganizationGuard` then checks the
 * path's organization against the caller's `orgs` claim. The handlers take the
 * tenant from the `Actor` it produces rather than from the path, so a route
 * that ever loses its guard fails loudly instead of quietly querying an
 * organization nobody checked.
 */
@Controller('organizations/:organizationId/resources')
@UseGuards(OrganizationGuard)
export class ResourceController {
  constructor(private readonly resources: ResourceService) {}

  /**
   * Everything filed here, or the one a given system already gave us.
   *
   * The `source`/`externalId` pair is a filter on the list rather than a route
   * of its own, because the answer is the same kind of thing either way — none
   * or one — and a caller checking before it files something should not have
   * to handle a 404 as the ordinary case.
   *
   * Both are required together. `externalId` is only unique within a `source`
   * — two systems will both number their records from 1 — so either alone is a
   * question with no answer, and answering it with the whole list would look
   * like a match.
   */
  @Get()
  async list(
    @CurrentActor() actor: Actor,
    @Query('source') source?: string,
    @Query('externalId') externalId?: string,
  ): Promise<ResourceDTO[]> {
    if (source && externalId) {
      // `source` here is the source's `type` — the part that names the system.
      const found = await this.resources.findExternal(
        actor,
        source,
        externalId,
      );

      return found ? [found] : [];
    }

    if (source || externalId) {
      throw new BadRequestException(
        'Looking up by external id needs both `source` and `externalId`.',
      );
    }

    return this.resources.list(actor);
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such resource" for something that could never
   * have been one.
   */
  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceDTO> {
    return this.resources.get(actor, id);
  }

  /** POST, not PUT: the caller does not choose the id, so it cannot address it. */
  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createResourceSchema))
    resource: CreateResourceDTO,
  ): Promise<ResourceDTO> {
    return this.resources.create(actor, resource);
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
    @Body(new ZodValidationPipe(updateResourceSchema))
    changes: UpdateResourceDTO,
  ): Promise<ResourceDTO> {
    return this.resources.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about a resource that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.resources.remove(actor, id);
  }
}
