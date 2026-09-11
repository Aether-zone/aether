/**
 * The trail to a page, worked out from its path.
 *
 * Pure, and deliberately not in a `server-only` module: this is the piece with
 * the rules in it, and it should be checkable without a session behind it.
 *
 * Derived rather than declared per page, for the reason every derived thing in
 * this console is derived — a hand-written trail is a second copy of the route
 * table, and the copy is wrong the first time a page moves. The labels come
 * from the sidebar's own items, so a page renamed there is renamed here.
 *
 * The domain crumb is the capitalised first segment, which is not a shortcut:
 * `/telos/ideas` sits under a sidebar group headed "Telos", and the segment
 * *is* the group. Writing the nine group names down again here would be the
 * copy this avoids.
 *
 * The sidebar's labels are reached through a `labelFor` passed in rather than
 * imported. `nav.tsx` carries JSX icons, and importing it here would drag a
 * component tree into a module whose whole value is being plain enough to run
 * on its own.
 */

export type Crumb = {
  label: string;
  /** Absent on the last one, which is where you already are. */
  href?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `events` -> `Events`, `out-of-office` -> `Out of office`. */
function humanise(segment: string): string {
  const words = segment.replace(/-/g, ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The crumbs for a path, root first.
 *
 * `leaf` names the last one where the path cannot: a record's id says nothing
 * to a reader, so a detail page passes the title it is already showing. Given
 * no leaf, an id segment is **dropped** rather than printed — a trail ending
 * in a uuid is worse than one ending at the list the record came from.
 */
export function trailFor(
  pathname: string,
  {
    leaf,
    labelFor = () => undefined,
  }: {
    leaf?: string;
    /** What the sidebar calls this route, where it has a name for it. */
    labelFor?: (href: string) => string | undefined;
  } = {},
): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);

  // No root crumb. The trail starts at the domain — `Telos / Ideas / …` —
  // because an "Aether" first crumb links to a home page the sidebar already
  // offers on every screen, and spends the reader's first glance on the one
  // word that is true of every page in the console.
  const crumbs: Crumb[] = [];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const last = index === segments.length - 1;

    if (last && leaf) {
      crumbs.push({ label: leaf, href });

      return;
    }

    // An id with nothing to call it. The list it came from is the honest end
    // of the trail; the page's own heading says which record this is.
    if (UUID.test(segment)) {
      return;
    }

    crumbs.push({ label: labelFor(href) ?? humanise(segment), href });
  });

  if (crumbs.length === 0) {
    return [];
  }

  // Where you already are is not a link.
  const current = crumbs[crumbs.length - 1];

  return [...crumbs.slice(0, -1), { label: current.label }];
}
