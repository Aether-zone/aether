import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import type { ApiFailure } from '@/lib/api';
import { byUrgency } from '@/lib/goal-order';
import { listGoals } from '@/lib/goals';
import { listUsers } from '@/lib/users';

import { GoalsView } from './goals-view';

import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

export const metadata = { title: 'Telos > Goals — Aether' };

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and goals are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/**
 * Goals, read from the api.
 *
 * A server component, so the access token stays on the server.
 *
 * The order is the console's: live goals first with the soonest deadline on
 * top, everything settled after. It answers "what am I aiming at, and what is
 * closest" — which is the question this screen exists for.
 */
export default async function GoalsPage() {
  // Both at once: a goal names the people it is about, and the avatars need
  // their names. They do not depend on each other.
  const [result, people] = await Promise.all([listGoals(), listUsers()]);
  const goals = result.ok ? [...result.data].sort(byUrgency) : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <PageBreadcrumbs />

      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Telos &gt; Goals
        </Heading>
        <Text tone="muted" size="body-small">
          What you are trying to achieve, and how far along you are.
        </Text>
      </div>

      {failure && (
        <Alert
          variant={failure === 'noOrganization' ? 'default' : 'destructive'}
        >
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      {/* Rendered even on failure: setting a goal works the moment the api
          comes back, and hiding the screen would make an outage look like a
          lost feature. */}
      <GoalsView goals={goals} people={people.ok ? people.data : []} />
    </div>
  );
}
