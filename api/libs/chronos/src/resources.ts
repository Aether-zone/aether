/**
 * The resources chronos is responsible for.
 *
 * A schedule is the rule and an event is one occurrence of it, which is why a
 * recurring meeting is one schedule and many events rather than a single
 * resource that has to mean both.
 *
 * A meeting is not a resource here: it is an `Event` whose `type` says
 * `MEETING`, alongside appointments, calls, deadlines and the rest. They share
 * every field that matters and all belong on one calendar, and "what is on
 * Tuesday" is a question a union of six tables cannot answer without six
 * queries and a merge. The shape lives in `@aether/contract`'s `chronos`
 * folder.
 *
 * A list of names rather than entities: the console's screens for these are
 * placeholders that call no api, so the one thing actually settled is *which
 * resources this domain owns*. Writing down a schema before there is a screen
 * that needs it would be inventing the domain rather than recording it.
 */
export const CHRONOS_RESOURCES = [
  'Calendar',
  'Event',
  'Schedule',
] as const;

export type ChronosResource = (typeof CHRONOS_RESOURCES)[number];
