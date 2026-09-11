/**
 * The resources prosopone is responsible for.
 *
 * A relationship is a resource in its own right rather than a field on a
 * person, because it carries facts belonging to neither end of it — when it
 * started, what kind it is.
 *
 * A list of names rather than entities: the console's screens for these are
 * placeholders that call no api, so the one thing actually settled is *which
 * resources this domain owns*. Writing down a schema before there is a screen
 * that needs it would be inventing the domain rather than recording it.
 */
export const PROSOPONE_RESOURCES = ['Person', 'Relationship'] as const;

export type ProsoponeResource = (typeof PROSOPONE_RESOURCES)[number];
