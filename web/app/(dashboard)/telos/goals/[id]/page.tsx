import { Alert, AlertDescription } from '@aether-zone/kosmos';
import type {
  EventDTO,
  IdeaDTO,
  ProjectDTO,
  ResourceDTO,
  UserDTO,
} from '@aether/contract';
import { notFound } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { listEvents } from '@/lib/events';
import { getGoal } from '@/lib/goals';
import { listIdeas } from '@/lib/ideas';
import { listProjects } from '@/lib/projects';
import { listResources } from '@/lib/resources';
import { listUsers } from '@/lib/users';

import { GoalDetail } from './goal-detail';

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and goals are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound: 'No such goal. It may have been deleted.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getGoal((await params).id);

  return {
    title: result.ok
      ? `${result.data.title} — Telos > Goals — Aether`
      : 'Telos > Goals — Aether',
  };
}

/** Everything a list answered with, or an empty list if it did not answer. */
const resolve = <T extends { id: string }>(
  ids: string[],
  answered: { ok: true; data: T[] } | { ok: false; reason: unknown } | null,
): T[] =>
  answered?.ok
    ? ids
        .map((id) => answered.data.find((item) => item.id === id))
        // An id that resolves to nothing is a record deleted since. Dropping
        // it is the honest reading — the connection is gone — and a chip with
        // no name would say less than one fewer chip.
        .filter((item): item is T => item !== undefined)
    : [];

/**
 * One goal, and everything it connects to.
 *
 * Five lists, fetched in parallel and each only when the goal names something
 * of that kind. A goal that cites no resources does not make tekmerion answer
 * a request whose result would be thrown away.
 */
export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getGoal(id);

  if (!result.ok) {
    // A 404 is the router's business, not an error banner: the URL is wrong,
    // and the console has a page that says so.
    if (result.reason === 'notFound') {
      notFound();
    }

    return (
      <Alert
        variant={result.reason === 'noOrganization' ? 'default' : 'destructive'}
      >
        <AlertDescription>{EXPLANATIONS[result.reason]}</AlertDescription>
      </Alert>
    );
  }

  const goal = result.data;

  const [ideas, projects, people, resources, events] = await Promise.all([
    goal.inspiredBy.length > 0 ? listIdeas() : null,
    goal.realizedBy.length > 0 ? listProjects() : null,
    // Always: the page can change who the goal is for, and the picker needs
    // everyone even when it currently names nobody.
    listUsers(),
    goal.sources.length > 0 ? listResources() : null,
    goal.scheduled.length > 0 ? listEvents() : null,
  ]);

  return (
    <GoalDetail
      goal={goal}
      inspiredBy={resolve<IdeaDTO>(goal.inspiredBy, ideas)}
      realizedBy={resolve<ProjectDTO>(goal.realizedBy, projects)}
      involved={resolve<UserDTO>(goal.involves, people)}
      sources={resolve<ResourceDTO>(goal.sources, resources)}
      scheduled={resolve<EventDTO>(goal.scheduled, events)}
      people={people.ok ? people.data : []}
    />
  );
}
