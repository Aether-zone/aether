/**
 * Routing keys telos publishes under.
 *
 * Named constants rather than string literals at each call site, because a
 * publisher and a subscriber that disagree about a key fail *silently*: the
 * message reaches the exchange, matches no binding, and is dropped. Nothing
 * errors and nothing arrives.
 *
 * Four resources rather than one, and each announces separately. A single
 * `telos.changed` would force every consumer to open the payload before it
 * could decide whether it cared, which is exactly the work a routing key
 * exists to save them.
 */

export const IDEA_CREATED = 'idea.created';
export const IDEA_UPDATED = 'idea.updated';
export const IDEA_DELETED = 'idea.deleted';

export const GOAL_CREATED = 'goal.created';
export const GOAL_UPDATED = 'goal.updated';
export const GOAL_DELETED = 'goal.deleted';

export const PROJECT_CREATED = 'project.created';
export const PROJECT_UPDATED = 'project.updated';
export const PROJECT_DELETED = 'project.deleted';

export const TASK_CREATED = 'task.created';
export const TASK_UPDATED = 'task.updated';
export const TASK_DELETED = 'task.deleted';
