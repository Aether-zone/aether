import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import type { ApiFailure } from '@/lib/api';
import { byProgress } from '@/lib/project-order';
import { listProjects } from '@/lib/projects';

import { ProjectsView } from './projects-view';

export const metadata = { title: 'Telos > Projects — Aether' };

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and projects are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/**
 * Projects, read from the api.
 *
 * A server component, so the access token stays on the server.
 *
 * The order is the console's: what is being worked on now, then what is
 * queued, then what is over — each by deadline. It answers "what is in flight
 * and what is next", which is the question this screen exists for.
 */
export default async function ProjectsPage() {
  const result = await listProjects();
  const projects = result.ok ? [...result.data].sort(byProgress) : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Telos &gt; Projects
        </Heading>
        <Text tone="muted" size="body-small">
          The step after a goal: the piece of work that pursues it, which tasks
          then carry out.
        </Text>
      </div>

      {failure && (
        <Alert variant={failure === 'noOrganization' ? 'default' : 'destructive'}>
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      {/* Rendered even on failure: starting a project works the moment the api
          comes back, and hiding the screen would make an outage look like a
          lost feature. */}
      <ProjectsView projects={projects} />
    </div>
  );
}
