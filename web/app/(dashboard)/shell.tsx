'use client';

import {
  Avatar,
  Button,
  Separator,
  Sidenav,
  SidenavContent,
  SidenavFooter,
  SidenavGroup,
  SidenavGroupLabel,
  SidenavHeader,
  SidenavItem,
  ToastProvider,
  ToastViewport,
  useTheme,
} from '@aether-zone/kosmos';
import { usePathname, useRouter } from 'next/navigation';
import {
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { IconButton } from '@/components/icon-button';
import { MoonIcon, SunIcon } from '@/components/icons';
import { initials } from '@/lib/format';

import { signOutAction } from '../actions';
import { Logo, LogoMark } from '../logo';
import { ARACHNI_ITEMS, CHRONOS_ITEMS, CollapseIcon, ExpandIcon, MNEME_ITEMS, NAV_ITEMS, OIKONOMOS_ITEMS, PROSOPONE_ITEMS, SYSTEM_ITEMS, SignOutIcon, TEKMERION_ITEMS, TELOS_ITEMS, TOPOS_ITEMS, currentItem, isActive } from './nav';
import {
  OrganizationSwitcher,
  type Organization,
} from './organization-switcher';

/**
 * The signed-in chrome: akouo's sidenav, with loculus's own two additions.
 *
 * The rail is deliberate rather than earned — loculus is one screen, and a
 * navigation column beside a single page is furniture. It matches akouo so the
 * two consoles read as one product, which is worth more than the honesty of a
 * bare header.
 *
 * `ToastProvider` lives here so every action below it — an upload, a copy, a
 * delete — can report without threading a callback down. Its viewport is a
 * sibling, portalled by kosmos.
 */
export function DashboardShell({
  user,
  clientId,
  organizations,
  activeOrganizationId,
  children,
}: {
  user: { name: string; email: string };
  clientId: string;
  /** From the access token's `orgs` claim; resolved in the layout. */
  organizations: Organization[];
  activeOrganizationId: string | null;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Every group, not just the top three: matching on `NAV_ITEMS` alone left
  // every domain page wearing the app's name instead of its own.
  const current = currentItem(pathname);

  /**
   * `SidenavItem` / `NavRailItem` render real anchors, so keep the `href` for
   * middle-click and "open in new tab" and only intercept a plain left click to
   * navigate client-side.
   */
  const navigate = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    router.push(href);
  };

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {collapsed ? (
          <NavRail>
            <IconButton
              aria-label="Expand sidebar"
              onClick={() => setCollapsed(false)}
            >
              <ExpandIcon />
            </IconButton>

            <Separator className="my-2 w-8" />

            <OrganizationSwitcher
              organizations={organizations}
              activeId={activeOrganizationId}
              collapsed
            />

            <Separator className="my-2 w-8" />

            {NAV_ITEMS.map((item) => (
              <NavRailItem
                key={item.href}
                aria-label={item.label}
                href={item.href}
                icon={item.icon}
                active={isActive(pathname, item.href)}
                onClick={navigate(item.href)}
              />
            ))}

            <div className="mt-auto flex flex-col items-center gap-2">
              <Avatar size="sm" fallback={initials(user.name)} />
              <form action={signOutAction}>
                <IconButton type="submit" aria-label="Sign out">
                  <SignOutIcon />
                </IconButton>
              </form>
            </div>
          </NavRail>
        ) : (
          <Sidenav>
            {/* Kosmos's header and footer carry their own borders, so no
                separators are needed around them. */}
            <SidenavHeader className="justify-between gap-2">
              <Logo className="text-foreground" />
              <IconButton
                aria-label="Collapse sidebar"
                onClick={() => setCollapsed(true)}
              >
                <CollapseIcon />
              </IconButton>
            </SidenavHeader>

            <SidenavContent className='!gap-3'>
              {/* Above the nav deliberately: it scopes everything below it, so
                  it reads as the container rather than an item. */}
              <OrganizationSwitcher
                organizations={organizations}
                activeId={activeOrganizationId}
              />

              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Aether</SidenavGroupLabel>
                {NAV_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Telos</SidenavGroupLabel>
                {TELOS_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Prosopone</SidenavGroupLabel>
                {PROSOPONE_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Tekmerion</SidenavGroupLabel>
                {TEKMERION_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Mneme</SidenavGroupLabel>
                {MNEME_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Chronos</SidenavGroupLabel>
                {CHRONOS_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Oikonomos</SidenavGroupLabel>
                {OIKONOMOS_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Topos</SidenavGroupLabel>
                {TOPOS_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>Arachni</SidenavGroupLabel>
                {ARACHNI_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'

                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
              <SidenavGroup>
                <SidenavGroupLabel className='!pb-0'>System</SidenavGroupLabel>
                {SYSTEM_ITEMS.map((item) => (
                  <SidenavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={navigate(item.href)}
                    className='!py-1 !text-xs'
                  >
                    {item.label}
                  </SidenavItem>
                ))}
              </SidenavGroup>
            </SidenavContent>

            <SidenavFooter>
              <div className="flex items-center gap-3 px-1">
                <Avatar size="sm" fallback={initials(user.name)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <form action={signOutAction}>
                <Button type="submit" variant="secondary" className="w-full">
                  Sign out
                </Button>
              </form>
            </SidenavFooter>
          </Sidenav>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6">
            {collapsed && <LogoMark className="lg:hidden" />}
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {current?.label ?? 'Aether'}
            </h1>

            <span className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </span>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>

      <ToastViewport />
    </ToastProvider>
  );
}

/**
 * The collapsed counterpart to Kosmos's `Sidenav`, which has no rail of its own
 * — a rail is a layout choice this app makes rather than something the library
 * takes a view on.
 *
 * Styled to match `Sidenav`'s own surface and border so the two states read as
 * the same element narrowing, not as two different chromes.
 */
function NavRail({ children }: { children: ReactNode }) {
  return (
    <nav className="flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface p-3">
      {children}
    </nav>
  );
}

function NavRailItem({
  icon,
  active = false,
  className,
  ...props
}: ComponentPropsWithoutRef<'a'> & { icon?: ReactNode; active?: boolean }) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={[
        'flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-accent text-accent-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
    </a>
  );
}

/**
 * Light and dark, with the OS as a third option rather than a hidden default:
 * 'system' keeps following the preference when it changes, which is not the
 * same as whichever of the two it happens to resolve to right now.
 *
 * Kept from loculus's previous header — akouo has no equivalent, and dropping a
 * working control to match its chrome would be a worse trade than carrying one
 * extra button.
 */
function ThemeToggle() {
  // `resolvedTheme` is deliberately not read. See below.
  const { toggle } = useTheme();

  /*
   * Nothing rendered here depends on the current theme, and that is the whole
   * point.
   *
   * The server cannot know it: the choice lives in `localStorage` and in the
   * OS preference, neither of which exists while the HTML is being made. A
   * button whose icon and label came from `resolvedTheme` therefore rendered
   * one thing on the server and another on the client, and React discarded the
   * whole tree with a hydration error.
   *
   * What *is* known before hydration is the `dark` class: the script in
   * `app/layout.tsx` puts it on `<html>` synchronously, before the first
   * paint. So both icons and both labels are rendered every time — identical
   * markup on both sides — and CSS picks which is visible. The moon offers
   * dark, the sun offers light, so each shows in the theme it is *not*.
   *
   * `title` rather than kosmos's Tooltip: that one wraps its child in a
   * focusable span, which would put a second tab stop in front of a button
   * that already says what it does.
   */
  return (
    <Button
      variant="ghost"
      size="sm"
      title="Switch theme"
      onClick={toggle}
    >
      {/* Read out instead of an `aria-label`, so the announced label follows
          the theme for the same reason the icon does. */}
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:inline">Switch to light theme</span>

      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </Button>
  );
}
