import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * One thing a record is connected to.
 *
 * The same shape everywhere a connection is shown — an icon that says what
 * kind of thing it is, and its name. The icon carries the kind so the row
 * label does not have to repeat it: "Source" beside a book and "Scheduled"
 * beside a calendar say two things rather than one twice.
 */
export function ConnectionChip({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-muted-foreground/40"
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  );
}

/** A labelled row of them, or nothing at all when there are none. */
export function ConnectionRow({
  label,
  children,
  empty,
}: {
  label: string;
  children: ReactNode;
  /** Rendered instead when the row is empty; omit to hide the row entirely. */
  empty?: ReactNode;
}) {
  return (
    <>
      <span className="pt-1.5 text-sm text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{children ?? empty}</div>
    </>
  );
}
