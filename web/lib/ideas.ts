import 'server-only';

import type { CreateIdeaDTO, IdeaDTO, UpdateIdeaDTO } from '@aether/contract';

import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from './api';

/**
 * The ideas telos is holding.
 *
 * The types come from `@aether/contract`, which is what the api validates
 * against — so a field renamed there stops compiling here rather than becoming
 * an `undefined` the console renders as blank.
 */

const IDEAS = '/ideas';

export function listIdeas(): Promise<ApiResult<IdeaDTO[]>> {
  return apiGet<IdeaDTO[]>(IDEAS);
}

export function getIdea(id: string): Promise<ApiResult<IdeaDTO>> {
  return apiGet<IdeaDTO>(`${IDEAS}/${encodeURIComponent(id)}`);
}

export function createIdea(idea: CreateIdeaDTO): Promise<ApiResult<IdeaDTO>> {
  return apiPost<IdeaDTO>(IDEAS, idea);
}

export function updateIdea(
  id: string,
  changes: UpdateIdeaDTO,
): Promise<ApiResult<IdeaDTO>> {
  return apiPatch<IdeaDTO>(`${IDEAS}/${encodeURIComponent(id)}`, changes);
}

export function deleteIdea(id: string) {
  return apiDelete(`${IDEAS}/${encodeURIComponent(id)}`);
}
