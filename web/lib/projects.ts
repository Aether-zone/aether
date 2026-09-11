import 'server-only';

import type {
  CreateProjectDTO,
  ProjectDTO,
  UpdateProjectDTO,
} from '@aether/contract';

import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from './api';

/** The projects telos is holding. */

const PROJECTS = '/projects';

export function listProjects(): Promise<ApiResult<ProjectDTO[]>> {
  return apiGet<ProjectDTO[]>(PROJECTS);
}

export function getProject(id: string): Promise<ApiResult<ProjectDTO>> {
  return apiGet<ProjectDTO>(`${PROJECTS}/${encodeURIComponent(id)}`);
}

export function createProject(
  project: CreateProjectDTO,
): Promise<ApiResult<ProjectDTO>> {
  return apiPost<ProjectDTO>(PROJECTS, project);
}

export function updateProject(
  id: string,
  changes: UpdateProjectDTO,
): Promise<ApiResult<ProjectDTO>> {
  return apiPatch<ProjectDTO>(`${PROJECTS}/${encodeURIComponent(id)}`, changes);
}

export function deleteProject(id: string) {
  return apiDelete(`${PROJECTS}/${encodeURIComponent(id)}`);
}
