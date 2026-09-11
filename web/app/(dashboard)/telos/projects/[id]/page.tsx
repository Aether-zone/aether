import { Alert, AlertDescription } from '@aether-zone/kosmos';
import type { GoalDTO, TaskDTO, UserDTO } from '@aether/contract';
import { notFound } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { listGoals } from '@/lib/goals';
import { getProject } from '@/lib/projects';
import { listTasks } from '@/lib/tasks';
import { listUsers } from '@/lib/users';

import { ProjectDetail } from './project-detail';

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and projects are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound: 'No such project. It may have been deleted.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getProject((await params).id);

  return {
    title: result.ok
      ? `${result.data.title} — Telos > Projects — Aether`
      : 'Telos > Projects — Aether',
  };
}

/**
 * One project, and the work in it.
 *
 * The tasks are fetched whole and filtered here rather than asked for by
 * project, because the api has no such route — and adding one to save a filter
 * over a list this size would be inventing a performance problem to solve.
 */
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProject(id);

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

  const project = result.data;

  const [tasks, goals, people] = await Promise.all([
    // Always: the count in the header says whether there are any, and a
    // project with none still needs the empty state rendered.
    listTasks(),
    project.pursues.length > 0 ? listGoals() : null,
    project.involves.length > 0 ? listUsers() : null,
  ]);

  const mine: TaskDTO[] = tasks.ok
    ? tasks.data.filter((task) => task.projectId === project.id)
    : [];

  // An id that resolves to nothing is a record deleted since. Dropping it is
  // the honest reading — the connection is gone.
  const realizes: GoalDTO[] = goals?.ok
    ? project.pursues
        .map((goalId) => goals.data.find((goal) => goal.id === goalId))
        .filter((goal): goal is GoalDTO => goal !== undefined)
    : [];

  const involved: UserDTO[] = people?.ok
    ? project.involves
        .map((personId) => people.data.find((person) => person.id === personId))
        .filter((person): person is UserDTO => person !== undefined)
    : [];

  return (
    <ProjectDetail
      project={project}
      tasks={mine}
      realizes={realizes}
      involved={involved}
    />
  );
}
