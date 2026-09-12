/**
 * The resources prosopone is responsible for.
 *
 * A relationship is a resource in its own right rather than a field on a
 * person, because it carries facts belonging to neither end of it — when it
 * started, what kind it is.
 *
 * `Group` is a company, a community, a family — a set of people somebody
 * wrote down. It is called a group and not an organization because that word
 * is taken: `organizationId` means the tenant on every row in aether, and one
 * tenant holds many groups.
 *
 * `Relationship` has no schema yet; it is on this list because "which
 * resources are prosopone's" is a different question from "which of them are
 * built", and it is the one an event consumer or a permissions check needs
 * answered.
 */
export const PROSOPONE_RESOURCES = ['Person', 'Group', 'Relationship'] as const;

export type ProsoponeResource = (typeof PROSOPONE_RESOURCES)[number];
