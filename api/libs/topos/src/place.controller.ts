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
  createPlaceSchema,
  updatePlaceSchema,
  type CreatePlaceDTO,
  type PlaceDTO,
  type UpdatePlaceDTO,
} from '@aether/contract';

import { PlaceService } from './place.service';

/**
 * The places topos knows about.
 *
 * Authenticated without saying so: organon registers its pistis guard as an
 * `APP_GUARD`, so every route here requires a valid token because nobody opted
 * it out. `OrganizationGuard` then checks the id in the path against the
 * caller's `orgs` claim and hands the handler an `Actor` narrowed to it — and
 * the handlers take the organization from *that* rather than from the path
 * parameter, so a route that ever loses its guard fails loudly instead of
 * quietly querying an organization nobody checked.
 *
 * Every write announces itself on the shared exchange — akouo records places
 * as locations, and arachni can relate a meeting to one. See
 * `PlaceService.announce`.
 */
@Controller('organizations/:organizationId/places')
@UseGuards(OrganizationGuard)
export class PlaceController {
  constructor(private readonly places: PlaceService) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<PlaceDTO[]> {
    return this.places.list(actor);
  }

  /**
   * `ParseUUIDPipe` so a malformed id is a 400 naming the parameter, rather
   * than a 404 that reads as "no such place" for something that could never
   * have been one.
   */
  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlaceDTO> {
    return this.places.get(actor, id);
  }

  /**
   * The pipe is bound to the argument rather than the handler, so it validates
   * the body and nothing else — and what reaches the method is the *parsed*
   * value, with unknown keys stripped and the text already trimmed.
   */
  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createPlaceSchema)) place: CreatePlaceDTO,
  ): Promise<PlaceDTO> {
    return this.places.create(actor, place);
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
    @Body(new ZodValidationPipe(updatePlaceSchema)) changes: UpdatePlaceDTO,
  ): Promise<PlaceDTO> {
    return this.places.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about a place that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.places.remove(actor, id);
  }
}
