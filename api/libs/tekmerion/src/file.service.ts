import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import type {
  CreatePresignedUploadDTO,
  FileDTO,
  PreparedUploadDTO,
} from '@aether/contract';
import type { Actor } from '@aether-zone/organon';

import { StoredFile } from './file.entity';
import { LoculusClient } from './loculus/loculus.client';
import { LOCULUS_BACKEND } from './loculus/loculus.config';

/**
 * The files tekmerion knows about.
 *
 * A row per stored object. The bytes never come here: `prepare` asks loculus
 * for somewhere to put one and writes a row expecting it, the browser uploads
 * directly, and `markUploaded` records that it arrived.
 *
 * That three-step shape is why `status` exists. A presigned URL can be issued
 * and never spent — the tab is closed, the upload fails, it was the wrong file
 * — and without a state for it the choices are a row claiming bytes it does
 * not have, or no row at all until the browser comes back, which it may never
 * do. `INITIAL` is the honest third answer, and it is what makes an abandoned
 * upload findable later instead of invisible.
 */
@Injectable()
export class FileService {
  constructor(
    @InjectRepository(StoredFile)
    private readonly files: Repository<StoredFile>,
    private readonly loculus: LoculusClient,
  ) {}

  /**
   * Asks loculus where a file may go, and writes the row that expects it.
   *
   * The row is written *after* loculus answers. The other order would leave a
   * row behind every time the store was unreachable, and those rows would be
   * indistinguishable from uploads somebody abandoned.
   *
   * `organizationId` is taken from the actor and not from the request, whatever
   * the request said. The value is provenance, and provenance dictated by the
   * thing being recorded is worth nothing.
   */
  async prepare(
    actor: Actor,
    request: CreatePresignedUploadDTO,
    accessToken: string,
  ): Promise<PreparedUploadDTO> {
    const presigned = await this.loculus.createUpload(
      { ...request, organizationId: actor.organizationId },
      accessToken,
    );

    const now = new Date().toISOString();

    const file = await this.files.save(
      this.files.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        key: presigned.objectKey,
        backend: LOCULUS_BACKEND,
        originalName: request.fileName,
        mimeType: request.contentType,
        size: request.size,
        // Nothing has been uploaded yet, and the caller cannot say otherwise.
        status: 'INITIAL',
        createdAt: now,
        updatedAt: now,
      }),
    );

    /*
     * `fileId`, not `objectKey`. loculus has no notion of who owns an object,
     * so a key coming back from a browser is unattributable — aether would
     * have to take its word for which organization it belonged to. This id is
     * a row aether wrote for an organization it had already checked.
     */
    return { ...presigned, fileId: file.id };
  }

  /**
   * Records that the bytes arrived.
   *
   * Taken on the browser's word, and that is a real limit worth naming: aether
   * does not ask loculus whether the object is there. A `HeadObject` would be
   * the honest check and it is one round trip — worth adding the day a file
   * that claims to exist and does not becomes a problem somebody has.
   */
  async markUploaded(actor: Actor, id: string): Promise<FileDTO> {
    const file = await this.stored(actor, id);

    return toDto(
      await this.files.save({
        ...file,
        status: 'UPLOADED',
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  /**
   * Records that the bytes arrived, on the object store's word rather than the
   * browser's.
   *
   * The counterpart to {@link markUploaded}, for loculus's `object.uploaded`.
   * Keyed rather than by id, and with no `Actor`, because an event has neither:
   * nobody is asking, and there is no token behind it to scope by. That is safe
   * where the id-based path would not be — `key` is unique and loculus minted
   * it, so there is no caller to have named somebody else's row.
   *
   * `null` for a key aether has no row for. A shared bucket holds other
   * services' objects, and being told about one of those is ordinary.
   *
   * Already-`UPLOADED` rows are returned untouched rather than saved again, so a
   * redelivered event does not move `updatedAt` and make a file look freshly
   * changed every time the broker repeats itself.
   */
  async markUploadedByKey(objectKey: string): Promise<StoredFile | null> {
    const file = await this.files.findOneBy({ key: objectKey });

    if (!file || file.status === 'UPLOADED') {
      return file;
    }

    return this.files.save({
      ...file,
      status: 'UPLOADED',
      updatedAt: new Date().toISOString(),
    });
  }

  /** One file, or a 404. */
  async get(actor: Actor, id: string): Promise<FileDTO> {
    return toDto(await this.stored(actor, id));
  }

  /** Somewhere to read the bytes back from, signed for this caller. */
  async downloadUrl(
    actor: Actor,
    id: string,
    accessToken: string,
  ): Promise<string> {
    const file = await this.stored(actor, id);

    const presigned = await this.loculus.createDownload(file.key, accessToken);

    return presigned.downloadUrl;
  }

  /**
   * Forgets the row and the object behind it.
   *
   * loculus first: a delete that removed the row and then failed would leave
   * bytes nobody can name or reach, where this order can at worst leave a row
   * whose object is gone — which reads as a broken file rather than as silent
   * cost.
   */
  async remove(actor: Actor, id: string, accessToken: string): Promise<void> {
    const file = await this.stored(actor, id);

    await this.loculus.remove(file.key, accessToken);
    await this.files.remove({ ...file });
  }

  private async stored(actor: Actor, id: string): Promise<StoredFile> {
    // The tenant is part of the lookup, not a check after it.
    const file = await this.files.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!file) {
      throw new NotFoundException(`No file with id ${id}.`);
    }

    return file;
  }
}

/**
 * A row as the api answers with it.
 *
 * The key and the backend are dropped. They are how aether finds the bytes,
 * not anything a client should hold: a client that knew the key would start
 * building URLs from it, and those URLs are loculus's to sign.
 */
const toDto = (file: StoredFile): FileDTO => ({
  id: file.id,
  originalName: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  status: file.status,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
});
