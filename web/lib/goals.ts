import 'server-only';

import type { CreateGoalDTO, GoalDTO, UpdateGoalDTO } from '@aether/contract';

import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from './api';

/** The goals telos is holding. */

const GOALS = '/goals';

export function listGoals(): Promise<ApiResult<GoalDTO[]>> {
  return apiGet<GoalDTO[]>(GOALS);
}

export function getGoal(id: string): Promise<ApiResult<GoalDTO>> {
  return apiGet<GoalDTO>(`${GOALS}/${encodeURIComponent(id)}`);
}

export function createGoal(goal: CreateGoalDTO): Promise<ApiResult<GoalDTO>> {
  return apiPost<GoalDTO>(GOALS, goal);
}

export function updateGoal(
  id: string,
  changes: UpdateGoalDTO,
): Promise<ApiResult<GoalDTO>> {
  return apiPatch<GoalDTO>(`${GOALS}/${encodeURIComponent(id)}`, changes);
}

export function deleteGoal(id: string) {
  return apiDelete(`${GOALS}/${encodeURIComponent(id)}`);
}
