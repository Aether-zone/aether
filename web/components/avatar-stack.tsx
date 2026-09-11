'use client';

import { Avatar } from '@aether-zone/kosmos';
import type { UserDTO } from '@aether/contract';

import { fullName, initials } from '@/lib/person-display';

/**
 * The people a record is about, overlapped.
 *
 * Overlapping rather than a row of separate avatars: the stack reads as one
 * thing — "these people, together" — and it stays the same width whether it
 * holds two or five, which is what keeps a list of rows aligned.
 *
 * Each carries a `title`, because initials are an abbreviation and two people
 * in an organization will eventually share them. The count is not hidden
 * behind a "+2" until there are enough for the width to matter.
 */
export function AvatarStack({
  people,
  max = 4,
}: {
  people: UserDTO[];
  max?: number;
}) {
  if (people.length === 0) {
    return null;
  }

  const shown = people.slice(0, max);
  const spare = people.length - shown.length;

  return (
    <span
      className="flex items-center"
      // The whole set in one label, so a screen reader is not read a string of
      // disconnected initials.
      aria-label={`Involves ${people.map(fullName).join(', ')}`}
    >
      {shown.map((person, index) => (
        <Avatar
          key={person.id}
          size="sm"
          fallback={initials(person)}
          title={fullName(person)}
          className={[
            'ring-2 ring-background',
            index > 0 && '-ml-2',
            'shrink-0',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}

      {spare > 0 && (
        <span
          className="-ml-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
          title={people.slice(max).map(fullName).join(', ')}
        >
          +{spare}
        </span>
      )}
    </span>
  );
}
