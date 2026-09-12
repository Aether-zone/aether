import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import type { ApiFailure } from '@/lib/api';
import { byNewest } from '@/lib/resource-order';
import { listResources } from '@/lib/resources';
import { listUsers } from '@/lib/users';

import { ResourcesView } from './resources-view';

import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

export const metadata = { title: 'Tekmerion > Resources — Aether' };

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and resources are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/**
 * Resources, read from the api.
 *
 * A server component, so the access token stays on the server: the browser
 * gets rendered rows and never a bearer token it could leak.
 *
 * Newest first, which is the opposite of every other list in aether. The
 * difference is what the list is for — an idea list is a backlog you work
 * down, a resource list is an inbox, and the thing that arrived most recently
 * is the thing nobody has dealt with yet.
 */
export default async function ResourcesPage() {
  // Both at once: a resource names the people it is about, and both the cards
  // and the search need their names.
  const [result, people] = await Promise.all([listResources(), listUsers()]);

  const resources = result.ok ? [...result.data].sort(byNewest) : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <PageBreadcrumbs />

      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Tekmerion &gt; Resources
        </Heading>
        <Text tone="muted" size="body-small">
          The source material behind your thinking — searchable by meaning, not
          just filename.
        </Text>
      </div>

      {failure && (
        <Alert
          variant={failure === 'noOrganization' ? 'default' : 'destructive'}
        >
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      {/* The view is rendered even on failure: filing still works the moment
          the api comes back, and hiding the whole screen behind an error would
          make a transient outage look like a lost feature. */}
      <ResourcesView
        resources={resources}
        people={people.ok ? people.data : []}
      />
    </div>
  );
}
