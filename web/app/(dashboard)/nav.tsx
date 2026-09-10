import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import {
  IoArchiveOutline,
  IoBriefcaseOutline,
  IoBulbOutline,
  IoBusinessOutline,
  IoCalendarOutline,
  IoCardOutline,
  IoCheckboxOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoFileTrayOutline,
  IoFlagOutline,
  IoGitNetworkOutline,
  IoHomeOutline,
  IoLibraryOutline,
  IoLinkOutline,
  IoLocationOutline,
  IoLogOutOutline,
  IoMapOutline,
  IoPeopleOutline,
  IoRepeatOutline,
  IoSettingsOutline,
  IoSparklesOutline,
  IoTimeOutline,
  IoTodayOutline,
} from 'react-icons/io5';

/**
 * Icons come from Ionicons 5, through `react-icons`.
 *
 * **The set is not a free choice.** kosmos already draws with Ionicons
 * outline — the dropdown's chevron, the datepicker's calendar, the treeview's
 * disclosure arrow — and it does not re-export them, so an app that wanted
 * matching icons had no way to ask for them and hand-rolled its own instead.
 * Every glyph on this screen therefore has to come from the same family, or
 * the nav sits beside kosmos's own controls looking almost but not quite like
 * them. That is worse than either alternative done wholeheartedly.
 *
 * Outline variants throughout, for the same reason: kosmos uses `*Outline`
 * everywhere except where a control is *filled to mean something*, like a
 * rated star.
 */

/**
 * One icon, at the size the sidenav expects.
 *
 * `react-icons` sizes its svg to `1em`, which follows the font size rather
 * than the layout. kosmos's `SidenavItem` puts its icon in a `size-4` span but
 * styles nothing inside it, and a bare `Button` wraps it in nothing at all, so
 * the size is stated here and does not depend on what either does — a class
 * beats the `width`/`height` attributes react-icons sets.
 */
const icon = (Icon: IconType): ReactNode => (
  <Icon className="size-4" aria-hidden />
);

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

/**
 * Aether itself: the three places that are not one domain's.
 *
 * These are also the only items the collapsed rail shows, so they carry the
 * most weight per glyph.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: icon(IoHomeOutline) },
  // A tray rather than an envelope: what lands here is anything awaiting
  // attention, not only mail — and the envelope is wanted below for post.
  { href: '/inbox', label: 'Inbox', icon: icon(IoFileTrayOutline) },
  { href: '/ask', label: 'Ask Aether', icon: icon(IoSparklesOutline) },
];

/** Prosopone — the person, and who they are to each other. */
export const PROSOPONE_ITEMS: NavItem[] = [
  { href: '/prosopone/people', label: 'People', icon: icon(IoPeopleOutline) },
  // A link, not a network: the graph glyph belongs to arachni below, and two
  // node-and-edge icons in one sidebar would each weaken the other.
  {
    href: '/prosopone/relationships',
    label: 'Relationships',
    icon: icon(IoLinkOutline),
  },
];

/** Telos — purpose, from the spark to the next thing to do. */
export const TELOS_ITEMS: NavItem[] = [
  { href: '/telos/ideas', label: 'Ideas', icon: icon(IoBulbOutline) },
  { href: '/telos/goals', label: 'Goals', icon: icon(IoFlagOutline) },
  {
    href: '/telos/projects',
    label: 'Projects',
    icon: icon(IoBriefcaseOutline),
  },
  { href: '/telos/tasks', label: 'Tasks', icon: icon(IoCheckboxOutline) },
];

/** Tekmerion — evidence: the things a claim rests on. */
export const TEKMERION_ITEMS: NavItem[] = [
  {
    href: '/tekmerion/resources',
    label: 'Resources',
    icon: icon(IoLibraryOutline),
  },
];

/** Mneme — what the workspace remembers. */
export const MNEME_ITEMS: NavItem[] = [
  // An archive rather than a disk: mneme keeps what was said about a
  // resource, and a floppy would read as "save" — an action, not a place.
  { href: '/mneme/memories', label: 'Memories', icon: icon(IoArchiveOutline) },
];

/** Chronos — time. */
export const CHRONOS_ITEMS: NavItem[] = [
  {
    href: '/chronos/calendar',
    label: 'Calendar',
    icon: icon(IoCalendarOutline),
  },
  // A single marked day, so it is not a second calendar grid sitting directly
  // under the first one.
  { href: '/chronos/events', label: 'Events', icon: icon(IoTodayOutline) },
  {
    href: '/chronos/schedules',
    label: 'Schedules',
    icon: icon(IoTimeOutline),
  },
];

/** Oikonomos — what is owned, owed and paid for. */
export const OIKONOMOS_ITEMS: NavItem[] = [
  { href: '/oikonomos/assets', label: 'Assets', icon: icon(IoCubeOutline) },
  {
    href: '/oikonomos/subscriptions',
    label: 'Subscriptions',
    icon: icon(IoRepeatOutline),
  },
  {
    href: '/oikonomos/contracts',
    label: 'Contracts',
    icon: icon(IoDocumentTextOutline),
  },
  {
    // Was missing its leading slash, so it resolved against the current path.
    href: '/oikonomos/expenses',
    label: 'Expenses',
    icon: icon(IoCardOutline),
  },
];

/**
 * Topos — place, at three grains: the building, the postal address, the point
 * on the ground. Three glyphs that are obviously not each other.
 */
export const TOPOS_ITEMS: NavItem[] = [
  { href: '/topos/places', label: 'Places', icon: icon(IoBusinessOutline) },
  { href: '/topos/addresses', label: 'Addresses', icon: icon(IoMapOutline) },
  {
    href: '/topos/locations',
    label: 'Locations',
    icon: icon(IoLocationOutline),
  },
];

/** Arachni — the knowledge graph. */
export const ARACHNI_ITEMS: NavItem[] = [
  { href: '/arachni/graph', label: 'Graph', icon: icon(IoGitNetworkOutline) },
];

export const SYSTEM_ITEMS: NavItem[] = [
  {
    href: '/system/settings',
    label: 'Settings',
    icon: icon(IoSettingsOutline),
  },
];

/**
 * Every item in the sidebar, in the order the groups are rendered.
 *
 * The header reads the current page's label off this rather than off
 * `NAV_ITEMS` alone, which only ever matched the three top-level entries and
 * left every domain page titled with the app's name.
 */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  ...TELOS_ITEMS,
  ...PROSOPONE_ITEMS,
  ...TEKMERION_ITEMS,
  ...MNEME_ITEMS,
  ...CHRONOS_ITEMS,
  ...OIKONOMOS_ITEMS,
  ...TOPOS_ITEMS,
  ...ARACHNI_ITEMS,
  ...SYSTEM_ITEMS,
];

/** Exact match for the index route, prefix match for the rest. */
export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * The most specific item matching the path.
 *
 * Longest href wins, so `/telos/tasks` is titled "Tasks" rather than picking
 * up whichever shorter prefix happened to be listed first.
 */
export function currentItem(pathname: string): NavItem | undefined {
  return [...ALL_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActive(pathname, item.href));
}

export function CollapseIcon() {
  return <IoChevronBackOutline className="size-4" aria-hidden />;
}

export function ExpandIcon() {
  return <IoChevronForwardOutline className="size-4" aria-hidden />;
}

export function SignOutIcon() {
  return <IoLogOutOutline className="size-4" aria-hidden />;
}
