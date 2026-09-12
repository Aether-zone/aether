import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import type { ApiFailure } from '@/lib/api';
import { listGroups } from '@/lib/groups';

import { GroupsView } from './groups-view';

export const metadata = { title: 'Prosopone > Groups — Aether' };

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and these records are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/**
 * The groups prosopone knows about.
 *
 * A server component, so the access token stays on the server: the browser
 * gets rendered rows and never a bearer token it could leak.
 *
 * Ordered by the api, by name. Unlike every other list here the console does
 * no sorting of its own — there is one sensible order for a reference list and
 * the store can produce it.
 */
export default async function OrganizationsPage() {
  const result = await listGroups();
  const groups = result.ok ? result.data : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <PageBreadcrumbs />

      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Prosopone &gt; Groups
        </Heading>
        <Text tone="muted" size="body-small">
          The groups the people here belong to — a client, a community, a team,
          a family. Not the organization you signed in as.
        </Text>
      </div>

      {failure && (
        <Alert
          variant={failure === 'noOrganization' ? 'default' : 'destructive'}
        >
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      {/* Rendered even on failure: recording still works the moment the api
          comes back, and hiding the whole screen behind an error would make a
          transient outage look like a lost feature. */}
      <GroupsView groups={groups} />
    </div>
  );
}
