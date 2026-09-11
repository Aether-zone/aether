import type { UserDTO } from '@aether/contract';

/**
 * Rendering a person's name.
 *
 * Pure, and deliberately not in `lib/users.ts`, which is `server-only`: an
 * avatar is drawn in the browser, and a name formatter the client cannot
 * import is a name formatter that gets written twice.
 */

/** "Ada Lovelace", for a row and an avatar's tooltip. */
export function fullName(user: UserDTO): string {
  return `${user.firstName} ${user.lastName}`;
}

/**
 * "AL" — the letters an avatar falls back to.
 *
 * First letter of each name rather than the first two of the surname, because
 * a stack of avatars is read as a set of people and initials that share a
 * prefix stop separating. Upper-cased here rather than in CSS so the value is
 * the same wherever it is used, including a `title` attribute.
 */
export function initials(user: UserDTO): string {
  const first = user.firstName.trim().charAt(0);
  const last = user.lastName.trim().charAt(0);

  return `${first}${last}`.toUpperCase() || '?';
}
