/**
 * Routing keys prosopone publishes under.
 *
 * Named constants rather than string literals at each call site, because a
 * publisher and a subscriber that disagree about a key fail *silently*: the
 * message reaches the exchange, matches no binding, and is dropped. Nothing
 * errors and nothing arrives.
 *
 * In the contract rather than the library, so a consumer can bind to the key
 * without depending on the api that emits it.
 */
export const PERSON_CREATED = 'person.created';
export const PERSON_UPDATED = 'person.updated';
export const PERSON_DELETED = 'person.deleted';

/**
 * What aether puts in an event's `source`.
 *
 * An IRI rather than the bare name: `source` identifies the producer across
 * the whole workspace, and a bare word is only unique by luck.
 */
export const AETHER_SOURCE = 'https://aether.zone/aether';
