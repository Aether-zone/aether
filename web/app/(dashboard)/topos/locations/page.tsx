import { Card, CardDescription, CardHeader, CardTitle, Heading } from '@aether-zone/kosmos';

export const metadata = { title: 'Topos > Locations — Aether' };

/**
 * Locations.
 *
 * Empty until the api has something to serve. The layout above has already
 * turned away anyone without a session, and nothing here reads one — so unlike
 * the older placeholders this does not call `getSession()`, which costs a
 * cookie read and possibly a token refresh to render a heading.
 */
export default function LocationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="heading-large">
          Topos &gt; Locations
        </Heading>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>A location is a point on the ground. One building can have a place, an address and a location, and all three change independently.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
