/**
 * The resources tekmerion is responsible for.
 *
 * A resource here is the artefact itself. What it *means* is arachni’s
 * business and what it *says* is mneme’s; this is where it came from and
 * what it is.
 *
 * A list of names rather than entities: the console's screens for these are
 * placeholders that call no api, so the one thing actually settled is *which
 * resources this domain owns*. Writing down a schema before there is a screen
 * that needs it would be inventing the domain rather than recording it.
 */
export const TEKMERION_RESOURCES = [
  'Resource',
] as const;

export type TekmerionResource = (typeof TEKMERION_RESOURCES)[number];
