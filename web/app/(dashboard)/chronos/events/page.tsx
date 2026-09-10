import {
  Alert,
  AlertDescription,
  Badge,
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
import type { EventDTO, EventStatus, EventType } from '@aether/contract';
import Link from 'next/link';

import type { ApiFailure } from '@/lib/api';
import { listEvents } from '@/lib/events';
import { formatWhen } from '@/lib/when';

export const metadata = { title: 'Chronos > Events — Aether' };

const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and the calendar is kept per organization. Ask an owner to add you in pistis.',
  unauthenticated: 'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

/** How each kind reads. */
const KINDS: Record<EventType, string> = {
  MEETING: 'Meeting',
  APPOINTMENT: 'Appointment',
  CALL: 'Call',
  DEADLINE: 'Deadline',
  REMINDER: 'Reminder',
  OUT_OF_OFFICE: 'Out of office',
};

/** Only a status worth interrupting the reader for gets a colour. */
const STATUS_VARIANTS: Record<EventStatus, 'secondary' | 'warning' | 'destructive'> =
  {
    SCHEDULED: 'secondary',
    IN_PROGRESS: 'warning',
    COMPLETED: 'secondary',
    CANCELLED: 'destructive',
  };

/**
 * The calendar, as a list.
 *
 * Ordered by when things happen rather than when they were made — a calendar
 * that sorted by creation would be a log, not a calendar. The api returns them
 * in insertion order, so the sort is here until it does that itself.
 */
export default async function EventsPage() {
  const result = await listEvents();
  const events = result.ok ? [...result.data].sort(byStart) : [];
  const failure = result.ok ? null : result.reason;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Chronos &gt; Events
        </Heading>
      </div>

      {failure && (
        <Alert variant={failure === 'noOrganization' ? 'default' : 'destructive'}>
          <AlertDescription>{EXPLANATIONS[failure]}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4">
        <Text tone="muted" size="body-small">
          {events.length === 1 ? '1 event' : `${events.length} events`}
        </Text>
        {/* A real anchor styled as a button: kosmos's Button renders a
            `<button>` with no `asChild`, and nesting an anchor in one is
            invalid HTML that hydrates badly. */}
        {failure !== 'noOrganization' && (
          <Link
            href="/chronos/events/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add event
          </Link>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="Nothing in the calendar"
          description="A meeting or a call added here is announced to the workspace — akouo records it as somewhere a recording can be attached."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>What</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Where</TableHead>
              <TableHead>Who</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {event.title}
                    </span>
                    <Badge variant="outline" size="sm">
                      {KINDS[event.type]}
                    </Badge>
                    {/* `SCHEDULED` is the resting state and says nothing worth
                        a badge; the other three are all departures from it. */}
                    {event.status !== 'SCHEDULED' && (
                      <Badge variant={STATUS_VARIANTS[event.status]} size="sm">
                        {event.status.toLowerCase().replace('_', ' ')}
                      </Badge>
                    )}
                  </span>
                  {event.description && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {event.description}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatWhen(event.startsAt, event.endsAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {event.location?.name ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {describeAttendees(event)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

const byStart = (a: EventDTO, b: EventDTO) =>
  a.startsAt.localeCompare(b.startsAt);

/**
 * "Ada Lovelace", "Ada and Grace", "Ada and 4 others".
 *
 * Names rather than a count, up to the point where the names stop fitting: who
 * is coming is the question, and "5 people" answers a different one.
 */
function describeAttendees(event: EventDTO): string {
  const names = event.attendees.map((person) => person.firstName);

  if (names.length === 0) {
    return '—';
  }

  if (names.length <= 2) {
    return names.join(' and ');
  }

  return `${names[0]} and ${names.length - 1} others`;
}
