import { Alert, AlertDescription } from '@aether-zone/kosmos';
import type { GoalDTO } from '@aether/contract';
import { notFound } from 'next/navigation';

import type { ApiFailure } from '@/lib/api';
import { listGoals } from '@/lib/goals';
import { getIdea } from '@/lib/ideas';

import { IdeaDetail } from './idea-detail';

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and ideas are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound: 'No such idea. It may have been deleted.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getIdea((await params).id);

  return {
    title: result.ok
      ? `${result.data.title} — Telos > Ideas — Aether`
      : 'Telos > Ideas — Aether',
  };
}

/**
 * One idea, and what came of it.
 *
 * The list is the editor for the things a row can hold — ranking, status,
 * deletion — so this page exists for what a row cannot: the description, and
 * the goals the idea led to.
 *
 * `inspired` arrives as ids, because an idea embedding whole goals and a goal
 * embedding whole ideas is a pair of types that never bottoms out. The titles
 * are resolved here, where a failure to resolve them can degrade to showing
 * the count rather than taking the page down.
 */
export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getIdea(id);

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

  const idea = result.data;

  // Only asked for when there is something to resolve.
  const goals = idea.inspired.length > 0 ? await listGoals() : null;
  const inspired: GoalDTO[] | null = goals?.ok
    ? idea.inspired
        .map((goalId) => goals.data.find((goal) => goal.id === goalId))
        .filter((goal): goal is GoalDTO => goal !== undefined)
    : null;

  return <IdeaDetail idea={idea} inspired={inspired} />;
}
