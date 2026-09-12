import 'server-only';

import type {
  CreatePresignedUploadDTO,
  FileDTO,
  CreateResourceDTO,
  PreparedUploadDTO,
  ResourceDTO,
  UpdateResourceDTO,
} from '@aether/contract';

import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from './api';

/** The resources tekmerion is holding. */

const RESOURCES = '/resources';

export function listResources(): Promise<ApiResult<ResourceDTO[]>> {
  return apiGet<ResourceDTO[]>(RESOURCES);
}

export function getResource(id: string): Promise<ApiResult<ResourceDTO>> {
  return apiGet<ResourceDTO>(`${RESOURCES}/${encodeURIComponent(id)}`);
}

export function createResource(
  resource: CreateResourceDTO,
): Promise<ApiResult<ResourceDTO>> {
  return apiPost<ResourceDTO>(RESOURCES, resource);
}

export function updateResource(
  id: string,
  changes: UpdateResourceDTO,
): Promise<ApiResult<ResourceDTO>> {
  return apiPatch<ResourceDTO>(
    `${RESOURCES}/${encodeURIComponent(id)}`,
    changes,
  );
}

/**
 * Asks the api where a file may be uploaded.
 *
 * The URL that comes back is spent by the *browser*, not here — which is the
 * whole point of presigning. This call carries nothing but the file's name,
 * type and size.
 */
export function presignUpload(
  request: CreatePresignedUploadDTO,
): Promise<ApiResult<PreparedUploadDTO>> {
  return apiPost<PreparedUploadDTO>(`${RESOURCES}/presign`, request);
}

/** What is known about a stored file — its status above all. */
export function getFile(fileId: string): Promise<ApiResult<FileDTO>> {
  return apiGet<FileDTO>(`${RESOURCES}/files/${encodeURIComponent(fileId)}`);
}

/**
 * Somewhere to read the bytes back from.
 *
 * Asked for at the moment somebody clicks. The URL expires, so one minted with
 * the page would stop working while the reader was still looking at it.
 */
export function fileDownloadUrl(fileId: string) {
  return apiGet<{ downloadUrl: string }>(
    `${RESOURCES}/files/${encodeURIComponent(fileId)}/download`,
  );
}

/** Records that the bytes arrived. */
export function markUploaded(fileId: string) {
  return apiPost(
    `${RESOURCES}/files/${encodeURIComponent(fileId)}/uploaded`,
    {},
  );
}

export function deleteResource(id: string) {
  return apiDelete(`${RESOURCES}/${encodeURIComponent(id)}`);
}
