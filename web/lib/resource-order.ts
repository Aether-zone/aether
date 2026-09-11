import type { ResourceDTO } from '@aether/contract';

/**
 * Reading and ordering a resource list.
 *
 * Pure, and deliberately not in `lib/resources.ts`, which is `server-only`:
 * these should be checkable without a session behind them.
 */

/**
 * Newest first.
 *
 * The opposite of every other list in aether, and the difference is what the
 * list is *for*. An idea list is a backlog you work down; a resource list is
 * an inbox — the thing that arrived most recently is the thing you have not
 * dealt with, and burying it under a year of filed material would mean
 * scrolling to find what you just added.
 */
export function byNewest(a: ResourceDTO, b: ResourceDTO): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * What to call a resource that never got a title.
 *
 * Most of them will not have one: a resource is filed the moment it arrives,
 * usually by something automated, and a title is a thing a person adds later.
 * A row reading "Untitled" eight times tells you nothing, so this falls back
 * through what the artefact actually has — the first line of its text, then
 * where it came from — before giving up.
 */
export function displayTitle(resource: ResourceDTO): string {
  if (resource.title) {
    return resource.title;
  }

  const firstLine = resource.content?.split('\n').find((line) => line.trim());

  if (firstLine) {
    return firstLine.trim().slice(0, 120);
  }

  return resource.url ?? resource.externalId ?? 'Untitled';
}

/** Whether `displayTitle` had to invent something, so the screen can say so. */
export function isUntitled(resource: ResourceDTO): boolean {
  return !resource.title;
}

/** The opening of the text, for a row that has room for one line of it. */
export function snippet(content: string | undefined, max = 160): string | null {
  if (!content) {
    return null;
  }

  const flat = content.replace(/\s+/g, ' ').trim();

  if (!flat) {
    return null;
  }

  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** "3 Feb 2026, 14:20", in the reader's zone rather than the api's. */
export function formatMoment(iso: string): string {
  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? '—'
    : at.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}
