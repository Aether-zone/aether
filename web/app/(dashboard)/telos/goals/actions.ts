'use server';

import { createGoalSchema, updateGoalSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';

import type { ApiFailure } from '@/lib/api';
import { createGoal, deleteGoal, updateGoal } from '@/lib/goals';
import { toIsoInstant } from '@/lib/when';

const GOALS = '/telos/goals';

export type GoalFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFormResult(failure: ApiFailure): GoalFormResult {
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
        'You do not belong to an organization, and goals are kept per organization.',
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

    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }

  return fieldErrors;
}

/**
 * Sets a goal.
 *
 * The deadline arrives as a `date` field — "2026-03-31", no time and no zone.
 * It is read as the *end* of that day in the reader's zone, because a goal due
 * "by the 31st" is not due at midnight on the 30th; taking the bare date would
 * make every deadline a day early.
 */
export async function addGoalAction(input: {
  title: string;
  targetAt: string;
  description?: string;
  /** The ideas this goal came from, when it was set from one of them. */
  inspiredBy?: string[];
  involves?: string[];
  priority?: number;
}): Promise<GoalFormResult> {
  const targetAt = input.targetAt.trim()
    ? toIsoInstant(`${input.targetAt.trim()}T23:59`)
    : undefined;

  if (input.targetAt.trim() && !targetAt) {
    return { fieldErrors: { targetAt: 'That is not a date.' } };
  }

  const parsed = createGoalSchema.safeParse({
    title: input.title,
    ...(targetAt ? { targetAt } : {}),
    ...(input.description?.trim() ? { description: input.description } : {}),
    ...(input.inspiredBy?.length ? { inspiredBy: input.inspiredBy } : {}),
    ...(input.involves?.length ? { involves: input.involves } : {}),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await createGoal(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(GOALS);

  /*
   * An idea's `inspired` is derived from the goals naming it, so setting a
   * goal from an idea changes what that idea's page says without anything
   * having written to the idea. Nothing else would know to refresh it.
   */
  for (const ideaId of input.inspiredBy ?? []) {
    revalidatePath(`/telos/ideas/${ideaId}`);
  }

  if (input.inspiredBy?.length) {
    revalidatePath('/telos/ideas');
  }

  return {};
}

/** Changes one in place — completing it, abandoning it, moving the date. */
export async function changeGoalAction(
  id: string,
  changes: unknown,
): Promise<GoalFormResult> {
  const parsed = updateGoalSchema.safeParse(changes);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await updateGoal(id, parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(GOALS);

  return {};
}

export async function removeGoalAction(id: string): Promise<GoalFormResult> {
  const result = await deleteGoal(id);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(GOALS);

  return {};
}
