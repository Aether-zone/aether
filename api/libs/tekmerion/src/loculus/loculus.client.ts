import {
  presignedDownloadSchema,
  presignedUploadSchema,
  type CreatePresignedUploadDTO,
  type PresignedDownloadDTO,
  type PresignedUploadDTO,
} from '@aether/contract';
import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { ZodType } from 'zod';

import { LOCULUS_CONFIG, type LoculusConfig } from './loculus.config';

/**
 * A key is a path — `{requestor}/{organizationId}/{name}` — so each segment is
 * encoded on its own. `encodeURIComponent` on the whole key would turn its
 * slashes into `%2F`, and loculus's wildcard route matches real separators.
 */
const encodeKey = (objectKey: string): string =>
  objectKey.split('/').map(encodeURIComponent).join('/');

/**
 * aether's client for loculus, the object store service.
 *
 * aether asks loculus where a file may be put and hands the answer to the
 * browser, which uploads to the store directly. No bytes pass through this
 * process, which is the whole point: an api that streams uploads is an api
 * sized by its largest file.
 *
 * **Every method requires the caller's token**, and this is where aether's
 * client is simpler than akouo's. akouo transcribes in the background, so it
 * has work with nobody to borrow a token from and needs client credentials of
 * its own. Nothing in tekmerion happens without somebody waiting for it, so
 * relaying the caller's token is always possible — and it means aether can
 * obtain nothing from loculus that the person could not have obtained
 * themselves. There is no service identity to configure, leak or rotate.
 */
@Injectable()
export class LoculusClient {
  private readonly logger = new Logger(LoculusClient.name);

  constructor(@Inject(LOCULUS_CONFIG) private readonly config: LoculusConfig) {}

  /** Somewhere to PUT a file, and the key it will be known by afterwards. */
  createUpload(
    request: CreatePresignedUploadDTO,
    accessToken: string,
  ): Promise<PresignedUploadDTO> {
    return this.send(
      'POST',
      '/objects/presign',
      accessToken,
      presignedUploadSchema,
      request,
    );
  }

  /** Somewhere to GET one back from. */
  createDownload(
    objectKey: string,
    accessToken: string,
  ): Promise<PresignedDownloadDTO> {
    return this.send(
      'GET',
      `/objects/${encodeKey(objectKey)}/presign`,
      accessToken,
      presignedDownloadSchema,
    );
  }

  async remove(objectKey: string, accessToken: string): Promise<void> {
    await this.send(
      'DELETE',
      `/objects/${encodeKey(objectKey)}`,
      accessToken,
      null,
    );
  }

  private async send<T>(
    method: string,
    path: string,
    accessToken: string,
    schema: ZodType<T> | null,
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetch(method, path, accessToken, body);

    if (!response.ok) {
      throw await this.failure(response, method, path);
    }

    if (!schema) {
      return undefined as T;
    }

    const parsed = schema.safeParse(await response.json().catch(() => null));

    if (!parsed.success) {
      /*
       * loculus answered, but not with what its contract promises. That is a
       * deployment mismatch rather than anything the caller did, so it is a
       * 502 and not a 400.
       */
      this.logger.error(
        `loculus answered ${method} ${path} with an unexpected body: ${parsed.error.message}`,
      );

      throw new BadGatewayException(
        'The object store gave an unusable answer.',
      );
    }

    return parsed.data;
  }

  private async fetch(
    method: string,
    path: string,
    accessToken: string,
    body?: unknown,
  ): Promise<Response> {
    try {
      return await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          // Relayed as given: loculus verifies it against pistis itself.
          authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (cause) {
      const timedOut = cause instanceof Error && cause.name === 'TimeoutError';

      this.logger.error(
        `loculus did not answer ${method} ${path}: ${
          cause instanceof Error ? cause.message : 'unknown failure'
        }`,
      );

      throw timedOut
        ? new GatewayTimeoutException(
            'The object store did not answer in time.',
          )
        : new BadGatewayException('The object store could not be reached.');
    }
  }

  /**
   * Turns loculus's refusal into aether's.
   *
   * A 401 from loculus is **not** passed through as a 401: the caller's token
   * was good enough to reach this handler, so telling them to authenticate
   * again would send them round a loop that cannot help. It means the two
   * services disagree about pistis — a different issuer or audience — which is
   * aether's problem to fix, and a 502 says so. A 404 and a 400 do belong to
   * the caller and are relayed unchanged.
   */
  private async failure(
    response: Response,
    method: string,
    path: string,
  ): Promise<HttpException> {
    const detail = await response.text().catch(() => '');

    if (response.status === 401 || response.status === 403) {
      this.logger.error(
        `loculus refused ${method} ${path} with ${response.status}: ${detail}`,
      );

      return new BadGatewayException(
        'The object store refused aether’s request.',
      );
    }

    this.logger.warn(
      `loculus answered ${method} ${path} with ${response.status}: ${detail}`,
    );

    return new HttpException(
      detail || 'The object store refused the request.',
      response.status,
    );
  }
}
