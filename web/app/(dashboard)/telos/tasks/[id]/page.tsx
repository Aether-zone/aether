import { Alert, AlertDescription } from '@aether-zone/kosmos';
import type { ProjectDTO } from '@aether/contract';
import { notFound } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { listProjects } from '@/lib/projects';
import { getTask } from '@/lib/tasks';

import { TaskDetail } from './task-detail';

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and tasks are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound: 'No such task. It may have been deleted.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getTask((await params).id);

  return {
    title: result.ok
      ? `${result.data.title} — Telos > Tasks — Aether`
      : 'Telos > Tasks — Aether',
  };
}

/**
 * One task.
 *
 * The projects are always fetched, not only when the task is in one: the page
 * can move a task between them, and a picker with nothing in it would make
 * "file it somewhere" a button that opens onto an empty list.
 */
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTask(id);

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

  const task = result.data;
  const projects = await listProjects();
  const all: ProjectDTO[] = projects.ok ? projects.data : [];

  // An id that resolves to nothing is a project deleted since; the chip is
  // dropped rather than drawn empty, and the row still offers to re-file it.
  const project = task.projectId
    ? (all.find((candidate) => candidate.id === task.projectId) ?? null)
    : null;

  return <TaskDetail task={task} project={project} projects={all} />;
}
