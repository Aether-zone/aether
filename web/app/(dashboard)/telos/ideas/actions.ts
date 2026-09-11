'use server';

import { createIdeaSchema, updateIdeaSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';

import type { ApiFailure } from '@/lib/api';
import { createIdea, deleteIdea, updateIdea } from '@/lib/ideas';

const IDEAS = '/telos/ideas';

/**
 * Both the list and the one.
 *
 * A change made on the detail page has to reach the list behind it, and a
 * change made on the list has to reach a detail page cached from earlier —
 * otherwise going back shows what was true before the edit, which reads as the
 * edit having failed.
 */
function revalidateIdea(id: string): void {
  revalidatePath(IDEAS);
  revalidatePath(`${IDEAS}/${id}`);
}

export type IdeaFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFormResult(failure: ApiFailure): IdeaFormResult {
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
        'You do not belong to an organization, and ideas are kept per organization.',
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
 * Captures one.
 *
 * Takes the whole shape rather than a title, because an idea can now name the
 * people it involves — and `involves` has to survive the round trip from the
 * dialog, not be rebuilt here from a string.
 */
export async function addIdeaAction(idea: unknown): Promise<IdeaFormResult> {
  const parsed = createIdeaSchema.safeParse(idea);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await createIdea(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(IDEAS);

  return {};
}

/**
 * Changes one in place — promoting it, dropping it, ranking it.
 *
 * The same action for all three because they are the same request: the list
 * is the editor, and a separate screen for changing one field would be more
 * ceremony than the change deserves.
 */
export async function changeIdeaAction(
  id: string,
  changes: unknown,
): Promise<IdeaFormResult> {
  const parsed = updateIdeaSchema.safeParse(changes);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await updateIdea(id, parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateIdea(id);

  return {};
}

export async function removeIdeaAction(id: string): Promise<IdeaFormResult> {
  const result = await deleteIdea(id);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateIdea(id);

  return {};
}
