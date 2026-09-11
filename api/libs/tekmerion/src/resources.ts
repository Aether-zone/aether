/**
 * The resources tekmerion is responsible for.
 *
 * A resource here is the artefact itself. What it *means* is arachni’s
 * business and what it *says* is mneme’s; this is where it came from and
 * what it is.
 *
 * A list of names, kept as the one place that says what this domain owns.
 * `Resource` now has a schema in the contract and a service behind it; the
 * list stays because "which resources are tekmerion's" is a different
 * question from "which of them are built", and it is the one an event
 * consumer or a permissions check needs answered.
 */
export const TEKMERION_RESOURCES = ['Resource'] as const;

export type TekmerionResource = (typeof TEKMERION_RESOURCES)[number];
