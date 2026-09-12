'use server';

import { createUserSchema, updateUserSchema } from '@aether/contract';
import { revalidatePath } from 'next/cache';
import type { ZodType, z } from 'zod';

import { createUser, deleteUser, updateUser } from '@/lib/users';
import type { ApiFailure } from '@/lib/api';

const PEOPLE = '/prosopone/people';

/**
 * What a form gets back.
 *
 * `fieldErrors` is keyed by field so a message lands under the input that
 * caused it; `error` is for everything with no field to blame. Both, rather
 * than one string, because "that email is already taken" belongs next to the
 * email box and "the api is down" does not.
 */
export type UserFormResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Turns an api refusal into something a form can render.
 *
 * The api validates with the same schemas this file does, so its per-field
 * messages are the authoritative ones — a 409 on a duplicate email is a fact
 * only the server knows, and it arrives here as `body.errors` or a message.
 */
function toFormResult(failure: ApiFailure): UserFormResult {
  const fieldErrors: Record<string, string> = {};

  for (const issue of failure.body?.errors ?? []) {
    if (issue.path && issue.message) {
      fieldErrors[issue.path] = issue.message;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  if (failure.reason === 'unauthenticated') {
    return { error: 'Your session has expired. Sign in again.' };
  }

  if (failure.reason === 'noOrganization') {
    return {
      error:
        'You do not belong to an organization, and people are kept per organization.',
    };
  }

  if (failure.reason === 'unavailable') {
    return { error: 'The aether api did not answer. Try again in a moment.' };
  }

  return {
    error:
      failure.body?.message ??
      failure.body?.detail ??
      'That could not be saved.',
  };
}

/**
 * Validates here as well as on the server.
 *
 * Not redundant: this catches a typo before a round trip and puts the message
 * under the right input, while the api's check is the one that actually
 * protects the store — a form is not a security boundary. Both read the same
 * schema, so they cannot disagree about what is valid.
 */
function validate<S extends ZodType>(
  schema: S,
  input: unknown,
):
  | { data: z.infer<S>; fieldErrors?: undefined }
  | { data?: undefined; fieldErrors: Record<string, string> } {
  /*
   * Generic over the schema rather than taking a union of the two. A union
   * parameter makes the *result* a union too, and TypeScript then narrows it
   * to the loosest member — the partial update shape — so `addUserAction`
   * ended up handing the api a create body with every field optional.
   */
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return { data: parsed.data as z.infer<S> };
  }

  const fieldErrors: Record<string, string> = {};

  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.');

    // First message per field: later ones are usually consequences of the
    // first, and a box can only show one.
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }

  return { fieldErrors };
}

export async function addUserAction(input: unknown): Promise<UserFormResult> {
  const { data, fieldErrors } = validate(createUserSchema, input);

  if (!data) {
    return { fieldErrors };
  }

  const result = await createUser(data);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(PEOPLE);

  return {};
}

export async function editUserAction(
  id: string,
  input: unknown,
): Promise<UserFormResult> {
  const { data, fieldErrors } = validate(updateUserSchema, input);

  if (!data) {
    return { fieldErrors };
  }

  const result = await updateUser(id, data);

  if (!result.ok) {
    return toFormResult(result);
  }

  /*
   * Both the list and the one. A change made on the detail page has to reach
   * the list behind it, and a change made on the list has to reach a detail
   * page cached from earlier — otherwise going back shows what was true before
   * the edit, which reads as the edit having failed.
   */
  revalidatePath(PEOPLE);
  revalidatePath(`${PEOPLE}/${id}`);

  return {};
}

export async function removeUserAction(id: string): Promise<UserFormResult> {
  const result = await deleteUser(id);

  if (!result.ok) {
    return toFormResult(result);
  }

  revalidatePath(PEOPLE);

  return {};
}
