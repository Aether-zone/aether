'use client';

import { BreadcrumbItem, Breadcrumbs } from '@aether-zone/kosmos';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ALL_NAV_ITEMS } from '@/app/(dashboard)/nav';
import { trailFor } from '@/lib/breadcrumbs';

/** What the sidebar calls a route, so a page renamed there is renamed here. */
const labelFor = (href: string): string | undefined =>
  ALL_NAV_ITEMS.find((item) => item.href === href)?.label;

/**
 * Where this page sits, above its heading.
 *
 * A client component because it reads the path, which is the only thing it
 * needs — every page renders `<PageBreadcrumbs />` with no arguments and gets
 * the right trail, so a new screen is never missing one and never has a stale
 * one.
 *
 * `leaf` is for the pages the path cannot name: a detail route's last segment
 * is an id, and the reader needs the record's title instead.
 *
 * Each crumb is a `next/link` passed as the child of a `BreadcrumbItem`, not
 * an `href` on the item itself — kosmos renders `BreadcrumbItem` as a plain
 * anchor, and a plain anchor inside the app is a full page load.
 */
export function PageBreadcrumbs({ leaf }: { leaf?: string }) {
  const pathname = usePathname();
  const crumbs = trailFor(pathname, { leaf, labelFor });

  // A trail of one is the root itself: there is nowhere to have come from, and
  // a lone crumb reading "Aether" is furniture.
  if (crumbs.length < 2) {
    return null;
  }

  return (
    <Breadcrumbs label="Breadcrumb">
      {crumbs.map((crumb) =>
        crumb.href ? (
          <Link key={crumb.href} href={crumb.href} className="contents">
            <BreadcrumbItem>{crumb.label}</BreadcrumbItem>
          </Link>
        ) : (
          <BreadcrumbItem key={crumb.label} current>
            {crumb.label}
          </BreadcrumbItem>
        ),
      )}
    </Breadcrumbs>
  );
}
