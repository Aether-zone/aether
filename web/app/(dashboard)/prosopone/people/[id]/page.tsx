import { Alert, AlertDescription } from '@aether-zone/kosmos';
import type { GroupDTO } from '@aether/contract';
import { notFound } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { listGoals } from '@/lib/goals';
import { listGroups } from '@/lib/groups';
import { listIdeas } from '@/lib/ideas';
import { connectionsOf } from '@/lib/person-connections';
import { fullName } from '@/lib/person-display';
import { listProjects } from '@/lib/projects';
import { listResources } from '@/lib/resources';
import { listTasks } from '@/lib/tasks';
import { getUser } from '@/lib/users';

import { PersonDetail } from './person-detail';

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and people are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound: 'No such person. They may have been removed.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getUser((await params).id);

  return {
    title: result.ok
      ? `${fullName(result.data)} — Prosopone > People — Aether`
      : 'Prosopone > People — Aether',
  };
}

/**
 * One person, and everything that names them.
 *
 * **Six lists, fetched in parallel, to render one page.** That is the cost of
 * reading the link from the other end: a person holds no record of what they
 * are involved in, because every resource holds the people it concerns — which
 * is the right place for it, since the resource is what somebody is editing
 * when the connection is made.
 *
 * It is honest at this size and it will not scale. The fix is a route that
 * answers "what names this person" directly, not a column on the person that
 * five other tables would have to be kept in step with.
 */
export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getUser(id);

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

  const person = result.data;

  const [projects, goals, tasks, ideas, resources, groups] = await Promise.all([
    listProjects(),
    listGoals(),
    listTasks(),
    listIdeas(),
    listResources(),
    listGroups(),
  ]);

  /*
   * A list that failed contributes nothing rather than failing the page. One
   * domain being down should cost the reader that row, not the person.
   */
  const connections = connectionsOf(person.id, {
    projects: projects.ok ? projects.data : [],
    goals: goals.ok ? goals.data : [],
    tasks: tasks.ok ? tasks.data : [],
    ideas: ideas.ok ? ideas.data : [],
    resources: resources.ok ? resources.data : [],
  });

  const all: GroupDTO[] = groups.ok ? groups.data : [];

  // An id that resolves to nothing is a group deleted since; the page says
  // "None" rather than showing a name it does not have.
  const group = person.groupId
    ? (all.find((candidate) => candidate.id === person.groupId) ?? null)
    : null;

  return (
    <PersonDetail
      person={person}
      group={group}
      groups={all}
      connections={connections}
    />
  );
}
