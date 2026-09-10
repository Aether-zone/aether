import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import type { ApiFailure } from '@/lib/api';
import { byPriorityThenAge } from '@/lib/idea-order';
import { listIdeas } from '@/lib/ideas';

import { IdeasView } from './ideas-view';

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
  const result = await listIdeas();
  const ideas = result.ok ? [...result.data].sort(byPriorityThenAge) : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Telos &gt; Ideas
        </Heading>
        <Text tone="muted" size="body-small">
          The start of the chain: an idea becomes a goal, a goal is pursued by a
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
          make a transient outage look like a lost feature. */}
      <IdeasView ideas={ideas} />
    </div>
  );
}
