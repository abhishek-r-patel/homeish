// Responsive role shells and navigation for resident, staff, guard and developer routes.
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { getRoleNavigation, getRoleTabs } from '../core/modules';
import type { ModuleKey, RoleNavigationItem } from '../core/modules';
import type { PermissionMaps } from '../core/permissions';
import type { SocietyRole } from '../core/permissions';
import type { MessageValues } from '../core/i18n/messages';
import { Dialog } from './ui/dialog';
import { NotificationBell } from './notifications/notification-bell';
import { SosAlertBanner } from './sos/alert-banner';
import { useLanguage } from './language-provider';
import { LanguageSelector } from './language-selector';
import {
  WorkspaceTools,
  type WorkspaceQuickAction,
} from './home/workspace-tools';
import type { WorkspaceSearchResult } from '../core/home/workspace-discovery';
import type { ServerActionResult } from '../core/actions/server-action';

type SocietyShellProps = {
  activeSocietyId?: string;
  children: ReactNode;
  enabledModules?: readonly ModuleKey[];
  onSocietyChange?: (societyId: string) => void;
  switchSociety?: (societyId: string) => Promise<{
    ok: boolean;
    message?: string;
  }>;
  switchPlace?: (input: {
    societyId: string;
    unitId?: string | null;
    allFlats?: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  places?: readonly PlaceOption[];
  quickActions?: readonly WorkspaceQuickAction[];
  workspaceSearchAction?: (
    input: unknown,
  ) => Promise<ServerActionResult<WorkspaceSearchResult>>;
  permissionMaps?: PermissionMaps;
  role: SocietyRole;
  // Petty-cash custody is per person (P39), so it is not a role navigation item.
  showPettyCash?: boolean;
  societies?: readonly SocietyOption[];
  unreadNotifications?: number;
};

type SocietyOption = {
  id: string;
  name: string;
};

type PlaceOption = {
  societyId: string;
  societyName: string;
  href: string;
  label: string;
  active?: boolean;
  allFlats?: boolean;
  unitId?: string | null;
};

type Translate = (source: string, values?: MessageValues) => string;

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
  directory:
    'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-3v6m-3-3h6',
  expense: 'M4 4h16v16H4zM8 8h8M8 12h8m-8 4h4',
  tenancy: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M8 15h8m-3-3 3 3-3 3',
  document:
    'M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z',
  parking: 'M5 3h14v18H5zM9 17V7h4a3 3 0 0 1 0 6H9',
  sos: 'M12 3 2 20h20L12 3Zm0 6v5m0 3h.01',
  vendor: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  patrol: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4',
  metering: 'M12 21a9 9 0 1 0-9-9M12 12l4-4M7 17h10',
  asset: 'M4 7l8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10',
  home_services:
    'M3 10.5 12 3l9 7.5M5 9v11h14V9M14.7 12.3a2.5 2.5 0 0 0-3.2 3.2L9 18l1 1 2.5-2.5a2.5 2.5 0 0 0 3.2-3.2L14.5 14.5l-1-1 1.2-1.2Z',
  poll: 'M4 4h16v16H4zM8 12l3 3 5-6',
  meeting:
    'M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm4 9h6m-6 3h4',
  event:
    'M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm7 7 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4L12 12Z',
  community: 'M4 5h16v10H9l-5 4V5Zm4 4h8m-8 3h5',
  language:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18m-9-9a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18',
  major_works:
    'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L15 12l-3-3 2.7-2.7Z',
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

const ROUTE_LABELS: Readonly<Record<string, string>> = {
  actions: 'Actions',
  admin: 'Dashboard',
  amc: 'AMC',
  amenities: 'Amenities',
  analytics: 'Analytics',
  assets: 'Assets',
  audit: 'Audit Logs',
  bills: 'Bills',
  categories: 'Categories',
  community: 'Community',
  deliveries: 'Deliveries',
  developer: 'Developer',
  directory: 'Directory',
  documents: 'Documents',
  edit: 'Edit',
  errors: 'Error Logs',
  events: 'Events',
  expenses: 'Expenses',
  generate: 'Generate',
  guard: 'Gate',
  guards: 'Guards',
  groups: 'Groups',
  health: 'Health',
  home: 'Home',
  'home-services': 'Home services',
  household: 'Household',
  housekeeping: 'Housekeeping',
  jobs: 'Jobs',
  login: 'Sign In',
  marketplace: 'Marketplace',
  meetings: 'Meetings',
  members: 'People',
  metering: 'Meters',
  mine: 'My listings',
  mutes: 'Mutes',
  new: 'New',
  notices: 'Notices',
  notifications: 'Notifications',
  parking: 'Parking',
  patrol: 'Patrol',
  polls: 'Polls',
  posts: 'Posts',
  print: 'Print',
  profile: 'Profile',
  pay: 'Pay',
  representatives: 'Representatives',
  reports: 'Reports',
  register: 'Register',
  requests: 'Requests',
  settings: 'Settings',
  setup: 'Setup',
  sos: 'Emergency',
  staff: 'Staff',
  structure: 'Structure',
  units: 'Units',
  tenancy: 'Tenancy',
  vendors: 'Vendors',
  vehicle: 'Vehicle lookup',
  visitors: 'Visitors',
  users: 'Users',
  erase: 'Erase',
};

function displayLabel(segment: string) {
  return (
    ROUTE_LABELS[segment] ??
    segment
      .replaceAll('_', ' ')
      .replace(/^\w/, (letter) => letter.toUpperCase())
  );
}

function translateRouteLabel(segment: string, translate: Translate) {
  const label = ROUTE_LABELS[segment];
  if (!label) return displayLabel(segment);
  return translate(label);
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

export function ModuleIcon({ moduleKey }: { moduleKey: ModuleKey }) {
  return <SvgIcon path={MODULE_ICONS[moduleKey]} />;
}

function NavigationIcon({ item }: { item: ShellNavigationItem }) {
  if (item.moduleKey) {
    return <ModuleIcon moduleKey={item.moduleKey} />;
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
  items: readonly (Omit<RoleNavigationItem, 'permission' | 'topic'> &
    Partial<Pick<RoleNavigationItem, 'topic'>>)[],
  role: SocietyRole,
  translate: Translate,
): ShellNavigationItem[] {
  return items.map((item) => ({
    href: item.href,
    icon: item.moduleKey,
    label: translate(item.label),
    moduleKey: item.moduleKey,
    section: translate(item.topic ?? item.section ?? 'Other'),
  }));
}

function Breadcrumbs({
  pathname,
  translate,
}: {
  pathname: string;
  translate: Translate;
}) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 2) {
    return null;
  }

  return (
    <nav
      aria-label={translate('Breadcrumb')}
      className="mt-space-1 hidden expanded:block"
    >
      <ol className="flex flex-wrap items-center gap-space-2 text-caption text-ink-muted">
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const current = index === segments.length - 1;
          return (
            <li className="flex items-center gap-space-2" key={href}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {current ? (
                <span aria-current="page">
                  {translateRouteLabel(segment, translate)}
                </span>
              ) : (
                <Link
                  className="underline-offset-2 hover:underline"
                  href={href}
                >
                  {translateRouteLabel(segment, translate)}
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
  switchSociety: switchSocietyServer,
  switchPlace: switchPlaceServer,
  pathname,
  places = [],
  quickActions = [],
  workspaceSearchAction,
  role,
  translate,
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
  switchSociety?: (societyId: string) => Promise<{
    ok: boolean;
    message?: string;
  }>;
  switchPlace?: (input: {
    societyId: string;
    unitId?: string | null;
    allFlats?: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  pathname: string;
  places?: readonly PlaceOption[];
  role: SocietyRole | 'developer';
  translate: Translate;
  societies?: readonly SocietyOption[];
  quickActions?: readonly WorkspaceQuickAction[];
  workspaceSearchAction?: (
    input: unknown,
  ) => Promise<ServerActionResult<WorkspaceSearchResult>>;
  unreadNotifications?: number;
}) {
  const router = useRouter();
  const [switchError, setSwitchError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [switchingSociety, startSocietySwitch] = useTransition();
  const segments = pathname.split('/').filter(Boolean);
  const pageTitle = translateRouteLabel(segments.at(-1) ?? 'home', translate);
  const backHref =
    segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : homeHref;
  const barColor = dark
    ? 'border-dev-label/30 bg-dev-bar text-surface'
    : 'border-rule bg-surface text-ink';
  const menuColor = dark
    ? 'text-dev-label hover:bg-surface/10'
    : 'text-brand hover:bg-brand-tint';
  const activeSociety = societies.find(
    (society) => society.id === activeSocietyId,
  );
  const activePlace =
    places.find(
      (place) =>
        place.societyId === activeSocietyId &&
        (pathname === place.href || pathname.startsWith(`${place.href}/`)) &&
        (place.active || place.href !== '/home'),
    )?.label ?? (role === 'resident' ? 'My home' : 'Work');
  useEffect(() => {
    const message = window.sessionStorage.getItem('homeish:place-announcement');
    if (message) {
      queueMicrotask(() => setAnnouncement(message));
      window.sessionStorage.removeItem('homeish:place-announcement');
    }
    const place = places.find(
      (candidate) =>
        candidate.societyId === activeSocietyId &&
        (pathname === candidate.href ||
          pathname.startsWith(`${candidate.href}/`)),
    );
    if (place) {
      window.localStorage.setItem(
        `homeish:last-place:${place.societyId}`,
        place.href,
      );
    }
  }, [activeSocietyId, pathname, places]);
  const switchPlace = (place: PlaceOption) => {
    setSwitchError('');
    startSocietySwitch(async () => {
      const message = translate('Now viewing {place}', {
        place: `${place.label} at ${place.societyName}`,
      });
      window.sessionStorage.setItem('homeish:place-announcement', message);
      window.localStorage.setItem(
        `homeish:last-place:${place.societyId}`,
        place.href,
      );
      if (switchPlaceServer) {
        const result = await switchPlaceServer({
          societyId: place.societyId,
          ...(place.unitId !== undefined
            ? { unitId: place.unitId, allFlats: place.allFlats ?? false }
            : {}),
        });
        if (!result.ok) {
          setSwitchError(result.message ?? translate('Society change failed.'));
          return;
        }
      } else if (place.societyId !== activeSocietyId) {
        onSocietyChange?.(place.societyId);
        if (!switchSocietyServer) {
          setSwitchError(translate('Society switching is unavailable.'));
          return;
        }
        const result = await switchSocietyServer(place.societyId);
        if (!result.ok) {
          setSwitchError(result.message ?? translate('Society change failed.'));
          return;
        }
      }
      if (place.societyId === activeSocietyId) {
        setAnnouncement(message);
        router.refresh();
        router.push(place.href);
        return;
      }
      window.location.assign(place.href);
    });
  };

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
            aria-label={translate('Back to {label}', {
              label: translateRouteLabel(segments.at(-2) ?? '', translate),
            })}
            className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-title focus-visible:outline-2 focus-visible:outline-focus ${menuColor}`}
            href={backHref}
          >
            <span aria-hidden="true">←</span>
          </Link>
        ) : (
          <Link
            aria-label={translate('Homeish home')}
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
              : (activeSociety?.name ?? 'Homeish')}
          </p>
          {role === 'admin' ||
          role === 'committee' ||
          role === 'hk_supervisor' ||
          role === 'developer' ? (
            <Breadcrumbs pathname={pathname} translate={translate} />
          ) : null}
        </div>

        {role !== 'developer' && places.length > 1 ? (
          <details className="relative hidden expanded:block">
            <summary
              aria-label={translate('Choose place: {place}', {
                place: `${activePlace}${activeSociety ? ` · ${activeSociety.name}` : ''}`,
              })}
              className="flex min-h-12 max-w-64 cursor-pointer list-none items-center gap-space-2 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="truncate">
                {activePlace}
                {activeSociety ? ` · ${activeSociety.name}` : ''}
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="absolute right-0 top-full z-30 mt-space-2 grid min-w-72 gap-space-4 rounded-md border border-rule bg-surface p-space-4 text-ink shadow-overlay">
              {societies.map((society) => {
                const societyPlaces = places.filter(
                  (place) => place.societyId === society.id,
                );
                if (!societyPlaces.length) return null;
                return (
                  <div className="grid gap-space-2" key={society.id}>
                    <p className="text-micro font-semibold uppercase tracking-wide text-ink-muted">
                      {society.name}
                    </p>
                    {societyPlaces.map((place) => (
                      <button
                        className="min-h-11 rounded-sm px-space-3 py-space-2 text-left text-body hover:bg-brand-tint"
                        disabled={switchingSociety}
                        key={`${place.societyId}-${place.unitId ?? (place.allFlats ? 'all' : place.href)}`}
                        onClick={() => switchPlace(place)}
                        type="button"
                      >
                        {translate(place.label)}
                      </button>
                    ))}
                  </div>
                );
              })}
              {switchError ? (
                <p className="text-caption text-danger" role="alert">
                  {switchError}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}
        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>

        {role !== 'developer' ? (
          <WorkspaceTools
            quickActions={quickActions}
            searchAction={workspaceSearchAction}
          />
        ) : null}

        <NotificationBell
          dark={dark}
          initialUnreadCount={unreadNotifications}
        />

        <details className="relative">
          <summary
            aria-label={translate('Account')}
            className={`flex min-h-12 cursor-pointer list-none items-center gap-space-2 rounded-md px-space-3 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuColor}`}
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-neutral-tint text-ink"
            >
              <SvgIcon path="M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            </span>
            <span className="hidden medium:inline">{translate('Account')}</span>
          </summary>
          <div
            className={`absolute right-0 top-full z-30 mt-space-2 grid min-w-48 gap-space-1 rounded-md border p-space-2 shadow-overlay ${dark ? 'border-dev-label/30 bg-dev-bar text-surface' : 'border-rule bg-surface text-ink'}`}
          >
            <Link
              className={`rounded-sm px-space-3 py-space-2 ${dark ? 'hover:bg-surface/10' : 'hover:bg-brand-tint'}`}
              href="/profile"
            >
              {translate('Profile')}
            </Link>
            <Link
              className={`rounded-sm px-space-3 py-space-2 ${dark ? 'hover:bg-surface/10' : 'hover:bg-brand-tint'}`}
              href="/login"
            >
              {translate('Sign Out')}
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
  topicHref,
  desktopOnly = false,
  translate,
}: {
  dark?: boolean;
  items: readonly ShellNavigationItem[];
  pathname: string;
  collapsed?: boolean;
  onToggle?: () => void;
  topicHref?: (topic: string) => string;
  desktopOnly?: boolean;
  translate: Translate;
}) {
  const sections = [...new Set(items.map((item) => item.section))];
  const surface = dark
    ? 'border-dev-label/30 bg-dev-bar text-surface'
    : 'border-rule bg-surface text-ink';

  return (
    <aside
      aria-label={translate('Primary navigation')}
      className={`fixed bottom-0 left-0 top-14 z-10 hidden flex-col border-r pt-space-4 expanded:top-16 ${desktopOnly ? 'expanded:flex' : 'medium:flex'} ${collapsed ? 'medium:w-16' : 'medium:w-64'} expanded:w-64 ${surface}`}
    >
      {onToggle ? (
        <button
          aria-expanded={!collapsed}
          aria-label={translate(
            collapsed ? 'Expand navigation' : 'Collapse navigation',
          )}
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
            {translate(collapsed ? 'Expand' : 'Collapse')}
          </span>
        </button>
      ) : null}
      <nav
        className="flex-1 overflow-y-auto px-space-2 pb-space-4"
        aria-label={translate('Sections')}
      >
        {sections.map((section) => (
          <details
            className="group mb-space-4"
            key={section}
            onToggle={(event) => {
              const containsCurrentPage = items.some(
                (item) =>
                  item.section === section && isActivePath(pathname, item.href),
              );
              if (containsCurrentPage && !event.currentTarget.open) {
                event.currentTarget.open = true;
              }
            }}
            open
          >
            <summary
              className={`flex cursor-pointer list-none items-center justify-between px-space-3 py-space-2 text-micro font-semibold uppercase tracking-wide ${dark ? 'text-dev-label' : 'text-ink-muted'} ${collapsed ? 'medium:sr-only expanded:not-sr-only' : ''}`}
            >
              <h2>{section}</h2>
              <span
                aria-hidden="true"
                className="transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            {topicHref ? (
              <Link
                className={`mx-space-3 mb-space-1 block text-caption underline-offset-2 hover:underline ${dark ? 'text-dev-label' : 'text-brand'}`}
                href={topicHref(section)}
              >
                {translate('Open {section}', { section })}
              </Link>
            ) : null}
            <ul className="grid gap-space-1">
              {items
                .filter((item) => item.section === section)
                .map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? 'page' : undefined}
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
          </details>
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
  translate,
}: {
  items: readonly ShellNavigationItem[];
  onOpenMore: () => void;
  pathname: string;
  moreOpen: boolean;
  translate: Translate;
}) {
  const hasMore = true;
  const columnCount = items.length + 1;
  const moreActive = !items.some((item) => isActivePath(pathname, item.href));

  return (
    <nav
      aria-label={translate('Primary navigation')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-surface pb-space-1 medium:pb-space-2 expanded:hidden"
    >
      <ul
        className="mx-auto grid max-w-content-default"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
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
              aria-label={translate(
                moreActive ? 'More, current section' : 'More',
              )}
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
              <span>{translate('More')}</span>
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
  switchSociety: switchSocietyServer,
  switchPlace: switchPlaceServer,
  onOpenChange,
  open,
  places = [],
  societies = [],
  showAccountActions = true,
  title = 'More',
  translate,
}: {
  activeSocietyId?: string;
  dark?: boolean;
  items: readonly ShellNavigationItem[];
  onSocietyChange?: (societyId: string) => void;
  switchSociety?: (societyId: string) => Promise<{
    ok: boolean;
    message?: string;
  }>;
  switchPlace?: (input: {
    societyId: string;
    unitId?: string | null;
    allFlats?: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  places?: readonly PlaceOption[];
  societies?: readonly SocietyOption[];
  showAccountActions?: boolean;
  title?: string;
  translate: Translate;
}) {
  const router = useRouter();
  const [switchError, setSwitchError] = useState('');
  const switchPlace = async (place: PlaceOption) => {
    window.localStorage.setItem(
      `homeish:last-place:${place.societyId}`,
      place.href,
    );
    window.sessionStorage.setItem(
      'homeish:place-announcement',
      translate('Now viewing {place}', {
        place: `${place.label} at ${place.societyName}`,
      }),
    );
    if (switchPlaceServer) {
      const result = await switchPlaceServer({
        societyId: place.societyId,
        ...(place.unitId !== undefined
          ? { unitId: place.unitId, allFlats: place.allFlats ?? false }
          : {}),
      });
      if (!result.ok) {
        setSwitchError(result.message ?? translate('Society change failed.'));
        return;
      }
    } else if (place.societyId !== activeSocietyId) {
      onSocietyChange?.(place.societyId);
      if (!switchSocietyServer) {
        setSwitchError(translate('Society switching is unavailable.'));
        return;
      }
      const result = await switchSocietyServer(place.societyId);
      if (!result.ok) {
        setSwitchError(result.message ?? translate('Society change failed.'));
        return;
      }
    }
    if (place.societyId === activeSocietyId) {
      onOpenChange(false);
      router.refresh();
      router.push(place.href);
      return;
    }
    window.location.assign(place.href);
  };
  const menuItemStyle = dark
    ? 'border-dev-label/30 hover:bg-surface/10'
    : 'border-rule hover:bg-surface-sunken';

  return (
    <Dialog
      className={`!inset-0 !h-dvh !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none ${dark ? '!border-dev-label/30 !bg-dev-bar !text-surface' : ''}`}
      description={
        showAccountActions
          ? translate('Additional destinations and account actions.')
          : translate('Developer tools and platform destinations.')
      }
      id="shell-more-menu"
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    >
      <ul className="grid gap-space-5">
        {places.length > 1 ? (
          <li className="grid gap-space-2">
            <h3 className="px-space-1 text-micro font-semibold uppercase tracking-wide text-ink-muted">
              {translate('Place')}
            </h3>
            {societies.flatMap((society) =>
              places
                .filter((place) => place.societyId === society.id)
                .map((place) => (
                  <button
                    className={`flex min-h-14 items-center justify-between rounded-md border px-space-4 text-left text-body-strong ${menuItemStyle}`}
                    key={`${place.societyId}-${place.unitId ?? (place.allFlats ? 'all' : place.href)}`}
                    onClick={() => void switchPlace(place)}
                    type="button"
                  >
                    <span className="grid gap-space-1">
                      <span>{translate(place.label)}</span>
                      <span className="text-caption font-normal text-ink-muted">
                        {society.name}
                      </span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                )),
            )}
          </li>
        ) : null}
        {switchError ? (
          <li className="text-caption text-danger" role="alert">
            {switchError}
          </li>
        ) : null}
        {[...new Set(items.map((item) => item.section))].map((section) => (
          <li className="grid gap-space-2" key={section}>
            <h3 className="px-space-1 text-micro font-semibold uppercase tracking-wide text-ink-muted">
              {section}
            </h3>
            <ul className="grid gap-space-2">
              {items
                .filter((item) => item.section === section)
                .map((item) => (
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
            </ul>
          </li>
        ))}
        {showAccountActions ? (
          <>
            <li>
              <Link
                className={`flex min-h-14 items-center rounded-md border px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuItemStyle}`}
                href="/profile"
                onClick={() => onOpenChange(false)}
              >
                {translate('Profile and Settings')}
              </Link>
            </li>
            <li>
              <Link
                className={`flex min-h-14 items-center rounded-md border px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${menuItemStyle}`}
                href="/login"
                onClick={() => onOpenChange(false)}
              >
                {translate('Sign Out')}
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
  places = [],
  permissionMaps,
  role,
  quickActions = [],
  workspaceSearchAction,
  switchSociety,
  switchPlace,
  showPettyCash = false,
  societies = [],
  unreadNotifications,
}: SocietyShellProps) {
  const { locale, translate } = useLanguage();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const isResident = role === 'resident';
  const isGuard = role === 'guard';
  const isStaff =
    role === 'admin' || role === 'committee' || role === 'hk_supervisor';
  const navigation = normalizeRoleNavigation(
    [
      ...getRoleNavigation([role], enabledModules, permissionMaps),
      ...(showPettyCash
        ? [
            {
              href: '/petty-cash',
              label: 'Petty cash',
              moduleKey: 'expense' as const,
            },
          ]
        : []),
    ],
    role,
    translate,
  );
  const tabHrefs = new Set(
    getRoleTabs(role, enabledModules, permissionMaps).map((item) => item.href),
  );
  const tabs = navigation.filter((item) => tabHrefs.has(item.href));
  const moreItems = navigation.filter((item) => !tabHrefs.has(item.href));
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
    <div className="min-h-dvh bg-paper text-ink" lang={locale}>
      <a
        aria-label={translate('Skip to content')}
        className="sr-only focus:not-sr-only focus:fixed focus:left-space-4 focus:top-space-4 focus:z-50 focus:rounded-md focus:bg-surface focus:p-space-3"
        href="#main-content"
      >
        {translate('Skip to content')}
      </a>
      <TopBar
        activeSocietyId={activeSocietyId}
        homeHref={rootHref}
        onSocietyChange={onSocietyChange}
        pathname={pathname}
        places={places}
        switchSociety={switchSociety}
        switchPlace={switchPlace}
        quickActions={quickActions}
        workspaceSearchAction={workspaceSearchAction}
        role={role}
        translate={translate}
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
          topicHref={
            role === 'admin' || role === 'committee'
              ? (topic) =>
                  `/admin/groups/${encodeURIComponent(topic.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'))}`
              : undefined
          }
          desktopOnly={isResident}
          translate={translate}
        />
      ) : null}
      <div className={marginClasses}>
        <main
          className={`min-h-[calc(100dvh-3.5rem)] px-space-4 py-space-5 medium:px-space-5 medium:py-space-6 expanded:min-h-[calc(100dvh-4rem)] ${bottomPadding} ${shellMainClasses} ${isGuard ? 'pt-space-6' : ''}`}
          id="main-content"
        >
          {isGuard || enabledModules.includes('sos') ? (
            <SosAlertBanner alarm={isGuard} />
          ) : null}
          {children}
        </main>
      </div>
      {!isGuard ? (
        <BottomNavigation
          items={tabs}
          onOpenMore={() => setMoreOpen(true)}
          pathname={pathname}
          moreOpen={moreOpen}
          translate={translate}
        />
      ) : null}
      <MoreMenu
        activeSocietyId={activeSocietyId}
        items={moreItems}
        onSocietyChange={onSocietyChange}
        onOpenChange={setMoreOpen}
        open={moreOpen}
        places={places}
        switchSociety={switchSociety}
        switchPlace={switchPlace}
        societies={societies}
        title={translate('More')}
        translate={translate}
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
  const translate: Translate = (source) => source;

  return (
    <div className="min-h-dvh bg-dev-bar text-surface">
      <a
        aria-label="Skip to content"
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
        translate={translate}
      />
      <SideNavigation
        collapsed={!railExpanded}
        dark
        items={darkItems}
        onToggle={() => setRailExpanded((expanded) => !expanded)}
        pathname={pathname}
        translate={translate}
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
        translate={translate}
      />
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  const { locale } = useLanguage();
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-space-5 bg-paper px-space-4 py-space-6"
      lang={locale}
    >
      <LanguageSelector />
      <Link className="text-title font-semibold text-brand" href="/">
        Homeish
      </Link>
      <section className="w-full max-w-content-narrow rounded-md border border-rule bg-surface p-space-5 medium:p-space-6">
        {children}
      </section>
    </main>
  );
}
