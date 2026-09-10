/**
 * Routing keys topos publishes under.
 *
 * Named constants rather than string literals at each call site, because a
 * publisher and a subscriber that disagree about a key fail *silently*: the
 * message reaches the exchange, matches no binding, and is dropped. Nothing
 * errors and nothing arrives.
 */
export const PLACE_CREATED = 'place.created';
export const PLACE_UPDATED = 'place.updated';
export const PLACE_DELETED = 'place.deleted';
