import { Alert, AlertDescription } from '@aether-zone/kosmos';
import { notFound } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { displayTitle } from '@/lib/resource-order';
import { getFile, getResource } from '@/lib/resources';
import { listUsers } from '@/lib/users';

import { ResourceDetail } from './resource-detail';

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and resources are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound: 'No such resource. It may have been deleted.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getResource((await params).id);

  return {
    title: result.ok
      ? `${displayTitle(result.data)} — Tekmerion > Resources — Aether`
      : 'Tekmerion > Resources — Aether',
  };
}

/**
 * One resource: what it is, what it says, and where it came from.
 *
 * This page exists because `content` cannot live in a row — and content is the
 * substance of a resource, not a detail of it. The list is a way of finding
 * things; this is the only place one can actually be read.
 */
export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getResource(id);

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

  const resource = result.data;

  const [people, file] = await Promise.all([
    // Always: the page can change who a resource is about, and the picker
    // needs everyone even when it currently names nobody.
    listUsers(),
    // Only when there is one to fetch.
    resource.fileId ? getFile(resource.fileId) : null,
  ]);

  return (
    <ResourceDetail
      resource={resource}
      /*
       * A `fileId` that resolves to nothing is a row deleted since. The card
       * is dropped rather than shown broken — the rest of the resource is
       * still perfectly readable.
       */
      file={file?.ok ? file.data : null}
      people={people.ok ? people.data : []}
    />
  );
}
