// Admin billing workspace: bills, payment review, fines, reports and setup.
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AddFineForm,
  PaymentReviewQueue,
  RecordPaymentButton,
  ReportExportButtons,
} from '@/components/billing/admin-panels';
import {
  CollectionEfficiencyPanel,
  PaymentPlansPanel,
  RecoveryActionsPanel,
} from '@/components/billing/arrears';
import { BillingSetup } from '@/components/billing/setup';
import {
  DuesFollowUpPanel,
  MonthlyCollectionPanel,
} from '@/components/billing/collection-reports';
import { BillingEstimatePanel } from '@/components/billing/estimate';
import { primaryLinkClass, textLinkClass } from '@/components/billing/styles';
import { BillsTable, PaymentsTable } from '@/components/billing/tables';
import { Card, StatTile } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import {
  readReportPeriod,
  REPORT_PERIODS,
  type ReportPeriod,
} from '@/core/analytics/report-period';
import { todayInTimeZone } from '@/core/billing/format';
import {
  getBillingDuesFollowUp,
  getBillingMonthlyCollection,
} from '@/core/billing/collection-operations';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import {
  getBillingAdminContext,
  getBillingCollectionEfficiency,
  getBillingDashboard,
  getBillingReportSummary,
  listBillingEstimateCharges,
  getBillingSetup,
  listBillingPaymentPlanBills,
  listBillingPaymentPlans,
  listBillingRecoveryActions,
  listBillingBills,
  listBillingPayments,
  listBillingUnits,
} from '@/core/billing/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Billing | Homeish',
  robots: { index: false, follow: false },
};

const TABS = [
  { id: 'bills', label: 'Bills' },
  { id: 'payments', label: 'Payments' },
  { id: 'fines', label: 'Fines' },
  { id: 'reports', label: 'Reports' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'payment-plans', label: 'Payment plans' },
  { id: 'recovery', label: 'Recovery follow-ups' },
  { id: 'collection-efficiency', label: 'Collection efficiency' },
  { id: 'dues-follow-up', label: 'Dues follow-up', adminOnly: true },
  { id: 'charge-types', label: 'Charge Types' },
  { id: 'payment-settings', label: 'Payment Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];
type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 25;
const dateInputClass =
  'min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body font-normal';

function single(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === 'string' ? value : undefined;
}

function pageNumber(params: SearchParams) {
  const value = Number(single(params, 'page') ?? '1');
  return Number.isInteger(value) && value >= 1 && value <= 1000 ? value : 1;
}

function isoDate(value: string | undefined) {
  return value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
    ? value
    : undefined;
}

async function Pager({
  hasNext,
  page,
  tab,
}: {
  hasNext: boolean;
  page: number;
  tab: TabId;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  if (page === 1 && !hasNext) return null;
  return (
    <nav aria-label={t('Pagination')} className="flex gap-space-4">
      {page > 1 ? (
        <Link
          className={textLinkClass}
          href={`/admin/billing?tab=${tab}&page=${page - 1}`}
        >
          {t('← Previous')}
        </Link>
      ) : null}
      <span className="inline-flex items-center text-body text-ink-muted">
        {t('Page')} {formatLocalizedNumber(page, locale)}
      </span>
      {hasNext ? (
        <Link
          className={textLinkClass}
          href={`/admin/billing?tab=${tab}&page=${page + 1}`}
        >
          {t('Next →')}
        </Link>
      ) : null}
    </nav>
  );
}

async function BillsSection({
  canManage,
  page,
  today,
}: {
  canManage: boolean;
  page: number;
  today: string;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const bills = await listBillingBills(page, PAGE_SIZE);
  return (
    <Card
      description={t(
        'Open a bill to download its PDF, view the unit ledger, waive an amount or cancel it.',
      )}
      title={t('Bills')}
    >
      <div className="grid gap-space-4">
        {canManage ? (
          <div>
            <Link className={primaryLinkClass} href="/admin/billing/generate">
              {t('Generate Bills')}
            </Link>
          </div>
        ) : null}
        <BillsTable
          bills={bills}
          caption={t('Society bills')}
          hrefBase="/admin/billing/bills"
          showUnit
          today={today}
        />
        <Pager hasNext={bills.length === PAGE_SIZE} page={page} tab="bills" />
      </div>
    </Card>
  );
}

async function PaymentsSection({
  canManage,
  page,
  staleDays,
  today,
}: {
  canManage: boolean;
  page: number;
  staleDays: number;
  today: string;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const [pending, recent, units] = await Promise.all([
    listBillingPayments(1, 100, 'awaiting_confirmation'),
    listBillingPayments(page, PAGE_SIZE),
    canManage ? listBillingUnits() : Promise.resolve([]),
  ]);
  return (
    <div className="grid gap-space-5">
      <Card
        description={t(
          'Check each UPI reference against the society bank statement before confirming. Payments waiting {days} days or more are flagged.',
          { days: formatLocalizedNumber(staleDays, locale) },
        )}
        title={t('Awaiting confirmation ({count})', {
          count: formatLocalizedNumber(pending.length, locale),
        })}
      >
        <PaymentReviewQueue
          canManage={canManage}
          payments={pending}
          staleDays={staleDays}
          today={today}
        />
      </Card>
      <Card
        description={t('Confirmed payments include a downloadable receipt.')}
        title={t('All payments')}
      >
        <div className="grid gap-space-4">
          {canManage ? (
            <div className="grid justify-items-start gap-space-3">
              <RecordPaymentButton today={today} units={units} />
            </div>
          ) : null}
          <PaymentsTable
            caption={t('Society payments')}
            payments={recent}
            showUnit
          />
          <Pager
            hasNext={recent.length === PAGE_SIZE}
            page={page}
            tab="payments"
          />
        </div>
      </Card>
    </div>
  );
}

async function FinesSection({
  canManage,
  today,
}: {
  canManage: boolean;
  today: string;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const [units, bills] = await Promise.all([
    canManage ? listBillingUnits() : Promise.resolve([]),
    listBillingBills(1, 100),
  ]);
  const fines = bills.filter((bill) => bill.kind !== 'regular');
  return (
    <div className="grid gap-space-5">
      {canManage ? (
        <Card
          description={t(
            'Fines are billed immediately and residents of the unit are notified.',
          )}
          title={t('Add fine')}
        >
          <AddFineForm today={today} units={units} />
        </Card>
      ) : null}
      <Card
        description={t('Recent fines and automatic late fees.')}
        title={t('Fines and late fees')}
      >
        <BillsTable
          bills={fines}
          caption={t('Fines and late fees')}
          hrefBase="/admin/billing/bills"
          showUnit
          today={today}
        />
      </Card>
    </div>
  );
}

async function ReportsSection({
  canExport,
  from,
  period,
  timezone,
  to,
}: {
  canExport: boolean;
  from: string;
  period: ReportPeriod;
  timezone: string;
  to: string;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const formatDate = (value: string) =>
    formatLocalizedDate(
      new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
      locale,
      { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
    );
  const [dashboard, summary, monthly] = await Promise.all([
    getBillingDashboard({ from, to }),
    getBillingReportSummary({ from, to }),
    getBillingMonthlyCollection(period, timezone),
  ]);
  const periodHrefs = Object.fromEntries(
    REPORT_PERIODS.map((item) => [
      item,
      `/admin/billing?${new URLSearchParams({ tab: 'reports', from, to, period: item })}`,
    ]),
  ) as Record<ReportPeriod, string>;
  const money = (paise: string) => formatLocalizedCurrency(paise, locale);
  return (
    <div className="grid gap-space-5">
      <Card
        description={t(
          'Bills are counted by due date and collections by payment date.',
        )}
        title={t('Report period')}
      >
        <form
          action="/admin/billing"
          className="flex flex-wrap items-end gap-space-3"
          method="get"
        >
          <input name="tab" type="hidden" value="reports" />
          <input name="period" type="hidden" value={period} />
          <label className="grid gap-space-1 text-body-strong">
            {t('From')}
            <input
              className={dateInputClass}
              defaultValue={from}
              name="from"
              required
              type="date"
            />
          </label>
          <label className="grid gap-space-1 text-body-strong">
            {t('To')}
            <input
              className={dateInputClass}
              defaultValue={to}
              name="to"
              required
              type="date"
            />
          </label>
          <button
            className="inline-flex min-h-12 items-center rounded-md border border-rule-strong bg-surface px-space-4 text-body-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            type="submit"
          >
            {t('Update')}
          </button>
        </form>
      </Card>
      <div className="grid gap-space-3 medium:grid-cols-2 large:grid-cols-4">
        <StatTile
          context={t('{count} bills due in period', {
            count: formatLocalizedNumber(dashboard.bill_count, locale),
          })}
          label={t('Billed')}
          value={formatLocalizedCurrency(dashboard.billed_paise, locale)}
        />
        <StatTile
          context={
            dashboard.collection_percent === null
              ? t('No bills in period')
              : t('{percent}% of billed', {
                  percent: formatLocalizedNumber(
                    dashboard.collection_percent,
                    locale,
                  ),
                })
          }
          label={t('Collected')}
          value={formatLocalizedCurrency(dashboard.collected_paise, locale)}
        />
        <StatTile
          context={t('{amount} waived', {
            amount: formatLocalizedCurrency(dashboard.waived_paise, locale),
          })}
          label={t('Outstanding')}
          value={formatLocalizedCurrency(dashboard.outstanding_paise, locale)}
        />
        <StatTile
          context={t('Confirmed payments dated in period')}
          label={t('Received')}
          value={formatLocalizedCurrency(dashboard.received_paise, locale)}
        />
      </div>
      <Card
        description={t('Units with the highest overdue balance today.')}
        title={t('Top defaulters')}
      >
        {dashboard.top_defaulters.length ? (
          <ol className="grid gap-space-2">
            {dashboard.top_defaulters.map((row) => (
              <li
                className="flex flex-wrap justify-between gap-space-3 border-b border-rule py-space-2"
                key={row.unit_id}
              >
                <Link
                  className={textLinkClass}
                  href={`/admin/billing/units/${row.unit_id}`}
                >
                  {formatLocalizedNumber(row.rank, locale)}. {row.unit_number}
                </Link>
                <span className="text-body tabular-nums">
                  {t('{amount} · {count} bills since {date}', {
                    amount: formatLocalizedCurrency(row.overdue_paise, locale),
                    count: formatLocalizedNumber(
                      row.overdue_bill_count,
                      locale,
                    ),
                    date: formatDate(row.oldest_due_date),
                  })}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">{t('No overdue units.')}</p>
        )}
      </Card>
      <Card
        title={t('Collections by payment mode')}
        description={t('Confirmed payments dated in period')}
      >
        <dl className="grid gap-space-2">
          {summary.collections_by_mode.map((row) => (
            <div
              className="flex flex-wrap justify-between gap-space-2 border-b border-rule py-space-2"
              key={row.mode}
            >
              <dt>
                {t(
                  {
                    upi: 'UPI',
                    cash: 'Cash',
                    cheque: 'Cheque',
                    bank_transfer: 'Bank transfer',
                  }[row.mode],
                )}
              </dt>
              <dd>
                {money(row.amount_paise)} ·{' '}
                {t('{count} payments', {
                  count: formatLocalizedNumber(row.payment_count, locale),
                })}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card
        title={t('Wing totals')}
        description={t('Bills for the selected months, with current balances.')}
      >
        {!summary.block_totals.length ? (
          <p>{t('No bills in period')}</p>
        ) : (
          <ul className="grid gap-space-2">
            {summary.block_totals.map((row) => (
              <li
                className="border-b border-rule py-space-2"
                key={row.block_id ?? 'unassigned'}
              >
                <h3 className="text-body-strong">
                  {row.block_name ?? t('No wing assigned')}
                </h3>
                <dl className="flex flex-wrap gap-space-3">
                  <div>
                    <dt>{t('Billed')}</dt>
                    <dd>{money(row.billed_paise)}</dd>
                  </div>
                  <div>
                    <dt>{t('Collected')}</dt>
                    <dd>{money(row.collected_paise)}</dd>
                  </div>
                  <div>
                    <dt>{t('Outstanding')}</dt>
                    <dd>{money(row.outstanding_paise)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card
        title={t('Bill status summary')}
        description={t('Bills for the selected months, with current balances.')}
      >
        <ul className="grid gap-space-2">
          {summary.status_summary.map((row) => (
            <li className="border-b border-rule py-space-2" key={row.status}>
              <h3 className="text-body-strong">
                {t(
                  {
                    due: 'Due',
                    partially_paid: 'Partly paid',
                    overdue: 'Overdue',
                    paid: 'Paid',
                    waived: 'Waived',
                    cancelled: 'Cancelled',
                  }[row.status],
                )}
              </h3>
              <dl className="flex flex-wrap gap-space-3">
                <div>
                  <dt>{t('Bills')}</dt>
                  <dd>{formatLocalizedNumber(row.bill_count, locale)}</dd>
                </div>
                <div>
                  <dt>{t('Billed')}</dt>
                  <dd>{money(row.total_paise)}</dd>
                </div>
                <div>
                  <dt>{t('Outstanding')}</dt>
                  <dd>{money(row.outstanding_paise)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </Card>
      <StatTile
        label={t('Unapplied advance credit')}
        value={money(summary.unapplied_credit_paise)}
        context={t('As of {date}', { date: formatDate(summary.credit_as_of) })}
      />
      <MonthlyCollectionPanel
        canExport={canExport}
        periodHrefs={periodHrefs}
        report={monthly}
      />
      <Card
        description={t(
          'Exports are recorded in the audit log. CSV files open in spreadsheet apps.',
        )}
        title={t('Export')}
      >
        <ReportExportButtons from={from} to={to} />
      </Card>
    </div>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const params = await searchParams;
  const requested = single(params, 'tab');
  const tab: TabId = TABS.find((item) => item.id === requested)?.id ?? 'bills';
  const admin = await getBillingAdminContext();
  const today = todayInTimeZone(admin.timezone);
  const page = pageNumber(params);
  const monthStart = `${today.slice(0, 8)}01`;
  let from = isoDate(single(params, 'from')) ?? monthStart;
  let to = isoDate(single(params, 'to')) ?? today;
  const rangeReset = from > to;
  if (rangeReset) {
    from = monthStart;
    to = today;
  }

  let content: ReactNode;
  if (tab === 'bills') {
    content = (
      <BillsSection canManage={admin.canManage} page={page} today={today} />
    );
  } else if (tab === 'payments') {
    content = (
      <PaymentsSection
        canManage={admin.canManage}
        page={page}
        staleDays={admin.settings.pending_confirmation_alert_days}
        today={today}
      />
    );
  } else if (tab === 'fines') {
    content = <FinesSection canManage={admin.canManage} today={today} />;
  } else if (tab === 'reports') {
    content = (
      <ReportsSection
        canExport={admin.canExportMonthlyCollection}
        from={from}
        period={readReportPeriod(single(params, 'period'))}
        timezone={admin.timezone}
        to={to}
      />
    );
  } else if (tab === 'dues-follow-up') {
    content = admin.canFollowUpDues ? (
      <DuesFollowUpPanel report={await getBillingDuesFollowUp()} />
    ) : (
      <Banner tone="warning" title={t('You do not have access to this page')}>
        {t('Only administrators can see the dues follow-up list.')}
      </Banner>
    );
  } else if (tab === 'estimate') {
    content = (
      <BillingEstimatePanel charges={await listBillingEstimateCharges()} />
    );
  } else if (tab === 'payment-plans') {
    const [plans, bills] = await Promise.all([
      listBillingPaymentPlans(),
      admin.canManage ? listBillingPaymentPlanBills() : Promise.resolve([]),
    ]);
    content = (
      <PaymentPlansPanel
        bills={bills}
        canManage={admin.canManage}
        plans={plans}
        today={today}
      />
    );
  } else if (tab === 'recovery') {
    const [recovery, units] = await Promise.all([
      listBillingRecoveryActions(),
      admin.canManage ? listBillingUnits() : Promise.resolve([]),
    ]);
    content = (
      <RecoveryActionsPanel
        actions={recovery.actions}
        admins={recovery.admins}
        canManage={admin.canManage}
        today={today}
        units={units}
      />
    );
  } else if (tab === 'collection-efficiency') {
    const asOfDate = isoDate(single(params, 'asOfDate')) ?? today;
    const report = await getBillingCollectionEfficiency({ asOfDate });
    content = <CollectionEfficiencyPanel report={report} />;
  } else {
    const setup = await getBillingSetup();
    content = <BillingSetup {...setup} embedded />;
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Billing')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Maintenance bills, payments, fines and collection reports. Residents pay the society directly.',
          )}
        </p>
      </header>
      {!admin.canManage ? (
        <Banner tone="info">
          {admin.suspended
            ? t('This society is suspended. Billing information is read-only.')
            : t('Read-only access. Only administrators can change billing.')}
        </Banner>
      ) : null}
      {tab === 'reports' && rangeReset ? (
        <Banner tone="warning">
          {t('The start date was after the end date, so this month is shown.')}
        </Banner>
      ) : null}
      <nav aria-label={t('Billing sections')} className="overflow-x-auto">
        <ul className="flex min-w-max gap-space-1 border-b border-rule">
          {TABS.filter(
            (item) =>
              !('adminOnly' in item) ||
              admin.canFollowUpDues ||
              item.id === tab,
          ).map((item) => {
            const active = item.id === tab;
            return (
              <li key={item.id}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-12 items-center border-b-2 px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${active ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
                  href={`/admin/billing?tab=${item.id}`}
                >
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {content}
    </section>
  );
}
