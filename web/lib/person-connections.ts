import type {
  GoalDTO,
  IdeaDTO,
  ProjectDTO,
  ResourceDTO,
  TaskDTO,
} from '@aether/contract';

/**
 * Everything in the workspace that names a given person.
 *
 * Pure, and deliberately not `server-only`: this is the piece with the rule in
 * it — "does this record name them" — and it should be checkable without a
 * session behind it.
 *
 * **Read from the other end, and that is the only way it could work.** A
 * person holds no list of what they are involved in; every resource holds the
 * people it concerns. So this filters what has already been fetched rather
 * than asking a question no route answers.
 *
 * The cost is that the page reads five whole lists to show one person. That is
 * fine at this size and will not be forever — the fix is a route that asks the
 * question directly, not a column on the person that would have to be kept in
 * step with five other tables.
 */
export type Connections = {
  projects: ProjectDTO[];
  goals: GoalDTO[];
  tasks: TaskDTO[];
  ideas: IdeaDTO[];
  resources: ResourceDTO[];
};

const naming = <T extends { involves: string[] }>(
  records: T[],
  personId: string,
): T[] => records.filter((record) => record.involves.includes(personId));

export function connectionsOf(
  personId: string,
  everything: Connections,
): Connections {
  return {
    projects: naming(everything.projects, personId),
    goals: naming(everything.goals, personId),
    tasks: naming(everything.tasks, personId),
    ideas: naming(everything.ideas, personId),
    resources: naming(everything.resources, personId),
  };
}

/** Whether anything at all names them, so an empty card can be left out. */
export function hasAny(connections: Connections): boolean {
  return Object.values(connections).some((records) => records.length > 0);
}

/** "BJ" — the letters an avatar falls back to. */
export function initialsOf(first: string, last: string): string {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase();
}
