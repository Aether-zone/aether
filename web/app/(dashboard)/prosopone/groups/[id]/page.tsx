import { Alert, AlertDescription } from '@aether-zone/kosmos';
import { notFound } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { getGroup } from '@/lib/groups';

import { GroupDetail } from './group-detail';

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and these records are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound: 'No such group. It may have been deleted.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getGroup((await params).id);

  return {
    title: result.ok
      ? `${result.data.name} — Prosopone > Groups — Aether`
      : 'Prosopone > Groups — Aether',
  };
}

/**
 * One group — a group somebody recorded, not the tenant.
 */
export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getGroup(id);

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

  return <GroupDetail group={result.data} />;
}
