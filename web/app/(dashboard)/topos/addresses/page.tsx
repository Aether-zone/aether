import { Card, CardDescription, CardHeader, CardTitle, Heading } from '@aether-zone/kosmos';

export const metadata = { title: 'Topos > Addresses — Aether' };

/**
 * Addresses.
 *
 * Empty until the api has something to serve. The layout above has already
 * turned away anyone without a session, and nothing here reads one — so unlike
 * the older placeholders this does not call `getSession()`, which costs a
 * cookie read and possibly a token refresh to render a heading.
 */
export default function AddressesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Topos &gt; Addresses
        </Heading>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>An address is how post reaches a place. Separate from the place itself, because a place can move and an address can change without the other doing so.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
