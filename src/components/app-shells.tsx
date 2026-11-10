// Responsive role shells and navigation for resident, staff, guard and developer routes.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { getRoleNavigation } from '../core/modules';
import type { ModuleKey, RoleNavigationItem } from '../core/modules';
import type { PermissionMaps } from '../core/permissions';
import type { SocietyRole } from '../core/permissions';
import { Dialog } from './ui/dialog';
import { NotificationBell } from './notifications/notification-bell';

type SocietyShellProps = {
  activeSocietyId?: string;
  children: ReactNode;
  enabledModules?: readonly ModuleKey[];
  onSocietyChange?: (societyId: string) => void;
  permissionMaps?: PermissionMaps;
  role: SocietyRole;
  societies?: readonly SocietyOption[];
  unreadNotifications?: number;
};

type SocietyOption = {
  id: string;
  name: string;
};

type ShellNavigationItem = {
  href: string;
  icon: string;
  label: string;
  moduleKey?: ModuleKey;
  section: string;
};

const DEVELOPER_NAVIGATION: readonly ShellNavigationItem[] = [
  {
    href: '/developer',
    icon: 'S',
    label: 'Societies',
    section: 'Platform',
  },
  {
    href: '/developer/modules',
    icon: 'M',
    label: 'Modules',
    section: 'Platform',
  },
  {
    href: '/developer/errors',
    icon: 'E',
    label: 'Error Logs',
    section: 'Operations',
  },
  {
    href: '/developer/audit',
    icon: 'A',
    label: 'Audit Logs',
    section: 'Operations',
  },
  {
    href: '/developer/health',
    icon: 'H',
    label: 'Health',
    section: 'Operations',
  },
];

const MODULE_ICONS: Readonly<Record<ModuleKey, string>> = {
  core: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
  visitor:
    'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 8m2 3h1a4 4 0 0 1 4 4v2',
  delivery:
    'M3 7h11v11H3zM14 11h4l3 3v4h-7zM7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  billing: 'M5 3h14v18l-7-4-7 4V3Zm4 5h6m-6 4h6',
  service_request: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  staff:
    'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-3h6m-3-3v6',
  housekeeping:
    'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z',
  amc: 'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L15 12l-3-3 2.7-2.7Z',
  notice: 'M6 3h9l4 4v14H6zM14 3v5h5m-9 4h6m-6 4h6',
  amenity: 'M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z',
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function displayLabel(segment: string) {
  const labels: Readonly<Record<string, string>> = {
    admin: 'Dashboard',
    amc: 'AMC',
    amenities: 'Amenities',
    audit: 'Audit Logs',
    bills: 'Bills',
    deliveries: 'Deliveries',
    developer: 'Developer',
    errors: 'Error Logs',
    guard: 'Gate',
    health: 'Health',
    housekeeping: 'Housekeeping',
    notices: 'Notices',
    profile: 'Profile',
    requests: 'Requests',
    staff: 'Staff',
    visitors: 'Visitors',
  };
  return (
    labels[segment] ??
    segment
      .replaceAll('_', ' ')
      .replace(/^\w/, (letter) => letter.toUpperCase())
  );
}

function SvgIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="size-6 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function NavigationIcon({ item }: { item: ShellNavigationItem }) {
  if (item.moduleKey) {
    return <SvgIcon path={MODULE_ICONS[item.moduleKey]} />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center text-body-strong"
    >
      {item.icon}
    </span>
  );
}

function normalizeRoleNavigation(
  items: readonly RoleNavigationItem[],
  role: SocietyRole,
): ShellNavigationItem[] {
  return items.map((item) => ({
    href: item.href,
    icon: item.moduleKey,
    label: item.label,
    moduleKey: item.moduleKey,
    section:
      item.section ??
      (item.moduleKey === 'core'
        ? 'Overview'
        : role === 'resident'
          ? 'Home'
          : 'Operations'),
  }));
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 2) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mt-space-1 hidden expanded:block">
      <ol className="flex flex-wrap items-center gap-space-2 text-caption text-ink-muted">
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const current = index === segments.length - 1;
          return (
            <li className="flex items-center gap-space-2" key={href}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {current ? (
                <span aria-current="page">{displayLabel(segment)}</span>
              ) : (
                <Link
                  className="underline-offset-2 hover:underline"
                  href={href}
                >
                  {displayLabel(segment)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TopBar({
  activeSocietyId,
  dark = false,
  homeHref,
  menuLabel,
  menuOpen = false,
  onOpenMenu,
  onSocietyChange,
  pathname,
  role,
  societies = [],
  unreadNotifications = 0,
}: {
  activeSocietyId?: string;
  dark?: boolean;
  homeHref: string;
  menuLabel?: string;
  menuOpen?: boolean;
  onOpenMenu?: () => void;
  onSocietyChange?: (societyId: string) => void;
  pathname: string;
  role: SocietyRole | 'developer';
  societies?: readonly SocietyOption[];
  unreadNotifications?: number;
}) {
  const segments = pathname.split('/').filter(Boolean);
  const pageTitle = displayLabel(segments.at(-1) ?? 'home');
  const backHref =
    segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : homeHref;
  const barColor = dark
    ? 'border-dev-label/30 bg-dev-bar text-surface'
    : 'border-rule bg-surface text-ink';
  const menuColor = dark
    ? 'text-dev-label hover:bg-surface/10'
    : 'text-brand hover:bg-brand-tint';

  return (
    <header className={`sticky top-0 z-20 border-b ${barColor}`}>
      <div className="mx-auto flex min-h-14 max-w-content-wide items-center gap-space-3 px-space-4 expanded:min-h-16 expanded:px-space-5">
        {onOpenMenu && menuLabel ? (
          <button
            aria-label={menuLabel}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-md px-space-3 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuLabel ? 'medium:hidden' : ''} ${menuColor}`}
            onClick={onOpenMenu}
            type="button"
          >
            <span aria-hidden="true">☰</span>
            <span className="sr-only">{menuLabel}</span>
          </button>
        ) : segments.length > 1 ? (
          <Link
            aria-label={`Back to ${displayLabel(segments.at(-2) ?? '')}`}
            className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-title focus-visible:outline-2 focus-visible:outline-focus ${menuColor}`}
            href={backHref}
          >
            <span aria-hidden="true">←</span>
          </Link>
        ) : (
          <Link
            aria-label="Homeish home"
            className={`text-heading font-semibold ${dark ? 'text-dev-label' : 'text-brand'}`}
            href={homeHref}
          >
            Homeish
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-body-strong expanded:hidden">
            {pageTitle}
          </p>
          <p className="hidden truncate text-body-strong expanded:block">
            {role === 'developer'
              ? 'Developer Console'
              : (societies.find((society) => society.id === activeSocietyId)
                  ?.name ?? 'Homeish')}
          </p>
          {role === 'admin' ||
          role === 'committee' ||
          role === 'hk_supervisor' ||
          role === 'developer' ? (
            <Breadcrumbs pathname={pathname} />
          ) : null}
        </div>

        {societies.length > 1 ? (
          <label className="hidden expanded:block">
            <span className="sr-only">Switch society</span>
            <select
              aria-label="Switch society"
              className="min-h-12 max-w-56 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              disabled={!onSocietyChange}
              onChange={(event) => onSocietyChange?.(event.currentTarget.value)}
              value={activeSocietyId ?? societies[0]?.id ?? ''}
            >
              {societies.map((society) => (
                <option key={society.id} value={society.id}>
                  {society.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <NotificationBell
          dark={dark}
          initialUnreadCount={unreadNotifications}
        />

        <details className="relative">
          <summary
            className={`flex min-h-12 cursor-pointer list-none items-center gap-space-2 rounded-md px-space-3 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuColor}`}
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-neutral-tint text-ink"
            >
              <SvgIcon path="M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            </span>
            <span className="hidden medium:inline">Account</span>
          </summary>
          <div
            className={`absolute right-0 top-full z-30 mt-space-2 grid min-w-48 gap-space-1 rounded-md border p-space-2 shadow-overlay ${dark ? 'border-dev-label/30 bg-dev-bar text-surface' : 'border-rule bg-surface text-ink'}`}
          >
            <Link
              className={`rounded-sm px-space-3 py-space-2 ${dark ? 'hover:bg-surface/10' : 'hover:bg-brand-tint'}`}
              href="/profile"
            >
              Profile
            </Link>
            <Link
              className={`rounded-sm px-space-3 py-space-2 ${dark ? 'hover:bg-surface/10' : 'hover:bg-brand-tint'}`}
              href="/login"
            >
              Sign Out
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}

function SideNavigation({
  dark = false,
  items,
  pathname,
  collapsed = false,
  onToggle,
  desktopOnly = false,
}: {
  dark?: boolean;
  items: readonly ShellNavigationItem[];
  pathname: string;
  collapsed?: boolean;
  onToggle?: () => void;
  desktopOnly?: boolean;
}) {
  const sections = [...new Set(items.map((item) => item.section))];
  const surface = dark
    ? 'border-dev-label/30 bg-dev-bar text-surface'
    : 'border-rule bg-surface text-ink';

  return (
    <aside
      aria-label="Primary navigation"
      className={`fixed bottom-0 left-0 top-14 z-10 hidden flex-col border-r pt-space-4 expanded:top-16 ${desktopOnly ? 'expanded:flex' : 'medium:flex'} ${collapsed ? 'medium:w-16' : 'medium:w-64'} expanded:w-64 ${surface}`}
    >
      {onToggle ? (
        <button
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={`mx-space-2 mb-space-3 flex min-h-12 items-center justify-center rounded-md text-body-strong focus-visible:outline-2 focus-visible:outline-focus expanded:hidden ${dark ? 'hover:bg-surface/10' : 'hover:bg-surface-sunken'}`}
          onClick={onToggle}
          type="button"
        >
          <span aria-hidden="true">{collapsed ? '→' : '←'}</span>
          <span
            className={
              collapsed ? 'sr-only expanded:not-sr-only' : 'ml-space-2'
            }
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
      ) : null}
      <nav
        className="flex-1 overflow-y-auto px-space-2 pb-space-4"
        aria-label="Sections"
      >
        {sections.map((section) => (
          <div className="mb-space-4" key={section}>
            <h2
              className={`px-space-3 py-space-2 text-micro font-semibold uppercase tracking-wide ${dark ? 'text-dev-label' : 'text-ink-muted'} ${collapsed ? 'medium:sr-only expanded:not-sr-only' : ''}`}
            >
              {section}
            </h2>
            <ul className="grid gap-space-1">
              {items
                .filter((item) => item.section === section)
                .map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? 'page' : undefined}
                        aria-label={item.label}
                        className={`relative flex min-h-12 items-center gap-space-3 rounded-md px-space-3 text-body-strong outline-none focus-visible:outline-2 focus-visible:outline-focus ${collapsed ? 'medium:justify-center medium:px-space-2 expanded:justify-start expanded:px-space-3' : ''} ${active ? (dark ? 'bg-surface/10 text-dev-label' : 'bg-brand-tint text-brand') : dark ? 'hover:bg-surface/10' : 'hover:bg-surface-sunken'}`}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                      >
                        {active && !dark ? (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-brand"
                          />
                        ) : null}
                        <NavigationIcon item={item} />
                        <span
                          className={
                            collapsed
                              ? 'medium:sr-only expanded:not-sr-only'
                              : ''
                          }
                        >
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function BottomNavigation({
  items,
  onOpenMore,
  pathname,
  moreOpen,
}: {
  items: readonly ShellNavigationItem[];
  onOpenMore: () => void;
  pathname: string;
  moreOpen: boolean;
}) {
  const visible = items.slice(0, 4);
  const hasMore = items.length > visible.length;
  const columnCount = Math.min(5, visible.length + Number(hasMore));
  const moreActive =
    hasMore &&
    items
      .slice(visible.length)
      .some((item) => isActivePath(pathname, item.href));

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-surface pb-space-1 medium:pb-space-2 expanded:hidden"
    >
      <ul
        className="mx-auto grid max-w-content-default"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {visible.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-space-1 px-space-1 text-micro focus-visible:outline-2 focus-visible:outline-focus ${active ? 'font-semibold text-brand' : 'text-ink-muted'}`}
                href={item.href}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-brand"
                  />
                ) : null}
                <NavigationIcon item={item} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        {hasMore ? (
          <li>
            <button
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-label={moreActive ? 'More, current section' : 'More'}
              className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-space-1 px-space-1 text-micro focus-visible:outline-2 focus-visible:outline-focus ${moreActive ? 'font-semibold text-brand' : 'text-ink-muted'}`}
              onClick={onOpenMore}
              type="button"
            >
              {moreActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-brand"
                />
              ) : null}
              <span aria-hidden="true" className="text-title leading-none">
                ···
              </span>
              <span>More</span>
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function MoreMenu({
  activeSocietyId,
  dark = false,
  items,
  onSocietyChange,
  onOpenChange,
  open,
  societies = [],
  showAccountActions = true,
  title = 'More',
}: {
  activeSocietyId?: string;
  dark?: boolean;
  items: readonly ShellNavigationItem[];
  onSocietyChange?: (societyId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  societies?: readonly SocietyOption[];
  showAccountActions?: boolean;
  title?: string;
}) {
  const menuItemStyle = dark
    ? 'border-dev-label/30 hover:bg-surface/10'
    : 'border-rule hover:bg-surface-sunken';

  return (
    <Dialog
      className={`!inset-0 !h-dvh !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none ${dark ? '!border-dev-label/30 !bg-dev-bar !text-surface' : ''}`}
      description={
        showAccountActions
          ? 'Additional destinations and account actions.'
          : 'Developer tools and platform destinations.'
      }
      id="shell-more-menu"
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    >
      <ul className="grid gap-space-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              className={`flex min-h-14 items-center gap-space-3 rounded-md border px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuItemStyle}`}
              href={item.href}
              onClick={() => onOpenChange(false)}
            >
              <NavigationIcon item={item} />
              {item.label}
            </Link>
          </li>
        ))}
        {societies.length > 1 ? (
          <li>
            <label
              className={`grid min-h-14 gap-space-2 rounded-md border px-space-4 py-space-2 text-body-strong ${menuItemStyle}`}
            >
              <span>Switch Society</span>
              <select
                aria-label="Switch society"
                className="min-h-10 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
                disabled={!onSocietyChange}
                onChange={(event) =>
                  onSocietyChange?.(event.currentTarget.value)
                }
                value={activeSocietyId ?? societies[0]?.id ?? ''}
              >
                {societies.map((society) => (
                  <option key={society.id} value={society.id}>
                    {society.name}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ) : null}
        {showAccountActions ? (
          <>
            <li>
              <Link
                className={`flex min-h-14 items-center rounded-md border px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuItemStyle}`}
                href="/profile"
                onClick={() => onOpenChange(false)}
              >
                Profile and Settings
              </Link>
            </li>
            <li>
              <Link
                className={`flex min-h-14 items-center rounded-md border px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuItemStyle}`}
                href="/login"
                onClick={() => onOpenChange(false)}
              >
                Sign Out
              </Link>
            </li>
          </>
        ) : null}
      </ul>
    </Dialog>
  );
}

function SocietyShell({
  activeSocietyId,
  children,
  enabledModules = ['core'],
  onSocietyChange,
  permissionMaps,
  role,
  societies = [],
  unreadNotifications,
}: SocietyShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const isResident = role === 'resident';
  const isGuard = role === 'guard';
  const isStaff =
    role === 'admin' || role === 'committee' || role === 'hk_supervisor';
  const navigation = normalizeRoleNavigation(
    getRoleNavigation([role], enabledModules, permissionMaps),
    role,
  );
  const showSidebar = isResident || isStaff;
  const rootHref = isResident ? '/home' : isGuard ? '/guard' : '/admin';
  const shellMainClasses = isResident
    ? 'mx-auto w-full max-w-content-default'
    : isGuard
      ? 'mx-auto w-full max-w-content-narrow'
      : 'w-full max-w-content-wide';
  const marginClasses = isResident
    ? 'expanded:ml-64'
    : railExpanded
      ? 'medium:ml-64 expanded:ml-64'
      : 'medium:ml-16 expanded:ml-64';
  const bottomPadding = isResident
    ? 'pb-24 medium:pb-24 expanded:pb-space-6'
    : isGuard
      ? 'pb-space-6'
      : 'pb-24 medium:pb-space-6';

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-space-4 focus:top-space-4 focus:z-50 focus:rounded-md focus:bg-surface focus:p-space-3"
        href="#main-content"
      >
        Skip to content
      </a>
      <TopBar
        activeSocietyId={activeSocietyId}
        homeHref={rootHref}
        onSocietyChange={onSocietyChange}
        pathname={pathname}
        role={role}
        societies={societies}
        unreadNotifications={unreadNotifications}
      />
      {showSidebar ? (
        <SideNavigation
          collapsed={!isResident && !railExpanded}
          items={navigation}
          onToggle={
            isResident
              ? undefined
              : () => setRailExpanded((expanded) => !expanded)
          }
          pathname={pathname}
          desktopOnly={isResident}
        />
      ) : null}
      <div className={marginClasses}>
        <main
          className={`min-h-[calc(100dvh-3.5rem)] px-space-4 py-space-5 medium:px-space-5 medium:py-space-6 expanded:min-h-[calc(100dvh-4rem)] ${bottomPadding} ${shellMainClasses} ${isGuard ? 'pt-space-6' : ''}`}
          id="main-content"
        >
          {children}
        </main>
      </div>
      {!isGuard ? (
        <BottomNavigation
          items={navigation}
          onOpenMore={() => setMoreOpen(true)}
          pathname={pathname}
          moreOpen={moreOpen}
        />
      ) : null}
      <MoreMenu
        activeSocietyId={activeSocietyId}
        items={navigation.slice(4)}
        onSocietyChange={onSocietyChange}
        onOpenChange={setMoreOpen}
        open={moreOpen}
        societies={societies}
      />
    </div>
  );
}

export function ResidentShell(props: Omit<SocietyShellProps, 'role'>) {
  return <SocietyShell {...props} role="resident" />;
}

export function AdminShell(props: Omit<SocietyShellProps, 'role'>) {
  return <SocietyShell {...props} role="admin" />;
}

export function CommitteeShell(props: Omit<SocietyShellProps, 'role'>) {
  return <SocietyShell {...props} role="committee" />;
}

export function GuardShell(props: Omit<SocietyShellProps, 'role'>) {
  return <SocietyShell {...props} role="guard" />;
}

export function HousekeepingShell(props: Omit<SocietyShellProps, 'role'>) {
  return <SocietyShell {...props} role="hk_supervisor" />;
}

export function DeveloperShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const darkItems = DEVELOPER_NAVIGATION;

  return (
    <div className="min-h-dvh bg-dev-bar text-surface">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-space-4 focus:top-space-4 focus:z-50 focus:rounded-md focus:bg-dev-bar focus:p-space-3 focus:text-dev-label"
        href="#main-content"
      >
        Skip to content
      </a>
      <TopBar
        dark
        homeHref="/developer"
        menuLabel="Open developer navigation"
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        pathname={pathname}
        role="developer"
      />
      <SideNavigation
        collapsed={!railExpanded}
        dark
        items={darkItems}
        onToggle={() => setRailExpanded((expanded) => !expanded)}
        pathname={pathname}
      />
      <div
        className={
          railExpanded
            ? 'medium:ml-64 expanded:ml-64'
            : 'medium:ml-16 expanded:ml-64'
        }
      >
        <main
          className="min-h-[calc(100dvh-3.5rem)] px-space-4 py-space-5 pb-space-8 text-surface medium:px-space-5 medium:py-space-6 expanded:min-h-[calc(100dvh-4rem)]"
          id="main-content"
        >
          {children}
        </main>
      </div>
      <MoreMenu
        items={darkItems}
        dark
        onOpenChange={setMenuOpen}
        open={menuOpen}
        showAccountActions={false}
        title="Developer Menu"
      />
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-space-5 bg-paper px-space-4 py-space-6">
      <Link className="text-title font-semibold text-brand" href="/">
        Homeish
      </Link>
      <section className="w-full max-w-content-narrow rounded-md border border-rule bg-surface p-space-5 medium:p-space-6">
        {children}
      </section>
    </main>
  );
}
