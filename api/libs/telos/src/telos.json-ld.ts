import type { GoalDTO, IdeaDTO, ProjectDTO, TaskDTO } from '@aether/contract';
import type { JsonLdDocument } from '@aether-zone/organon';

/**
 * Telos's resources as the rest of aether-zone sees them.
 *
 * Not the DTOs. Those are aether's HTTP shapes, and putting one on the bus
 * would make every consumer depend on this api's idea of a goal. These are the
 * same things described in a vocabulary anything can read, keyed by an IRI
 * rather than a bare uuid — which is what lets arachni relate a task to the
 * project it belongs to without knowing where either came from.
 */

/** The vocabulary aether-zone publishes under. */
export const AETHER_VOCAB = 'https://aether.zone/vocab/';

/**
 * The terms every telos document shares.
 *
 * Inline rather than a URL: a remote context has to be fetched before a
 * document can be read, which would turn every consumer into an HTTP client
 * and this service into their dependency.
 */
const SHARED_CONTEXT = {
  aether: AETHER_VOCAB,
  title: 'aether:title',
  description: 'aether:description',
  status: 'aether:status',
} as const;

const SCHEDULED_CONTEXT = {
  startsAt: 'aether:startsAt',
  targetAt: 'aether:targetAt',
} as const;

export const IDEA_CONTEXT = {
  ...SHARED_CONTEXT,
  priority: 'aether:priority',
  involves: 'aether:involves',
} as const;

export const GOAL_CONTEXT = {
  ...SHARED_CONTEXT,
  ...SCHEDULED_CONTEXT,
  inspiredBy: 'aether:inspiredBy',
  involves: 'aether:involves',
  priority: 'aether:priority',
} as const;

export const PROJECT_CONTEXT = {
  ...SHARED_CONTEXT,
  ...SCHEDULED_CONTEXT,
  pursues: 'aether:pursues',
  involves: 'aether:involves',
  priority: 'aether:priority',
} as const;

export const TASK_CONTEXT = {
  ...SHARED_CONTEXT,
  priority: 'aether:priority',
  dueAt: 'aether:dueAt',
  closedAt: 'aether:closedAt',
  project: 'aether:project',
  involves: 'aether:involves',
} as const;

/**
 * The IRIs these resources are known by outside aether.
 *
 * URNs rather than URLs: they name the resource without promising anything
 * answers if you fetch it, which is the honest claim for an id on a bus.
 */
export const ideaIri = (id: string): string => `urn:aether:idea:${id}`;

/**
 * The IRI prosopone knows a person by.
 *
 * Restated here rather than imported from `@aether/prosopone`, which would
 * make telos depend on another domain for one string. The rule is the shared
 * one every service mints people under — akouo included — so the two agreeing
 * is the point, not a coincidence.
 */
export const personIri = (id: string): string => `urn:aether:person:${id}`;
export const goalIri = (id: string): string => `urn:aether:goal:${id}`;
export const projectIri = (id: string): string => `urn:aether:project:${id}`;
export const taskIri = (id: string): string => `urn:aether:task:${id}`;

/** A pointer at a resource described elsewhere, which may not have arrived yet. */
const ref = (iri: string) => ({ '@id': iri });

export interface IdeaJsonLD extends JsonLdDocument {
  '@type': 'aether:Idea';
  '@context': typeof IDEA_CONTEXT;

  title: string;
  description?: string;
  status: string;
  priority?: number;
  involves?: { '@id': string }[];
}

export interface GoalJsonLD extends JsonLdDocument {
  '@type': 'aether:Goal';
  '@context': typeof GOAL_CONTEXT;

  title: string;
  description?: string;
  status: string;
  startsAt?: string;
  targetAt?: string;
  inspiredBy?: { '@id': string }[];
  involves?: { '@id': string }[];
  priority?: number;
}

export interface ProjectJsonLD extends JsonLdDocument {
  '@type': 'aether:Project';
  '@context': typeof PROJECT_CONTEXT;

  title: string;
  description?: string;
  status: string;
  startsAt?: string;
  targetAt?: string;
  pursues?: { '@id': string }[];
  involves?: { '@id': string }[];
  priority?: number;
}

export interface TaskJsonLD extends JsonLdDocument {
  '@type': 'aether:Task';
  '@context': typeof TASK_CONTEXT;

  title: string;
  description?: string;
  status: string;
  priority?: number;
  dueAt?: string;
  closedAt?: string;
  project?: { '@id': string };
  involves?: { '@id': string }[];
}

/**
 * An idea as a JSON-LD document.
 *
 * **`inspired` is deliberately not here**, though the DTO carries it. That
 * link is owned by the goal and published as its `inspiredBy`; announcing it
 * from both ends would put the same fact on the bus twice, from two records
 * that are written at different moments and can therefore disagree. A
 * consumer building a graph gets the edge either way.
 *
 * `involves` **is** published, unlike `inspired`, and the difference is which
 * end owns the fact. Nobody but this idea records who it is about, so if this
 * document does not say it, nothing on the bus ever will.
 *
 * They are references rather than nested people, for the reason every
 * reference here is one: a person outlives the idea that mentions them, and
 * nesting would tell a consumer they are part of it — which is what decides
 * whether they get deleted along with it.
 *
 * Optional fields are omitted when absent rather than sent as null — absent
 * means "not stated", where null would assert the idea has no priority.
 */
export function toIdeaDocument(idea: Omit<IdeaDTO, 'inspired'>): IdeaJsonLD {
  return {
    '@context': IDEA_CONTEXT,
    '@id': ideaIri(idea.id),
    '@type': 'aether:Idea',
    title: idea.title,
    ...(idea.description ? { description: idea.description } : {}),
    status: idea.status,
    ...(idea.priority === undefined ? {} : { priority: idea.priority }),
    // Omitted when empty: an empty list asserts "this is about nobody", which
    // is a different claim from not mentioning it.
    ...(idea.involves.length > 0
      ? { involves: idea.involves.map((id) => ref(personIri(id))) }
      : {}),
  };
}

/**
 * A goal as a JSON-LD document.
 *
 * `inspiredBy` is a list of references rather than nested ideas: the ideas are
 * resources in their own right that outlive this goal, and nesting them would
 * tell a consumer they are parts of it — which is what decides whether they
 * get deleted along with it.
 *
 * `realizedBy` and `progress` are **not** published, for the reason
 * `Idea.inspired` is not: both are read from the projects that name this goal,
 * and each of those announces its own `pursues` while each task announces
 * itself. A consumer can do the same arithmetic on what it already has, where
 * a number published here would be a second copy going stale between task
 * events.
 */
export function toGoalDocument(
  goal: Omit<GoalDTO, 'realizedBy' | 'progress'>,
): GoalJsonLD {
  return {
    '@context': GOAL_CONTEXT,
    '@id': goalIri(goal.id),
    '@type': 'aether:Goal',
    title: goal.title,
    ...(goal.description ? { description: goal.description } : {}),
    status: goal.status,
    ...(goal.startsAt ? { startsAt: goal.startsAt } : {}),
    ...(goal.targetAt ? { targetAt: goal.targetAt } : {}),
    // Omitted when empty: an empty list asserts "nothing inspired this", which
    // is a different claim from not mentioning it.
    ...(goal.inspiredBy.length > 0
      ? { inspiredBy: goal.inspiredBy.map((id) => ref(ideaIri(id))) }
      : {}),
    // Published like an idea's, and for the same reason: nobody but this goal
    // records who it is about.
    ...(goal.involves.length > 0
      ? { involves: goal.involves.map((id) => ref(personIri(id))) }
      : {}),
    ...(goal.priority === undefined ? {} : { priority: goal.priority }),
  };
}

export function toProjectDocument(
  project: Omit<ProjectDTO, 'tasks'>,
): ProjectJsonLD {
  return {
    '@context': PROJECT_CONTEXT,
    '@id': projectIri(project.id),
    '@type': 'aether:Project',
    title: project.title,
    ...(project.description ? { description: project.description } : {}),
    status: project.status,
    ...(project.startsAt ? { startsAt: project.startsAt } : {}),
    ...(project.targetAt ? { targetAt: project.targetAt } : {}),
    // The chain's third link, announced by the end that owns it.
    ...(project.pursues.length > 0
      ? { pursues: project.pursues.map((id) => ref(goalIri(id))) }
      : {}),
    ...(project.involves.length > 0
      ? { involves: project.involves.map((id) => ref(personIri(id))) }
      : {}),
    ...(project.priority === undefined ? {} : { priority: project.priority }),
    /*
     * `tasks` is not published: it is counted from the tasks in this project,
     * and each of those announces itself. A consumer that wants the count can
     * do the same arithmetic on what it already has, where a number published
     * here would be a second copy going stale between task events.
     */
  };
}

/**
 * A task as a JSON-LD document.
 *
 * `project` is a reference for the same reason a goal's ideas are: a project
 * is not part of its task, it is the thing the task belongs to, and the arrow
 * has to point somewhere a consumer can follow without assuming ownership.
 */
export function toTaskDocument(task: TaskDTO): TaskJsonLD {
  return {
    '@context': TASK_CONTEXT,
    '@id': taskIri(task.id),
    '@type': 'aether:Task',
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    status: task.status,
    ...(task.priority === undefined ? {} : { priority: task.priority }),
    ...(task.dueAt ? { dueAt: task.dueAt } : {}),
    ...(task.closedAt ? { closedAt: task.closedAt } : {}),
    ...(task.projectId ? { project: ref(projectIri(task.projectId)) } : {}),
    ...(task.involves.length > 0
      ? { involves: task.involves.map((id) => ref(personIri(id))) }
      : {}),
  };
}
