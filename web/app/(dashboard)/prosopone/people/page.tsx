import { Heading } from '@aether-zone/kosmos';

import { listUsers } from '@/lib/users';

import { PeopleView } from './people-view';

export const metadata = { title: 'People — Aether' };

/**
 * Prosopone's people, read from the api.
 *
 * A server component, so the access token stays on the server: the browser
 * gets rendered rows and never a bearer token it could leak.
 *
 * A failed read renders the table empty *and says so*, rather than showing
 * "nobody yet" — an api that is down and an organization with no people look
 * identical otherwise, and only one of them is worth acting on.
 */
export default async function PeoplePage() {
  const result = await listUsers();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Prosopone &gt; People
        </Heading>
      </div>

      <PeopleView
        users={result.ok ? result.data : []}
        /*
         * The reason, not a boolean.
         *
         * This used to collapse every failure that was not `noOrganization`
         * into "the api did not answer" — which reported a 401, a 403 and a
         * 404 as an unreachable server, and sent at least one debugging
         * session looking at ports while the api was answering perfectly well.
         * Each of these needs a different thing done about it, so each says so.
         */
        failure={result.ok ? null : result.reason}
        detail={result.ok ? null : (result.body?.message ?? null)}
      />
    </div>
  );
}
