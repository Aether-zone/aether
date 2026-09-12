import 'server-only';

import type {
  CreateGroupDTO,
  GroupDTO,
  UpdateGroupDTO,
} from '@aether/contract';

import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from './api';

/**
 * The organizations prosopone is holding.
 *
 * **Named for the domain, because `lib/organizations.ts` already exists** and
 * means something else: it lists the organizations the signed-in person
 * *belongs to* — the tenants, from the token's `orgs` claim — and exports its
 * own `Organization` type.
 *
 * These are groups somebody wrote down *inside* one of those: a client, a
 * community, a family. Two files whose names differed by a suffix would have
 * been a worse trap than one long name.
 */

const GROUPS = '/groups';

export function listGroups(): Promise<ApiResult<GroupDTO[]>> {
  return apiGet<GroupDTO[]>(GROUPS);
}

export function getGroup(id: string): Promise<ApiResult<GroupDTO>> {
  return apiGet<GroupDTO>(`${GROUPS}/${encodeURIComponent(id)}`);
}

export function createGroup(
  organization: CreateGroupDTO,
): Promise<ApiResult<GroupDTO>> {
  return apiPost<GroupDTO>(GROUPS, organization);
}

export function updateGroup(
  id: string,
  changes: UpdateGroupDTO,
): Promise<ApiResult<GroupDTO>> {
  return apiPatch<GroupDTO>(`${GROUPS}/${encodeURIComponent(id)}`, changes);
}

export function deleteGroup(id: string) {
  return apiDelete(`${GROUPS}/${encodeURIComponent(id)}`);
}
