/**
 * The resources telos is responsible for.
 *
 * The chain is deliberate: an idea becomes a goal, a goal is pursued by a
 * project, a project is done through tasks. Each names the one above it.
 *
 * A list of names, kept as the one place that says what this domain owns.
 * All four now have a schema in the contract and a service behind them; the
 * list stays because "which resources are telos's" is a different question
 * from "which of them are built", and it is the one an event consumer or a
 * permissions check needs answered.
 */
export const TELOS_RESOURCES = [
  'Idea',
  'Goal',
  'Project',
  'Task',
] as const;

export type TelosResource = (typeof TELOS_RESOURCES)[number];
