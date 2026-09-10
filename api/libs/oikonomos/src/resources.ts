/**
 * The resources oikonomos is responsible for.
 *
 * A subscription is a contract that recurs and an expense is a payment that
 * happened, so the three are separate resources rather than one carrying a
 * type field that changes what its other fields mean.
 *
 * A list of names rather than entities: the console's screens for these are
 * placeholders that call no api, so the one thing actually settled is *which
 * resources this domain owns*. Writing down a schema before there is a screen
 * that needs it would be inventing the domain rather than recording it.
 */
export const OIKONOMOS_RESOURCES = [
  'Asset',
  'Subscription',
  'Contract',
  'Expense',
] as const;

export type OikonomosResource = (typeof OIKONOMOS_RESOURCES)[number];
