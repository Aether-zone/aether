/**
 * Routing keys chronos publishes under.
 *
 * Named constants rather than string literals at each call site, because a
 * publisher and a subscriber that disagree about a key fail *silently*: the
 * message reaches the exchange, matches no binding, and is dropped. Nothing
 * errors and nothing arrives.
 *
 * The file is `routing-keys.ts` and not `events.ts`, which is what prosopone
 * and topos call theirs. Here that name would sit one letter from `event.ts` —
 * the resource — and two files whose names differ by an `s`, one holding a
 * calendar entry and the other holding message keys, is a trap worth spending
 * an inconsistency to avoid.
 */
export const EVENT_CREATED = 'event.created';
export const EVENT_UPDATED = 'event.updated';
export const EVENT_DELETED = 'event.deleted';
