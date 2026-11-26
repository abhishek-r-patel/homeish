// Show the resident's household balance, enabled shortcuts and recent activity.
'use client';

import Link from 'next/link';
import { MotionConfig, motion } from 'motion/react';
import { StatusChip, type ProductStatus } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleIconTile } from '@/components/ui/module-icon';
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
import {
  ComingUp,
  QuickActionTiles,
  ResidentGraph,
} from './dashboard-sections';
import {
  DuesCard,
  HomeGreeting,
  PendingRow,
  riseIn,
  staggerChildren,
} from './resident-home-cards';

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
  quickActions,
  allQuickActions,
  comingUp = [],
  graph,
}: Pick<ResidentHomeData, 'snapshot' | 'outstanding' | 'shortcuts'> &
  Partial<
    Pick<
      ResidentHomeData,
      'quickActions' | 'allQuickActions' | 'comingUp' | 'graph'
    >
  > & {
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
  const resolvedActions =
    quickActions ?? shortcuts.map((item) => ({ key: item.href, ...item }));

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        animate="shown"
        className="grid min-w-0 gap-space-6"
        initial="hidden"
        variants={staggerChildren}
      >
        <HomeGreeting
          eyebrow={t('My home')}
          name={snapshot.resident_name}
          title={t('Hello {name}', { name: snapshot.resident_name })}
        >
          <p className="flex flex-wrap items-center gap-x-space-2 text-caption text-ink-muted">
            {snapshot.units.length ? (
              <span className="rounded-full bg-surface-sunken px-space-2 py-space-1 font-semibold text-ink">
                {t('{unitLabel} {units}', {
                  unitLabel: snapshot.unit_label,
                  units: snapshot.units.map((unit) => unit.number).join(', '),
                })}
              </span>
            ) : null}
            <span>
              {t('Updated {time}', {
                time: formatLocalizedTime(
                  new Date(snapshot.server_now),
                  displayLocale,
                  { timeZone: snapshot.timezone },
                ),
              })}
            </span>
          </p>
        </HomeGreeting>

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
          <motion.section
            aria-labelledby="home-action-needed"
            className="grid gap-space-3"
            variants={staggerChildren}
          >
            <h2 className="text-heading" id="home-action-needed">
              {t('Needs attention')}
            </h2>
            {hasDues ? (
              <DuesCard
                actionLabel={t('View Bills')}
                amount={formatLocalizedCurrency(total, displayLocale)}
                dueLine={
                  displayDueDate && nextDue
                    ? nextDue < today
                      ? t('Overdue since {date}', { date: displayDueDate })
                      : t('Next due {date}', { date: displayDueDate })
                    : null
                }
                isOverdue={nextDue !== null && nextDue < today}
                label={t('Amount due')}
              />
            ) : null}
            {hasPending ? (
              <motion.ul
                className="grid gap-space-3 medium:grid-cols-2"
                variants={riseIn}
              >
                {snapshot.pending_visitors > 0 ? (
                  <li>
                    <PendingRow
                      href="/visitors"
                      label={t(
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
                      moduleKey="visitor"
                    />
                  </li>
                ) : null}
                {snapshot.pending_deliveries > 0 ? (
                  <li>
                    <PendingRow
                      href="/deliveries"
                      label={t(
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
                      moduleKey="delivery"
                    />
                  </li>
                ) : null}
              </motion.ul>
            ) : null}
          </motion.section>
        ) : null}

        <motion.div variants={riseIn}>
          <QuickActionTiles
            actions={resolvedActions}
            availableActions={allQuickActions ?? resolvedActions}
            firstFourOnPhone
          />
        </motion.div>

        {graph ? (
          <motion.div variants={riseIn}>
            <ResidentGraph graph={graph} />
          </motion.div>
        ) : null}

        <motion.div variants={riseIn}>
          <ComingUp items={comingUp} timezone={snapshot.timezone} />
        </motion.div>

        <motion.section
          aria-labelledby="home-activity"
          className="grid gap-space-3"
          variants={riseIn}
        >
          <h2 className="text-heading" id="home-activity">
            {t('Recent activity')}
          </h2>
          {snapshot.activity.length ? (
            <ul className="overflow-hidden rounded-lg border border-rule bg-surface shadow-card">
              {snapshot.activity.map((item) => (
                <li
                  className="border-b border-rule last:border-b-0"
                  key={`${item.module}-${item.id}`}
                >
                  <Link
                    className="flex min-h-16 flex-wrap items-center justify-between gap-space-3 p-space-4 transition-colors duration-motion-fast hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus"
                    href={activityLink(item)}
                  >
                    <ModuleIconTile moduleKey={item.module} size="sm" />
                    <span className="grid min-w-0 flex-1 gap-space-1">
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
        </motion.section>
      </motion.div>
    </MotionConfig>
  );
}
