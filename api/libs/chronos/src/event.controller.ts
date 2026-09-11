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
  createEventSchema,
  updateEventSchema,
  type CreateEventDTO,
  type EventDTO,
  type UpdateEventDTO,
} from '@aether/contract';

import { EventService } from './event.service';

/**
 * What is in the calendar — meetings, appointments, calls, deadlines.
 *
 * One controller for every kind, because they share every field that matters
 * and "what is on Tuesday" is one query rather than six.
 *
 * Guarded twice over: organon's pistis guard is an `APP_GUARD`, so a token is
 * required because nobody opted out, and `OrganizationGuard` then checks the
 * path's organization against the caller's `orgs` claim. The handlers take the
 * tenant from the `Actor` it produces rather than from the path, so a route
 * that ever loses its guard fails loudly instead of quietly querying an
 * organization nobody checked.
 */
@Controller('organizations/:organizationId/events')
@UseGuards(OrganizationGuard)
export class EventController {
  constructor(private readonly events: EventService) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<EventDTO[]> {
    return this.events.list(actor);
  }

  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventDTO> {
    return this.events.get(actor, id);
  }

  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createEventSchema)) event: CreateEventDTO,
  ): Promise<EventDTO> {
    return this.events.create(actor, event);
  }

  /**
   * PATCH rather than PUT: the body is the fields that changed, and an absent
   * one means "leave it alone". A PUT would have to mean "replace", which
   * silently clears anything the caller forgot to send — including, here, an
   * entire guest list.
   */
  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateEventSchema)) changes: UpdateEventDTO,
  ): Promise<EventDTO> {
    return this.events.update(actor, id, changes);
  }

  /** 204: there is nothing useful to say about an event that is now gone. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.events.remove(actor, id);
  }
}
