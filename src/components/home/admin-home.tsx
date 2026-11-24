// Show the admin and committee dashboard (A-01): today's figures, the next meeting, items needing attention
// and recent activity, with each section loading or failing on its own.
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatTile } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import type {
  AdminActionsFeed,
  AdminHomeData,
} from '@/core/home/admin-operations';
import {
  ADMIN_ACTIVITY_LABELS,
  adminActionLabel,
  adminActivityLink,
} from '@/core/home/admin-presentation';
import {
  formatLocalizedCurrency,
  formatLocalizedDateTime,
  formatLocalizedNumber,
  formatLocalizedTime,
} from '@/core/i18n/format';
import {
  CollectionGraph,
  ComingUp,
  QuickActionTiles,
} from './dashboard-sections';

const RETRY_HREF = '/admin';
const rowClass =
  'flex min-h-14 flex-wrap items-center justify-between gap-space-3 p-space-4 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus';
const listClass =
  'overflow-hidden rounded-md border border-rule bg-surface [&>li]:border-b [&>li]:border-rule [&>li:last-child]:border-b-0';

type Snapshot = AdminHomeData['snapshot'];
type Tile = { key: string; label: string; href: string; value: string | null };
type AttentionRow = {
  key: string;
  label: string;
  href: string;
  count: number | null;
  context?: string;
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-space-3">
      <h2 className="text-heading" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function UnavailableRow({ label }: { label: string }) {
  const { translate: t } = useUiTranslator();
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-space-3 p-space-4">
      <span className="grid gap-space-1">
        <span className="text-body-strong">{label}</span>
        <span className="text-caption text-ink-muted">{t('Unavailable')}</span>
      </span>
      <Link className="text-body-strong underline" href={RETRY_HREF}>
        {t('Retry')}
      </Link>
    </div>
  );
}

function ok<T extends { status: string }>(section: T | null) {
  return section?.status === 'ok'
    ? (section as Extract<T, { status: 'ok' }>)
    : null;
}

function todayTiles(
  snapshot: Snapshot,
  money: (paise: string) => string,
  count: (value: number) => string,
) {
  const tiles: Tile[] = [];
  const { visitors, requests, billing } = snapshot;
  if (visitors) {
    const value = ok(visitors);
    tiles.push({
      key: 'visitors-today',
      label: 'Visitors today',
      href: '/admin/visitors',
      value: value ? count(value.today) : null,
    });
  }
  if (requests) {
    const value = ok(requests);
    tiles.push({
      key: 'requests-open',
      label: 'Open requests',
      href: '/admin/requests',
      value: value ? count(value.open) : null,
    });
  }
  if (billing) {
    const value = ok(billing);
    tiles.push(
      {
        key: 'billing-collected',
        label: 'Collected this month',
        href: '/admin/billing?tab=reports',
        value: value ? money(value.collected_month_paise) : null,
      },
      {
        key: 'billing-outstanding',
        label: 'Outstanding',
        href: '/admin/billing?tab=reports',
        value: value ? money(value.outstanding_paise) : null,
      },
    );
  }
  return tiles;
}

function attentionRows(snapshot: Snapshot): AttentionRow[] {
  const rows: AttentionRow[] = [];
  const { billing, amc, stock, tenancy, registrations, requests } = snapshot;
  if (requests) {
    rows.push({
      key: 'requests-overdue',
      label: 'Overdue requests',
      href: '/admin/requests?status=overdue',
      count: ok(requests)?.overdue ?? null,
    });
  }
  if (billing) {
    const value = ok(billing);
    rows.push(
      {
        key: 'overdue-units',
        label: 'Units with overdue bills',
        href: '/admin/billing?tab=reports',
        count: value?.overdue_units ?? null,
      },
      {
        key: 'pending-payments',
        label: 'Payments to confirm',
        href: '/admin/billing?tab=payments',
        count: value?.pending_payments ?? null,
      },
    );
  }
  if (amc) {
    rows.push({
      key: 'amc-urgent',
      label: 'AMC contracts ending soon',
      href: '/admin/amc?status=urgent',
      count: ok(amc)?.urgent ?? null,
    });
  }
  if (stock) {
    const value = ok(stock);
    rows.push({
      key: 'stock-low',
      label: 'Items low on stock',
      href: '/admin/housekeeping',
      count: value?.low ?? null,
      context: value ? 'out' : undefined,
    });
  }
  if (tenancy) {
    rows.push({
      key: 'tenancy-pending',
      label: 'Tenancy requests to review',
      href: '/admin/tenancy',
      count: ok(tenancy)?.pending ?? null,
    });
  }
  if (registrations) {
    rows.push({
      key: 'registrations-pending',
      label: 'Registrations to approve',
      href: '/admin/members',
      count: ok(registrations)?.pending ?? null,
    });
  }
  return rows;
}

function AdminActions({
  feed,
  timezone,
}: {
  feed: Exclude<AdminActionsFeed, null>;
  timezone: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const displayLocale = locale ?? 'en';
  return (
    <Section id="admin-home-actions" title={t('Admin actions')}>
      <p className="text-caption text-ink-muted">
        {t('Changes made by admins and committee members in the last 7 days.')}
      </p>
      {feed.status === 'unavailable' ? (
        <div className="rounded-md border border-rule bg-surface">
          <UnavailableRow label={t('Admin actions')} />
        </div>
      ) : feed.items.length ? (
        <ul className={listClass}>
          {feed.items.map((item) => (
            <li
              className="flex min-h-14 flex-wrap items-center justify-between gap-space-3 p-space-4"
              key={item.id}
            >
              <span className="grid gap-space-1">
                <span className="text-body-strong">
                  {t(adminActionLabel(item.action))}
                </span>
                <span className="text-caption text-ink-muted">
                  {item.actor_role === 'admin' ? t('Admin') : t('Committee')}
                </span>
              </span>
              <time
                className="text-caption text-ink-muted"
                dateTime={item.created_at}
              >
                {formatLocalizedDateTime(
                  new Date(item.created_at),
                  displayLocale,
                  {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: timezone,
                  },
                )}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          description={t(
            'Changes to payments, members, notices and settings will appear here.',
          )}
          title={t('No admin actions this week')}
        />
      )}
    </Section>
  );
}

export function AdminHome({
  snapshot,
  actions,
  suspended,
  quickActions = [],
  comingUp = [],
  collectionGraph = null,
  managingBodyName = 'Association',
}: Omit<
  AdminHomeData,
  'quickActions' | 'comingUp' | 'collectionGraph' | 'managingBodyName'
> &
  Partial<
    Pick<
      AdminHomeData,
      'quickActions' | 'comingUp' | 'collectionGraph' | 'managingBodyName'
    >
  >) {
  const { locale, translate: t } = useUiTranslator();
  const displayLocale = locale ?? 'en';
  const money = (paise: string) =>
    formatLocalizedCurrency(BigInt(paise), displayLocale);
  const count = (value: number) => formatLocalizedNumber(value, displayLocale);
  const dateTime = (value: string) =>
    formatLocalizedDateTime(new Date(value), displayLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: snapshot.timezone,
    });
  const tiles = todayTiles(snapshot, money, count);
  const attention = attentionRows(snapshot);
  const { activity, stock } = snapshot;
  const outOfStock = stock?.status === 'ok' ? stock.out : 0;

  return (
    <div className="grid min-w-0 gap-space-6">
      <header className="grid gap-space-2">
        <div className="rounded-lg border border-brand/15 bg-brand-tint p-space-5">
          <p className="text-micro font-semibold uppercase tracking-wide text-brand">
            {t('{name} · Managing today', { name: managingBodyName })}
          </p>
          <h1 className="mt-space-1 text-display font-semibold">
            {t('Dashboard')}
          </h1>
        </div>
        <p className="text-caption text-ink-muted">
          {t('Updated {time}', {
            time: formatLocalizedTime(
              new Date(snapshot.server_now),
              displayLocale,
              { timeZone: snapshot.timezone },
            ),
          })}
        </p>
      </header>

      {suspended ? (
        <Banner tone="info">
          {t('This society is suspended. The dashboard is read-only.')}
        </Banner>
      ) : null}

      {tiles.length ? (
        <Section id="admin-home-today" title={t('Today')}>
          <ul className="grid grid-cols-2 gap-space-3 medium:grid-cols-4">
            {tiles.map((tile) => (
              <li key={tile.key}>
                <StatTile
                  context={
                    tile.value === null ? t('Select to retry') : undefined
                  }
                  href={tile.value === null ? RETRY_HREF : tile.href}
                  label={t(tile.label)}
                  value={tile.value ?? t('Unavailable')}
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <QuickActionTiles actions={quickActions} />

      {attention.length ? (
        <Section id="admin-home-attention" title={t('Needs attention')}>
          <ul className={listClass}>
            {attention.map((row) => (
              <li key={row.key}>
                {row.count === null ? (
                  <UnavailableRow label={t(row.label)} />
                ) : (
                  <Link className={rowClass} href={row.href}>
                    <span className="grid gap-space-1">
                      <span className="text-body-strong">{t(row.label)}</span>
                      {row.context === 'out' && outOfStock > 0 ? (
                        <span className="text-caption text-ink-muted">
                          {t('{count} out of stock', {
                            count: count(outOfStock),
                          })}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-space-2 text-heading tabular-nums">
                      {count(row.count)}
                      <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {collectionGraph ? (
        <CollectionGraph points={collectionGraph.rows} />
      ) : null}

      <ComingUp items={comingUp} timezone={snapshot.timezone} />

      {activity ? (
        <Section id="admin-home-activity" title={t('Society activity')}>
          {activity.status === 'unavailable' ? (
            <div className="rounded-md border border-rule bg-surface">
              <UnavailableRow label={t('Society activity')} />
            </div>
          ) : activity.items.length ? (
            <ul className={listClass}>
              {activity.items.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link className={rowClass} href={adminActivityLink(item)}>
                    <span className="grid min-w-0 gap-space-1">
                      <span className="text-caption text-ink-muted">
                        {t(ADMIN_ACTIVITY_LABELS[item.kind])}
                        {item.unit_number ? ` · ${item.unit_number}` : ''}
                      </span>
                      {item.title ? (
                        <span className="break-words text-body-strong">
                          {item.title}
                        </span>
                      ) : null}
                      <time
                        className="text-caption text-ink-muted"
                        dateTime={item.occurred_at}
                      >
                        {dateTime(item.occurred_at)}
                      </time>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description={t(
                'Requests, notices, meetings and registrations from the last 30 days will appear here.',
              )}
              title={t('No recent activity')}
            />
          )}
        </Section>
      ) : null}

      {actions ? (
        <AdminActions feed={actions} timezone={snapshot.timezone} />
      ) : null}
    </div>
  );
}
