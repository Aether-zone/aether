/**
 * The resources topos is responsible for.
 *
 * A place is somewhere with a name, an address is how post reaches it, a
 * location is a point on the ground. One building can have all three and they
 * change independently.
 *
 * A list of names rather than entities: the console's screens for these are
 * placeholders that call no api, so the one thing actually settled is *which
 * resources this domain owns*. Writing down a schema before there is a screen
 * that needs it would be inventing the domain rather than recording it.
 */
export const TOPOS_RESOURCES = ['Place', 'Address', 'Location'] as const;

export type ToposResource = (typeof TOPOS_RESOURCES)[number];
