'use server';

import { createResourceSchema, updateResourceSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';

import type { ApiFailure } from '@/lib/api';
import {
  createResource,
  deleteResource,
  updateResource,
} from '@/lib/resources';

const RESOURCES = '/tekmerion/resources';

/**
 * Both the list and the one.
 *
 * A change made on the detail page has to reach the list behind it, and a
 * change made on the list has to reach a detail page cached from earlier —
 * otherwise going back shows what was true before the edit, which reads as the
 * edit having failed.
 */
function revalidateResource(id: string): void {
  revalidatePath(RESOURCES);
  revalidatePath(`${RESOURCES}/${id}`);
}

export type ResourceFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFormResult(failure: ApiFailure): ResourceFormResult {
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
        'You do not belong to an organization, and resources are kept per organization.',
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

/**
 * Files one.
 *
 * Takes the whole shape rather than a title, because a resource's one required
 * field is its *kind* — and unlike an idea, most of what makes a resource
 * worth filing arrives with it rather than being typed afterwards.
 */
export async function addResourceAction(
  resource: unknown,
): Promise<ResourceFormResult> {
  const parsed = createResourceSchema.safeParse(resource);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await createResource(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(RESOURCES);

  return {};
}

/**
 * Changes one in place — retitling it, correcting its kind, writing down what
 * it is for.
 */
export async function changeResourceAction(
  id: string,
  changes: unknown,
): Promise<ResourceFormResult> {
  const parsed = updateResourceSchema.safeParse(changes);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await updateResource(id, parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateResource(id);

  return {};
}

export async function removeResourceAction(
  id: string,
): Promise<ResourceFormResult> {
  const result = await deleteResource(id);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateResource(id);

  return {};
}
