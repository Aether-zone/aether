'use server';

import { createTaskSchema, updateTaskSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';

import type { ApiFailure } from '@/lib/api';
import { createTask, deleteTask, updateTask } from '@/lib/tasks';

const TASKS = '/telos/tasks';

/**
 * The task list, and every project and goal page.
 *
 * A project's progress is counted from its tasks, and a goal's is counted from
 * the tasks in the projects pursuing it — so finishing one task changes what
 * two other kinds of page say, without anything having been written to either.
 *
 * `'layout'` reaches `/telos/projects/[id]` and `/telos/goals/[id]` for every
 * id. That breadth is what makes this correct rather than merely thorough:
 * when a task is *moved* between projects the page it left is as stale as the
 * one it joined, and only the id it joined is knowable here. The goal is not
 * knowable at all from a task — it is two links away.
 */
function revalidateTasks(): void {
  revalidatePath(TASKS);
  revalidatePath('/telos/projects', 'layout');
  revalidatePath('/telos/goals', 'layout');
}

export type TaskFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFormResult(failure: ApiFailure): TaskFormResult {
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
        'You do not belong to an organization, and tasks are kept per organization.',
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
 * Writes one down.
 *
 * A title is the whole of what is required, and the optional rest is passed
 * through so the same action serves the quick-capture field and a task started
 * from a project's page.
 */
export async function addTaskAction(task: unknown): Promise<TaskFormResult> {
  const parsed = createTaskSchema.safeParse(task);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await createTask(parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateTasks();

  return {};
}

/**
 * Changes one in place — moving it along, ranking it, filing it under a
 * project, giving it a deadline.
 *
 * One action for all of them because they are the same request: the list is
 * the editor, and a separate screen for changing one field would be more
 * ceremony than the change deserves.
 */
export async function changeTaskAction(
  id: string,
  changes: unknown,
): Promise<TaskFormResult> {
  const parsed = updateTaskSchema.safeParse(changes);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const result = await updateTask(id, parsed.data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateTasks();

  return {};
}

export async function removeTaskAction(id: string): Promise<TaskFormResult> {
  const result = await deleteTask(id);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidateTasks();

  return {};
}
