// Show the resident's household balance, enabled shortcuts and recent activity.
'use client';

import Link from 'next/link';
import { ModuleIcon } from '@/components/app-shells';
import { primaryLinkClass } from '@/components/billing/styles';
import { StatusChip, type ProductStatus } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { billDisplayStatus, todayInTimeZone } from '@/core/billing/format';
import {
  residentNextDueDate,
  residentOutstandingTotal,
} from '@/core/billing/resident-summary';
import type { ResidentHomeData } from '@/core/home/operations';
import type { ResidentHomeActivity } from '@/core/home/validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatLocalizedNumber,
  formatLocalizedTime,
} from '@/core/i18n/format';

function activityStatus(
  item: ResidentHomeActivity,
  today: string,
): ProductStatus {
  switch (item.module) {
    case 'visitor':
      return `visitor.${item.status}`;
    case 'delivery':
      return item.status === 'pending_response'
        ? 'delivery.pending'
        : `delivery.${item.status}`;
    case 'billing':
      return billDisplayStatus(item, today);
    case 'service_request':
      return `request.${item.status}`;
  }
}

function activityLink(item: ResidentHomeActivity): string {
  switch (item.module) {
    case 'visitor':
      return '/visitors';
    case 'delivery':
      return '/deliveries';
    case 'billing':
      return `/bills/${item.id}`;
    case 'service_request':
      return `/requests/${item.id}`;
  }
}

const moduleLabels = {
  visitor: 'Visitors',
  delivery: 'Deliveries',
  billing: 'Bills',
  service_request: 'Service requests',
} as const;

export function ResidentHome({
  snapshot,
  outstanding,
  shortcuts,
  suspended,
}: Pick<ResidentHomeData, 'snapshot' | 'outstanding' | 'shortcuts'> & {
  suspended: boolean;
}) {
  const { locale, translate: t } = useUiTranslator();
  const displayLocale = locale ?? 'en';
  const total =
    outstanding === null ? BigInt(0) : residentOutstandingTotal(outstanding);
  const nextDue =
    outstanding === null ? null : residentNextDueDate(outstanding);
  const today = todayInTimeZone(
    snapshot.timezone,
    new Date(snapshot.server_now),
  );
  const hasDues = outstanding !== null && total > BigInt(0);
  const hasPending =
    snapshot.pending_visitors > 0 || snapshot.pending_deliveries > 0;
  const displayDueDate = nextDue
    ? formatLocalizedDate(new Date(`${nextDue}T00:00:00Z`), displayLocale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;

  return (
    <div className="grid min-w-0 gap-space-6">
      <header className="grid gap-space-2">
        <h1 className="break-words text-display font-semibold">
          {t('Hello {name}', { name: snapshot.resident_name })}
        </h1>
        {snapshot.units.length ? (
          <p className="text-body text-ink-muted">
            {t('{unitLabel} {units}', {
              unitLabel: snapshot.unit_label,
              units: snapshot.units.map((unit) => unit.number).join(', '),
            })}
          </p>
        ) : null}
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
          {t('This society is suspended. Home information is read-only.')}
        </Banner>
      ) : null}
      {snapshot.units.length === 0 ? (
        <Banner title={t('No active unit linked')} tone="neutral">
          {t(
            'You are not linked to an active {unit}. Contact the society office if this is wrong.',
            { unit: snapshot.unit_label.toLowerCase() },
          )}
        </Banner>
      ) : null}

      {hasDues || hasPending ? (
        <section
          aria-labelledby="home-action-needed"
          className="grid gap-space-3"
        >
          <h2 className="text-heading" id="home-action-needed">
            {t('Action needed')}
          </h2>
          {hasDues ? (
            <div className="grid gap-space-4 rounded-lg border border-rule bg-surface p-space-5 medium:p-space-6">
              <div className="grid gap-space-2">
                <h3 className="text-body-strong">{t('Amount due')}</h3>
                <p className="break-all text-display font-semibold tabular-nums">
                  {formatLocalizedCurrency(total, displayLocale)}
                </p>
                {displayDueDate && nextDue ? (
                  <p
                    className={`text-body ${nextDue < today ? 'text-danger' : 'text-ink-muted'}`}
                  >
                    {nextDue < today
                      ? t('Overdue since {date}', { date: displayDueDate })
                      : t('Next due {date}', { date: displayDueDate })}
                  </p>
                ) : null}
              </div>
              <div>
                <Link className={primaryLinkClass} href="/bills">
                  {t('View Bills')}
                </Link>
              </div>
            </div>
          ) : null}
          {hasPending ? (
            <ul className="grid gap-space-3 medium:grid-cols-2">
              {snapshot.pending_visitors > 0 ? (
                <li>
                  <Link
                    className="flex min-h-14 items-center justify-between gap-space-3 rounded-md border border-rule bg-surface p-space-4 text-body-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    href="/visitors"
                  >
                    {t(
                      snapshot.pending_visitors === 1
                        ? '{count} visitor needs your response'
                        : '{count} visitors need your response',
                      {
                        count: formatLocalizedNumber(
                          snapshot.pending_visitors,
                          displayLocale,
                        ),
                      },
                    )}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ) : null}
              {snapshot.pending_deliveries > 0 ? (
                <li>
                  <Link
                    className="flex min-h-14 items-center justify-between gap-space-3 rounded-md border border-rule bg-surface p-space-4 text-body-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    href="/deliveries"
                  >
                    {t(
                      snapshot.pending_deliveries === 1
                        ? '{count} delivery needs your response'
                        : '{count} deliveries need your response',
                      {
                        count: formatLocalizedNumber(
                          snapshot.pending_deliveries,
                          displayLocale,
                        ),
                      },
                    )}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : null}

      {shortcuts.length ? (
        <section aria-labelledby="home-shortcuts" className="grid gap-space-3">
          <h2 className="text-heading" id="home-shortcuts">
            {t('Quick actions')}
          </h2>
          <ul className="grid grid-cols-2 gap-space-3 medium:grid-cols-3 expanded:grid-cols-4">
            {shortcuts.map((item) => (
              <li key={item.href}>
                <Link
                  className="flex min-h-24 flex-col items-start justify-between gap-space-3 rounded-md border border-rule bg-surface p-space-4 text-body-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  href={item.href}
                >
                  <ModuleIcon moduleKey={item.moduleKey} />
                  <span>{t(item.label)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="home-activity" className="grid gap-space-3">
        <h2 className="text-heading" id="home-activity">
          {t('Recent activity')}
        </h2>
        {snapshot.activity.length ? (
          <ul className="overflow-hidden rounded-md border border-rule bg-surface">
            {snapshot.activity.map((item) => (
              <li
                className="border-b border-rule last:border-b-0"
                key={`${item.module}-${item.id}`}
              >
                <Link
                  className="flex min-h-14 flex-wrap items-center justify-between gap-space-3 p-space-4 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus"
                  href={activityLink(item)}
                >
                  <span className="grid min-w-0 gap-space-1">
                    <span className="text-caption text-ink-muted">
                      {t(moduleLabels[item.module])}
                      {item.unit_number ? ` · ${item.unit_number}` : ''}
                    </span>
                    <span className="break-words text-body-strong">
                      {item.title}
                    </span>
                    <time
                      className="text-caption text-ink-muted"
                      dateTime={item.occurred_at}
                    >
                      {formatLocalizedDateTime(
                        new Date(item.occurred_at),
                        displayLocale,
                        {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: snapshot.timezone,
                        },
                      )}
                    </time>
                  </span>
                  <StatusChip status={activityStatus(item, today)} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            description={t('New updates will appear here.')}
            title={t('No activity yet')}
          />
        )}
      </section>
    </div>
  );
}
