'use client';

import { Button, EmptyState, Text } from '@aether-zone/kosmos';
import type { GroupDTO } from '@aether/contract';
import Link from 'next/link';
import { useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';

import { NewGroupDialog } from './new-group-dialog';
import { TYPES, UNSTATED } from './types';

/**
 * The groups prosopone knows about.
 *
 * One alphabetical list rather than sections by kind. A group list is scanned
 * for one the reader already has in mind, and alphabetical is how you find a
 * name you know — where grouping by kind would make you first decide whether
 * the client you are looking for was filed as a company or an association.
 * The api orders it; the console does not re-sort.
 */
export function GroupsView({ groups }: { groups: GroupDTO[] }) {
  const [recording, setRecording] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setRecording(true)}>
          <IoAddOutline className="size-4" aria-hidden />
          New group
        </Button>
      </div>

      <NewGroupDialog open={recording} onOpenChange={setRecording} />

      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="A company, a community, a team, a family — the groups the people here belong to. Not the organization you signed in as."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {groups.map((group) => {
            const kind = group.type ? TYPES[group.type] : UNSTATED;
            const Icon = kind.icon;

            return (
              <li
                key={group.id}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40"
              >
                <Icon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-label={kind.label}
                />

                <span className="min-w-0 flex-1">
                  <Link
                    href={`/prosopone/groups/${group.id}`}
                    className="block truncate font-medium text-foreground hover:underline"
                  >
                    {group.name}
                  </Link>
                  {group.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {group.description}
                    </span>
                  )}
                </span>

                {/* Muted when nobody set one: an unstated kind is a question
                    nobody has answered, not a claim about the group. */}
                <span
                  className={[
                    'shrink-0 rounded-full border border-border px-2.5 py-1 text-xs',
                    group.type
                      ? 'text-muted-foreground'
                      : 'italic text-muted-foreground/60',
                  ].join(' ')}
                >
                  {kind.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {groups.length === 1 ? '1 group' : `${groups.length} groups`}
      </Text>
    </div>
  );
}
