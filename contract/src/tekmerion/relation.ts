import { z } from 'zod';

/**
 * What a resource can be related to, and how.
 *
 * Three predicates over one target set, because the distinction that matters
 * is not *what* is pointed at but *why*:
 *
 * - `about` — the resource's subject. A meeting transcript is about the people
 *   in the room and the project they were discussing.
 * - `relatedTo` — a connection worth recording that is not aboutness. The
 *   specification a transcript sits beside.
 * - `mentions` — named in passing. Weaker than both, and the one a machine
 *   fills in: an extractor reading text can honestly say a name appeared, and
 *   cannot honestly say the document was about it.
 *
 * Kept apart rather than folded into one `relations` array with a predicate
 * field, because they become three different edges in the graph and a query
 * for "what is this about" must not also return everything it happened to
 * name.
 */

/**
 * The kinds of thing a resource may point at.
 *
 * Each maps to an IRI scheme some other domain already mints, which is the
 * whole point: a reference has to land on the node prosopone or telos already
 * published, not on a second one beside it.
 *
 * **There is deliberately no `ORGANIZATION`.** In aether that word is taken —
 * `organizationId` is the tenant on every row — and the thing usually meant by
 * it is a `GROUP`, which prosopone defines as "a company, a community, a
 * family: a set of people somebody wrote down". Adding a seventh kind would
 * mint `urn:aether:organization:…` against a domain that does not exist and
 * put a second node in the graph for every company that already has one.
 */
export const RELATION_TARGET_KINDS = [
  'PERSON',
  'GROUP',
  'PROJECT',
  'GOAL',
  'TASK',
  'IDEA',
] as const;

export const relationTargetKindSchema = z.enum(RELATION_TARGET_KINDS);

export type RelationTargetKind = (typeof RELATION_TARGET_KINDS)[number];

/**
 * One end of a relation: what kind of thing, and which one.
 *
 * A kind *and* an id rather than a bare id, because the target set is
 * heterogeneous and an id alone cannot say which IRI to mint from it — two
 * domains both hand out uuids. Rather than a whole IRI, because a caller free
 * to write one is a caller free to write `urn:aether:person:../../x`, and the
 * scheme is aether's to decide rather than a client's to state.
 */
export const relationTargetSchema = z.object({
  kind: relationTargetKindSchema,
  id: z.uuid(),
});

export type RelationTargetDTO = z.infer<typeof relationTargetSchema>;

/**
 * The three relation arrays, as a resource carries them.
 *
 * Always present, possibly empty — the same choice `tags` and `involves` make,
 * so a consumer never has to distinguish "none" from "not sent".
 */
export const relationsSchema = z.object({
  about: z.array(relationTargetSchema),
  relatedTo: z.array(relationTargetSchema),
  mentions: z.array(relationTargetSchema),
});

/** Defaulted, so a resource filed without relations is still a whole one. */
export const relationsDefaultsSchema = z.object({
  about: z.array(relationTargetSchema).default([]),
  relatedTo: z.array(relationTargetSchema).default([]),
  mentions: z.array(relationTargetSchema).default([]),
});

/**
 * The whole set, replaced.
 *
 * Sending `[]` removes every relation of that kind, which is why none of these
 * is nullable: the empty array already says it, exactly as for `tags`.
 */
export const relationsUpdateSchema = z.object({
  about: z.array(relationTargetSchema).optional(),
  relatedTo: z.array(relationTargetSchema).optional(),
  mentions: z.array(relationTargetSchema).optional(),
});
