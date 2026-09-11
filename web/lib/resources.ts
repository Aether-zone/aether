import 'server-only';

import type {
  CreateResourceDTO,
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

export function deleteResource(id: string) {
  return apiDelete(`${RESOURCES}/${encodeURIComponent(id)}`);
}
