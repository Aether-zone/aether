import 'server-only';

import type { CreateUserDTO, UpdateUserDTO, UserDTO } from '@aether/contract';

import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from './api';

/**
 * The people prosopone knows about.
 *
 * The types come from `@aether/contract`, which is also what the api validates
 * against — so a field renamed there stops compiling here rather than becoming
 * an `undefined` the console renders as blank.
 *
 * These paths carry no organization, unlike akouo's: the api's user store is
 * in memory and not yet tenant-scoped. When it is, the prefix belongs in
 * `lib/api.ts`'s resolver rather than at each call site here.
 */

const USERS = '/users';

export function listUsers(): Promise<ApiResult<UserDTO[]>> {
  return apiGet<UserDTO[]>(USERS);
}

export function getUser(id: string): Promise<ApiResult<UserDTO>> {
  return apiGet<UserDTO>(`${USERS}/${encodeURIComponent(id)}`);
}

export function createUser(user: CreateUserDTO): Promise<ApiResult<UserDTO>> {
  return apiPost<UserDTO>(USERS, user);
}

/** Sends only what changed; an absent field means "leave it alone". */
export function updateUser(
  id: string,
  changes: UpdateUserDTO,
): Promise<ApiResult<UserDTO>> {
  return apiPatch<UserDTO>(`${USERS}/${encodeURIComponent(id)}`, changes);
}

export function deleteUser(id: string) {
  return apiDelete(`${USERS}/${encodeURIComponent(id)}`);
}

/** "Ada Lovelace", for a table cell and an avatar's tooltip. */
export function fullName(user: UserDTO): string {
  return `${user.firstName} ${user.lastName}`;
}
