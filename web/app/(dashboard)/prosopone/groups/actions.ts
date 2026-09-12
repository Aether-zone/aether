'use server';

import { createGroupSchema, updateGroupSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';

import type { ApiFailure } from '@/lib/api';
import { createGroup, deleteGroup, updateGroup } from '@/lib/groups';

const GROUPS = '/prosopone/groups';

export type GroupFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFormResult(failure: ApiFailure): GroupFormResult {
  const fieldErrors: Record<string, string> = {};

  for (const issue of failure.body?.errors ?? []) {
    if (issue.path && issue.message) {
      fieldErrors[issue.path] = issue.message;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  if (failure.reason === 'noOrganization') {
    return {
      error:
        'You do not belong to an organization, and groups are kept per organization.',
    };
  }

  if (failure.reason === 'unauthenticated') {
    return { error: 'Your session is no longer valid. Sign out and back in.' };
  }

  if (failure.reason === 'unavailable') {
    return { error: 'The aether api did not answer. Try again in a moment.' };
  }

  return { error: failure.body?.message ?? 'That could not be saved.' };
}

function fieldErrorsOf(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');

    // First message per field: later ones are usually consequences of the
    // first, and a box can only show one.
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }

  return fieldErrors;
}

/** Records one. A name is the whole of what is required. */
export async function addGroupAction(group: unknown): Promise<GroupFormResult> {
  const parsed = createGroupSchema.safeParse(group);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await createGroup(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(GROUPS);

  return {};
}

/** Changes one in place — renaming it, describing it, correcting its kind. */
export async function changeGroupAction(
  id: string,
  changes: unknown,
): Promise<GroupFormResult> {
  const parsed = updateGroupSchema.safeParse(changes);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await updateGroup(id, parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  /*
   * Both the list and the one. A change made on the detail page has to reach
   * the list behind it, and a change made on the list has to reach a detail
   * page cached from earlier — otherwise going back shows what was true before
   * the edit, which reads as the edit having failed.
   */
  revalidatePath(GROUPS);
  revalidatePath(`${GROUPS}/${id}`);

  return {};
}

export async function removeGroupAction(id: string): Promise<GroupFormResult> {
  const result = await deleteGroup(id);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(GROUPS);

  return {};
}
