import {
  Alert,
  AlertDescription,
  EmptyState,
  Heading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@aether-zone/kosmos';
import Link from 'next/link';

import type { ApiFailure } from '@/lib/api';
import { formatCoordinates, listPlaces } from '@/lib/places';

export const metadata = { title: 'Topos > Places — Aether' };

/** What each way of failing means, and what to do about it. */
const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and places are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/**
 * Places, read from the api.
 *
 * A server component, so the access token stays on the server: the browser
 * gets rendered rows and never a bearer token it could leak.
 */
export default async function PlacesPage() {
  const result = await listPlaces();
  const places = result.ok ? result.data : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Topos &gt; Places
        </Heading>
      </div>

      {failure && (
        <Alert variant={failure === 'noOrganization' ? 'default' : 'destructive'}>
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4">
        <Text tone="muted" size="body-small">
          {places.length === 1 ? '1 place' : `${places.length} places`}
        </Text>
        {/*
          * A real anchor styled as a button, not a `Button` wrapping a link:
          * kosmos's Button renders a `<button>` with no `asChild` escape
          * hatch, and nesting an anchor inside one is invalid HTML that React
          * hydrates badly. This way middle-click and "open in new tab" work.
          *
          * Hidden rather than disabled when there is no organization — there
          * is no such thing as a disabled link, and a dead one is worse than
          * an absent one.
          */}
        {failure !== 'noOrganization' && (
          <Link
            href="/topos/places/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add place
          </Link>
        )}
      </div>

      {places.length === 0 ? (
        <EmptyState
          title="Nowhere yet"
          description="A place recorded here becomes somewhere a meeting can be in akouo."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Coordinates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {places.map((place) => (
              <TableRow key={place.id}>
                <TableCell>
                  <span className="font-medium text-foreground">
                    {place.name}
                  </span>
                  {place.description && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {place.description}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {place.address}
                </TableCell>
                {/* Tabular numerals so the numbers line up column-wise rather
                    than wandering with the glyph widths. */}
                <TableCell className="font-mono text-muted-foreground tabular-nums">
                  {formatCoordinates(place)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
