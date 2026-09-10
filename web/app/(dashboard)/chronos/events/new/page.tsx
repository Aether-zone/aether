import { Alert, AlertDescription, Heading, Text } from '@aether-zone/kosmos';

import { listPlaces } from '@/lib/places';
import { listUsers } from '@/lib/users';

import { EventForm } from '../event-form';

export const metadata = { title: 'Chronos > New event — Aether' };

/**
 * Putting something in the calendar.
 *
 * A page rather than a dialog: there are eight fields, two of them pickers
 * over lists that come from other domains.
 *
 * People and places are fetched here and passed down. Both are small and both
 * are needed before the form can be useful, so one round trip on the way in
 * beats a request per keystroke — the pickers filter what they already have.
 */
export default async function NewEventPage() {
  const [people, places] = await Promise.all([listUsers(), listPlaces()]);

  const unreachable = !people.ok || !places.ok;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Chronos &gt; New event
        </Heading>
        <Text tone="muted" size="body-small">
          A meeting or a call is announced to the rest of the workspace: akouo
          records it as somewhere a recording can be attached.
        </Text>
      </div>

      {unreachable && (
        <Alert variant="destructive">
          <AlertDescription>
            People or places could not be read, so those pickers may be empty.
          </AlertDescription>
        </Alert>
      )}

      <EventForm
        people={people.ok ? people.data : []}
        places={places.ok ? places.data : []}
      />
    </div>
  );
}
