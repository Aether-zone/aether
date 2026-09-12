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
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  createPresignedUploadSchema,
  createResourceSchema,
  updateResourceSchema,
  type CreatePresignedUploadDTO,
  type CreateResourceDTO,
  type FileDTO,
  type PreparedUploadDTO,
  type ResourceDTO,
  type UpdateResourceDTO,
} from '@aether/contract';

import { FileService } from './file.service';
import { bearerToken } from './loculus/bearer-token';
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
  constructor(
    private readonly resources: ResourceService,
    private readonly files: FileService,
  ) {}

  /**
   * Asks loculus where a file may be uploaded.
   *
   * The browser spends the returned URL against the object store directly, so
   * the bytes never cross aether — which is what lets a large file cost this
   * api one small JSON round trip. The `fileId` that comes back is what a
   * later `POST /resources` attaches.
   *
   * Organization membership is already established by `OrganizationGuard`, and
   * the caller's own token is what loculus is asked with: aether can obtain
   * nothing here that the person could not have obtained themselves.
   */
  @Post('presign')
  presignUpload(
    @CurrentActor() actor: Actor,
    @Headers('authorization') authorization: string | undefined,
    @Body(new ZodValidationPipe(createPresignedUploadSchema))
    request: CreatePresignedUploadDTO,
  ): Promise<PreparedUploadDTO> {
    return this.files.prepare(actor, request, bearerToken(authorization));
  }

  /**
   * Records that the bytes arrived.
   *
   * Separate from creating the resource because the two can fail apart: the
   * upload may succeed and the resource never be filed, or the browser may
   * never come back at all. A file left `INITIAL` is the evidence of that.
   */
  @Post('files/:fileId/uploaded')
  markUploaded(
    @CurrentActor() actor: Actor,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileDTO> {
    return this.files.markUploaded(actor, fileId);
  }

  /**
   * What is known about a stored file.
   *
   * Its status above all: a row can exist for an upload that never finished,
   * and a page offering to download one of those would be offering a link to
   * nothing.
   */
  @Get('files/:fileId')
  file(
    @CurrentActor() actor: Actor,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileDTO> {
    return this.files.get(actor, fileId);
  }

  /**
   * Somewhere to read a file back from, signed for this caller.
   *
   * Asked for at the moment somebody clicks, not when the page is rendered.
   * The URL expires, and one minted with the page would stop working while the
   * reader was still looking at it — which is the same reason `FileDTO`
   * carries no URL of its own.
   */
  @Get('files/:fileId/download')
  async download(
    @CurrentActor() actor: Actor,
    @Headers('authorization') authorization: string | undefined,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<{ downloadUrl: string }> {
    return {
      downloadUrl: await this.files.downloadUrl(
        actor,
        fileId,
        bearerToken(authorization),
      ),
    };
  }

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
