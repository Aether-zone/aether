import 'server-only';

import type { CreateTaskDTO, TaskDTO, UpdateTaskDTO } from '@aether/contract';

import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from './api';

/** The tasks telos is holding. */

const TASKS = '/tasks';

export function listTasks(): Promise<ApiResult<TaskDTO[]>> {
  return apiGet<TaskDTO[]>(TASKS);
}

export function getTask(id: string): Promise<ApiResult<TaskDTO>> {
  return apiGet<TaskDTO>(`${TASKS}/${encodeURIComponent(id)}`);
}

export function createTask(task: CreateTaskDTO): Promise<ApiResult<TaskDTO>> {
  return apiPost<TaskDTO>(TASKS, task);
}

export function updateTask(
  id: string,
  changes: UpdateTaskDTO,
): Promise<ApiResult<TaskDTO>> {
  return apiPatch<TaskDTO>(`${TASKS}/${encodeURIComponent(id)}`, changes);
}

export function deleteTask(id: string) {
  return apiDelete(`${TASKS}/${encodeURIComponent(id)}`);
}
