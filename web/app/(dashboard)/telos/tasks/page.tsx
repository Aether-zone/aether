import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import type { ApiFailure } from '@/lib/api';
import { listProjects } from '@/lib/projects';
import { byWhatNeedsDoing } from '@/lib/task-order';
import { listTasks } from '@/lib/tasks';

import { TasksView } from './tasks-view';

export const metadata = { title: 'Telos > Tasks — Aether' };

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and tasks are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/**
 * Tasks, read from the api.
 *
 * A server component, so the access token stays on the server: the browser
 * gets rendered rows and never a bearer token it could leak.
 *
 * The projects come along because each row can be filed under one, and a
 * select needs the titles. Both requests go at once — they do not depend on
 * each other, and running them in sequence would make the page wait twice.
 *
 * The order is the console's, not the api's. Sorting here rather than asking
 * the api to do it keeps "what order do people want to read this in" a
 * question about the screen.
 */
export default async function TasksPage() {
  const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);

  const ordered = tasks.ok ? [...tasks.data].sort(byWhatNeedsDoing) : [];
  const failure = tasks.ok ? null : tasks.reason;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Telos &gt; Tasks
        </Heading>
        <Text tone="muted" size="body-small">
          The end of the chain: an idea becomes a goal, a goal is pursued by a
          project, and a project is done through tasks.
        </Text>
      </div>

      {failure && (
        <Alert variant={failure === 'noOrganization' ? 'default' : 'destructive'}>
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      {/* The view is rendered even on failure: capture still works the moment
          the api comes back, and hiding the whole screen behind an error would
          make a transient outage look like a lost feature.

          A projects failure is quieter — the select falls back to "No project"
          only, which is a diminished screen rather than a broken one, and
          saying so twice would bury the message that matters. */}
      <TasksView tasks={ordered} projects={projects.ok ? projects.data : []} />
    </div>
  );
}
