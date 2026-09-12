'use server';

import { createProjectSchema, updateProjectSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';

import type { ApiFailure } from '@/lib/api';
import { createProject, deleteProject, updateProject } from '@/lib/projects';
import { toIsoInstant } from '@/lib/when';

const PROJECTS = '/telos/projects';

/**
 * The project list, and every goal page.
 *
 * A goal's `realizedBy` and its progress are both read from the projects
 * naming it, so any project write changes what some goal's page says without
 * anything having been written to the goal.
 *
 * The whole goals layout rather than the ids in hand: changing a project's
 * `pursues` or deleting it moves progress on the goal it *left*, and that id
 * is not knowable from the change.
 */
function revalidateProjects(): void {
  revalidatePath(PROJECTS);
  revalidatePath('/telos/goals', 'layout');
}

export type ProjectFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFormResult(failure: ApiFailure): ProjectFormResult {
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
        'You do not belong to an organization, and projects are kept per organization.',
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
 * Starts a project.
 *
 * The deadline arrives as a `date` field — "2026-03-31", no time and no zone.
 * It is read as the *end* of that day in the reader's zone, because work due
 * "by the 31st" is not due at midnight on the 30th; taking the bare date would
 * make every deadline a day early.
 */
export async function addProjectAction(input: {
  title: string;
  targetAt: string;
  description?: string;
  /** The goals this project is meant to reach, when started from one. */
  pursues?: string[];
  involves?: string[];
  priority?: number;
}): Promise<ProjectFormResult> {
  const targetAt = input.targetAt.trim()
    ? toIsoInstant(`${input.targetAt.trim()}T23:59`)
    : undefined;

  if (input.targetAt.trim() && !targetAt) {
    return { fieldErrors: { targetAt: 'That is not a date.' } };
  }

  const parsed = createProjectSchema.safeParse({
    title: input.title,
    ...(targetAt ? { targetAt } : {}),
    ...(input.description?.trim() ? { description: input.description } : {}),
    ...(input.pursues?.length ? { pursues: input.pursues } : {}),
    ...(input.involves?.length ? { involves: input.involves } : {}),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await createProject(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateProjects();

  return {};
}

/** Changes one in place — completing it, abandoning it, moving the date. */
export async function changeProjectAction(
  id: string,
  changes: unknown,
): Promise<ProjectFormResult> {
  const parsed = updateProjectSchema.safeParse(changes);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await updateProject(id, parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateProjects();

  return {};
}

export async function removeProjectAction(
  id: string,
): Promise<ProjectFormResult> {
  const result = await deleteProject(id);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateProjects();

  return {};
}
