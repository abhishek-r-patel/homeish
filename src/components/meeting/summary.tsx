// Show the P43.5 meeting and committee summary: meetings, quorum, attendance, resolutions and follow-up per person.
'use client';

import Link from 'next/link';
import { ReportPeriodLinks } from '@/components/analytics/report-period-links';
import { Card, StatTile } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { DataTable } from '@/components/ui/table-controls';
import type { ReportPeriod } from '@/core/analytics/report-period';
import { formatLocalizedNumber } from '@/core/i18n/format';
import type { MeetingGovernanceSummary } from '@/core/meeting/summary-validation';
import { MEETING_LINK_CLASS, formatMeetingDate } from './shared';

type Owner = MeetingGovernanceSummary['owners'][number];

const PERIOD_HREFS: Readonly<Record<ReportPeriod, string>> = {
  '6m': '/admin/meetings/summary?period=6m',
  '12m': '/admin/meetings/summary?period=12m',
  fy: '/admin/meetings/summary?period=fy',
};

export function MeetingSummaryHeadline({
  summary,
}: {
  summary: MeetingGovernanceSummary;
}) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  return (
    <div className="grid gap-space-3 medium:grid-cols-2 large:grid-cols-3">
      <StatTile
        context={t('{open} open action items · {overdue} overdue', {
          open: number(summary.actions.open),
          overdue: number(summary.actions.overdue),
        })}
        href="/admin/meetings/summary"
        label={t('Meetings held in the last 12 months')}
        value={number(summary.meetings.held)}
      />
    </div>
  );
}

export function MeetingSummaryView({
  summary,
}: {
  summary: MeetingGovernanceSummary & { period: ReportPeriod };
}) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const attendance =
    summary.average_attendance_percent === null
      ? t('Not available')
      : `${new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
          maximumFractionDigits: 1,
        }).format(summary.average_attendance_percent)}%`;
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <Link className={MEETING_LINK_CLASS} href="/admin/meetings">
          {t('← Meetings')}
        </Link>
        <h1 className="text-title font-semibold">{t('Meeting summary')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Meetings from {from} to {to}. Action items show their current state.',
            {
              from: formatMeetingDate(summary.from, locale),
              to: formatMeetingDate(summary.to, locale),
            },
          )}
        </p>
      </header>
      <ReportPeriodLinks current={summary.period} hrefs={PERIOD_HREFS} />
      <div className="grid gap-space-3 medium:grid-cols-2 large:grid-cols-4">
        <StatTile
          context={t('{scheduled} scheduled · {cancelled} cancelled', {
            scheduled: number(summary.meetings.scheduled),
            cancelled: number(summary.meetings.cancelled),
          })}
          label={t('Meetings held')}
          value={number(summary.meetings.held)}
        />
        <StatTile
          context={t('Held meetings with a quorum rule: {count}', {
            count: number(summary.quorum.with_rule),
          })}
          label={t('Quorum met')}
          value={number(summary.quorum.met)}
        />
        <StatTile
          context={t('Average across held meetings')}
          label={t('Attendance')}
          value={attendance}
        />
        <StatTile
          context={t('Held meetings without published minutes')}
          label={t('Minutes not published')}
          value={number(summary.minutes_unpublished)}
        />
      </div>
      <div className="grid gap-space-4 medium:grid-cols-2">
        <Card title={t('Resolutions')}>
          <dl className="grid grid-cols-2 gap-space-3">
            {(
              [
                ['Passed', summary.resolutions.passed],
                ['Failed', summary.resolutions.failed],
                ['Deferred', summary.resolutions.deferred],
                ['Outcome not recorded', summary.resolutions.pending],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption text-ink-muted">{t(label)}</dt>
                <dd className="text-heading tabular-nums">{number(value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title={t('Action items')}>
          <dl className="grid grid-cols-3 gap-space-3">
            {(
              [
                ['Open', summary.actions.open],
                ['Overdue', summary.actions.overdue],
                ['Done', summary.actions.done],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption text-ink-muted">{t(label)}</dt>
                <dd className="text-heading tabular-nums">{number(value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      <Card
        description={t(
          'Open action items from these meetings, grouped by the person responsible and sorted by next due date. This is a follow-up list, not a ranking.',
        )}
        title={t('Open action items by person')}
      >
        {summary.owners.length === 0 ? (
          <EmptyState
            description={t('Every action item from these meetings is done.')}
            title={t('No open action items')}
          />
        ) : (
          <DataTable<Owner>
            caption={t('Open action items by person')}
            columns={[
              {
                id: 'owner',
                header: t('Person'),
                render: (row) => row.owner_name,
              },
              {
                id: 'open',
                header: t('Open'),
                align: 'right',
                render: (row) => number(row.open),
              },
              {
                id: 'overdue',
                header: t('Overdue'),
                align: 'right',
                render: (row) => number(row.overdue),
              },
              {
                id: 'next',
                header: t('Next due'),
                render: (row) => formatMeetingDate(row.next_due_on, locale),
              },
            ]}
            getRowId={(row) => String(summary.owners.indexOf(row))}
            getRowLabel={(row) => row.owner_name}
            mobilePrimary={(row) => row.owner_name}
            mobileSecondary={(row) =>
              t('{open} open · {overdue} overdue · next due {date}', {
                open: number(row.open),
                overdue: number(row.overdue),
                date: formatMeetingDate(row.next_due_on, locale),
              })
            }
            rows={summary.owners}
          />
        )}
      </Card>
    </section>
  );
}
