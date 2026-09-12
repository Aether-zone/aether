/**
 * Routing keys tekmerion publishes under.
 *
 * Named constants rather than string literals at each call site, because a
 * publisher and a subscriber that disagree about a key fail *silently*: the
 * message reaches the exchange, matches no binding, and is dropped. Nothing
 * errors and nothing arrives.
 *
 * These are the keys with the most waiting readers of any in aether: a
 * resource is what mneme indexes and what arachni relates everything else to.
 */
export const RESOURCE_CREATED = 'resource.created';
export const RESOURCE_UPDATED = 'resource.updated';
export const RESOURCE_DELETED = 'resource.deleted';
