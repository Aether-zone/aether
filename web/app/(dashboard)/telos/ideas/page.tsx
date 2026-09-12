import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import type { ApiFailure } from '@/lib/api';
import { byPriorityThenAge } from '@/lib/idea-order';
import { listIdeas } from '@/lib/ideas';
import { listUsers } from '@/lib/users';

import { IdeasView } from './ideas-view';

import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

export const metadata = { title: 'Telos > Ideas — Aether' };

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and ideas are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/**
 * Ideas, read from the api.
 *
 * A server component, so the access token stays on the server: the browser
 * gets rendered rows and never a bearer token it could leak.
 *
 * The order is the console's, not the api's — ranked first and in order, then
 * the unranked by age. Sorting here rather than asking the api to do it keeps
 * "what order do people want to read this in" a question about the screen.
 */
export default async function IdeasPage() {
  // Both at once: an idea names the people it involves, and the avatars need
  // their names. They do not depend on each other, so running them in sequence
  // would make the page wait twice.
  const [result, people] = await Promise.all([listIdeas(), listUsers()]);

  const ideas = result.ok ? [...result.data].sort(byPriorityThenAge) : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <PageBreadcrumbs />

      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Telos &gt; Ideas
        </Heading>
        <Text tone="muted" size="body-small">
          Unrefined intent. Some become goals, most stay ideas — both are fine.
        </Text>
      </div>

      {failure && (
        <Alert
          variant={failure === 'noOrganization' ? 'default' : 'destructive'}
        >
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      {/* The view is rendered even on failure: capture still works the moment
          the api comes back, and hiding the whole screen behind an error would
          make a transient outage look like a lost feature. */}
      {/* A people failure is quieter than an ideas one: the avatars fall back
          to nothing, which is a diminished screen rather than a broken one,
          and saying so twice would bury the message that matters. */}
      <IdeasView ideas={ideas} people={people.ok ? people.data : []} />
    </div>
  );
}
