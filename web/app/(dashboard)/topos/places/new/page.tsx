import { Heading, Text } from '@aether-zone/kosmos';

import { PlaceForm } from '../place-form';

export const metadata = { title: 'Topos > New place — Aether' };

/**
 * Adding a place.
 *
 * A page rather than a dialog: a place has five fields and one of them is a
 * pair of coordinates someone is likely to fetch from a map in another tab —
 * which a modal makes awkward, because leaving it usually means losing it.
 */
export default function NewPlacePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Topos &gt; New place
        </Heading>
        <Text tone="muted" size="body-small">
          Everything aether knows about a place travels to the rest of the
          workspace: akouo records it as somewhere a meeting can be.
        </Text>
      </div>

      <PlaceForm />
    </div>
  );
}
