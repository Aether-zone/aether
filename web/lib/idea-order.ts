import type { IdeaDTO } from '@aether/contract';

/**
 * Ranked ideas first and in order, then everything unranked by age.
 *
 * Pure, and deliberately not in `lib/ideas.ts`, which is `server-only`: a
 * comparator is the kind of thing that should be checkable without a session
 * behind it, and `server-only` throws the moment anything else loads it.
 *
 * Sorting by priority alone would put the unranked majority at one end in
 * whatever order they happened to arrive, which reads as random. This keeps
 * the deliberate ordering where somebody made one, and falls back to "oldest
 * first" where nobody has.
 */
export function byPriorityThenAge(a: IdeaDTO, b: IdeaDTO): number {
  if (a.priority !== b.priority) {
    // Unranked sorts last, whatever it is compared against.
    if (a.priority === undefined) return 1;
    if (b.priority === undefined) return -1;

    return a.priority - b.priority;
  }

  return a.createdAt.localeCompare(b.createdAt);
}
