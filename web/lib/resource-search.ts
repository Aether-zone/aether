import type { ResourceDTO, UserDTO } from '@aether/contract';

/**
 * Finding a resource in the list you already have.
 *
 * Pure, and deliberately not `server-only`: this runs in the browser as
 * somebody types, and a comparator that needed a session could not.
 *
 * **This matches words, not meaning.** The page says resources are searchable
 * by meaning rather than filename, and that is mneme's job — it holds the
 * embeddings and can answer "what did we decide about retries" for a document
 * that never uses the word "retries". Until this page asks mneme, what it does
 * is honest substring matching across everything a card shows: the title, the
 * description, the tags, and the names of the people it is about.
 *
 * Searching the same fields the card renders is the point. A result the reader
 * cannot see the reason for looks like a bug, and one that matched on hidden
 * content would be exactly that.
 */
export function matches(
  resource: ResourceDTO,
  query: string,
  people: UserDTO[],
): boolean {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  const names = resource.involves
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is UserDTO => person !== undefined)
    .map((person) => `${person.firstName} ${person.lastName}`);

  const haystack = [
    resource.title ?? '',
    resource.description ?? '',
    // Not `content`: a transcript would match almost any word, and every
    // result would look arbitrary.
    ...resource.tags,
    ...names,
  ]
    .join(' ')
    .toLowerCase();

  // Every word has to appear somewhere, in any order. Two words that each
  // narrow the list are what people type; a phrase match would find nothing
  // for "alice graph".
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

/** "42d ago", "today", or nothing for a date that will not parse. */
export function formatAge(iso: string): string | null {
  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) {
    return null;
  }

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(at)) / (1000 * 60 * 60 * 24),
  );

  if (days <= 0) {
    return 'today';
  }

  return `${days}d ago`;
}
