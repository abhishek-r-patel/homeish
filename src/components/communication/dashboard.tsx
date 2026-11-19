// Show monthly communication figures across notices, meetings, events, SOS, service requests and the contact log.
'use client';
import { StatTile } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedDate } from '@/core/i18n/format';
import type { CommunicationDashboard } from '@/core/communication/validation';
import { COMMUNICATION_HREF } from '@/core/communication/validation';

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function CommunicationDashboardScreen({
  dashboard,
  currentMonth,
}: {
  dashboard: CommunicationDashboard;
  currentMonth: string;
}) {
  const { translate: t, locale } = useUiTranslator();
  const monthLabel = formatLocalizedDate(
    new Date(`${dashboard.month}-01T00:00:00.000Z`),
    locale ?? 'en',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );
  const previous = shiftMonth(dashboard.month, -1);
  const next = shiftMonth(dashboard.month, 1);
  const { notices, meetings, events, sos, requests, contact_log } = dashboard;
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Communication')}</h1>
        <p className="text-ink-muted">
          {t(
            'A monthly view of how the society reached members and how member contacts were handled.',
          )}
        </p>
      </header>
      <form
        method="get"
        action={COMMUNICATION_HREF}
        className="flex flex-wrap items-end gap-space-3"
      >
        <a
          href={`${COMMUNICATION_HREF}?month=${previous}`}
          className="inline-flex min-h-12 items-center text-brand underline"
        >
          {t('Previous month')}
        </a>
        <label className="grid gap-space-1">
          <span className="text-caption text-ink-muted">{t('Month')}</span>
          <input
            type="month"
            name="month"
            max={currentMonth}
            defaultValue={dashboard.month}
            className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center rounded-md border border-rule px-space-4"
        >
          {t('Show')}
        </button>
        {next <= currentMonth ? (
          <a
            href={`${COMMUNICATION_HREF}?month=${next}`}
            className="inline-flex min-h-12 items-center text-brand underline"
          >
            {t('Next month')}
          </a>
        ) : null}
      </form>
      <h2 className="text-heading font-semibold">{monthLabel}</h2>
      <Banner tone="info">
        {t(
          'Figures count records in Homeish only. Sections for modules that are switched off are hidden.',
        )}
      </Banner>
      {notices ? (
        <DashboardSection title={t('Notices')}>
          <StatTile
            label={t('Posted')}
            value={notices.posted}
            context={t('Notices published to members this month.')}
          />
          <StatTile
            label={t('Removed')}
            value={notices.removed}
            context={t('Posted notices withdrawn or expired this month.')}
          />
          <StatTile
            label={t('Planned now')}
            value={notices.planned_now}
            context={t('Drafts and scheduled notices waiting to be posted.')}
          />
        </DashboardSection>
      ) : null}
      {meetings ? (
        <DashboardSection title={t('Meetings')}>
          <StatTile
            label={t('Meeting notices issued')}
            value={meetings.notices_issued}
            context={t('Meetings scheduled to take place this month.')}
          />
        </DashboardSection>
      ) : null}
      {events ? (
        <DashboardSection title={t('Events')}>
          <StatTile
            label={t('Events published')}
            value={events.published}
            context={t('Events shared with members this month.')}
          />
        </DashboardSection>
      ) : null}
      {sos ? (
        <DashboardSection title={t('SOS')}>
          <StatTile
            label={t('Alerts raised')}
            value={sos.raised}
            context={t(
              'SOS alerts raised this month, not counting cancelled ones.',
            )}
          />
        </DashboardSection>
      ) : null}
      {requests ? (
        <DashboardSection title={t('Service requests')}>
          <StatTile
            label={t('Received')}
            value={requests.received}
            context={t('Requests raised this month.')}
          />
          <StatTile
            label={t('Resolved')}
            value={requests.resolved}
            context={t('Requests resolved this month.')}
          />
          <StatTile
            label={t('Average days to resolve')}
            value={requests.avg_days ?? '—'}
            context={t('For requests resolved this month.')}
          />
        </DashboardSection>
      ) : null}
      <DashboardSection title={t('Contact log')}>
        <StatTile
          label={t('Contacts logged')}
          value={contact_log.logged}
          context={t('Contacts dated this month.')}
        />
        <StatTile
          label={t('Contacts closed')}
          value={contact_log.closed}
          context={t('Entries closed this month.')}
        />
        <StatTile
          label={t('Open now')}
          value={contact_log.open_now}
          href="/admin/contact-log?status=open"
          context={t('Entries not yet closed, today.')}
        />
        <StatTile
          label={t('Follow-up overdue')}
          value={contact_log.follow_up_overdue}
          context={t('Open entries whose follow-up date has passed, today.')}
        />
      </DashboardSection>
    </section>
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-space-3" aria-label={title}>
      <h3 className="text-body-strong">{title}</h3>
      <div className="grid min-w-0 gap-space-3 medium:grid-cols-2 large:grid-cols-4">
        {children}
      </div>
    </section>
  );
}
