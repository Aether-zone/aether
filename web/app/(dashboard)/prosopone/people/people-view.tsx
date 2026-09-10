'use client';

import {
  Alert,
  AlertDescription,
  Avatar,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@aether-zone/kosmos';
import type { UserDTO } from '@aether/contract';
import type { ApiFailure } from '@/lib/api';
import { useState, useTransition } from 'react';
import { IoPencilOutline, IoTrashOutline } from 'react-icons/io5';

import { IconButton } from '@/components/icon-button';
import { initials } from '@/lib/format';

import { removeUserAction } from './actions';
import { UserDialog } from './user-dialog';

/**
 * The people table.
 *
 * `users` comes from the server component above, which read them from the api.
 * Nothing here keeps a copy: an action revalidates the path and the list that
 * comes back is the api's answer rather than this browser's recollection of
 * it. That is what stops the table disagreeing with the store after a failed
 * save.
 */
/** What each way of failing means, and what to do about it. */
const EXPLANATIONS: Record<ApiFailure['reason'], string> = {
  noOrganization:
    'You do not belong to any organization yet, and people are kept per organization. Ask an owner to add you in pistis.',
  unauthenticated:
    'Your session is no longer valid. Sign out and back in.',
  forbidden:
    'Your session does not grant access to this organization. Switching organization in the sidebar, or signing in again, usually fixes it.',
  notFound:
    'The aether api answered, but not on this route — it is probably running an older build. Restart it.',
  unavailable:
    'The aether api did not answer. It runs on :3040; check that it is started.',
};

export function PeopleView({
  users,
  failure = null,
  detail = null,
}: {
  users: UserDTO[];
  /** Why the list could not be read, or null when it was. */
  failure?: ApiFailure['reason'] | null;
  /** What the api itself said, where it said anything. */
  detail?: string | null;
}) {
  // Only one of these is a state the person can do nothing about.
  const noOrganization = failure === 'noOrganization';
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(user: UserDTO) {
    setError(null);
    setRemoving(user.id);

    startTransition(async () => {
      const result = await removeUserAction(user.id);

      setRemoving(null);

      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {failure && (
        <Alert variant={noOrganization ? 'default' : 'destructive'}>
          <AlertDescription>
            {EXPLANATIONS[failure]}
            {/* The api's own words, when it gave any — it knows why it said
                no, and these explanations are only the fallback. */}
            {detail && (
              <span className="mt-1 block text-xs opacity-80">{detail}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4">
        <Text tone="muted" size="body-small">
          {users.length === 1 ? '1 person' : `${users.length} people`}
        </Text>
        <Button onClick={() => setAdding(true)} disabled={noOrganization}>
          Add person
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="Nobody yet"
          description="People you add here are the ones aether can attach to a meeting, a task or a place."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              {/* No header: the column holds controls, and a label for it
                  would be read out on every row by a screen reader. */}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      fallback={initials(`${user.firstName} ${user.lastName}`)}
                    />
                    <span className="font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                {/* Tabular numerals so the numbers line up column-wise
                    rather than wandering with the glyph widths. */}
                <TableCell className="font-mono text-muted-foreground tabular-nums">
                  {user.phoneNumber}
                </TableCell>
                <TableCell>
                  <span className="flex justify-end gap-1">
                    <IconButton
                      aria-label={`Edit ${user.firstName} ${user.lastName}`}
                      onClick={() => setEditing(user)}
                    >
                      <IoPencilOutline className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton
                      aria-label={`Remove ${user.firstName} ${user.lastName}`}
                      onClick={() => remove(user)}
                      disabled={removing === user.id}
                    >
                      <IoTrashOutline className="size-4" aria-hidden />
                    </IconButton>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UserDialog open={adding} onOpenChange={setAdding} />

      {/* Keyed by id so switching straight from one person to another
          remounts the form rather than showing the previous draft. */}
      <UserDialog
        key={editing?.id ?? 'none'}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing}
      />
    </div>
  );
}
