// Admin billing workspace: bills, payment review, fines, reports and setup.
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AddFineForm,
  PaymentReviewQueue,
  RecordPaymentButton,
  ReportExportButtons,
} from '@/components/billing/admin-panels';
import { BillingSetup } from '@/components/billing/setup';
import { primaryLinkClass, textLinkClass } from '@/components/billing/styles';
import { BillsTable, PaymentsTable } from '@/components/billing/tables';
import { Card, StatTile } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import {
  formatBillingDate,
  formatRupees,
  todayInTimeZone,
} from '@/core/billing/format';
import {
  getBillingAdminContext,
  getBillingDashboard,
  getBillingSetup,
  listBillingBills,
  listBillingPayments,
  listBillingUnits,
} from '@/core/billing/operations';

export const metadata = {
  title: 'Billing | Homeish',
  robots: { index: false, follow: false },
};

const TABS = [
  { id: 'bills', label: 'Bills' },
  { id: 'payments', label: 'Payments' },
  { id: 'fines', label: 'Fines' },
  { id: 'reports', label: 'Reports' },
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

function Pager({
  hasNext,
  page,
  tab,
}: {
  hasNext: boolean;
  page: number;
  tab: TabId;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav aria-label="Pagination" className="flex gap-space-4">
      {page > 1 ? (
        <Link
          className={textLinkClass}
          href={`/admin/billing?tab=${tab}&page=${page - 1}`}
        >
          ← Previous
        </Link>
      ) : null}
      <span className="inline-flex items-center text-body text-ink-muted">
        Page {page}
      </span>
      {hasNext ? (
        <Link
          className={textLinkClass}
          href={`/admin/billing?tab=${tab}&page=${page + 1}`}
        >
          Next →
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
  const bills = await listBillingBills(page, PAGE_SIZE);
  return (
    <Card
      description="Open a bill to download its PDF, view the unit ledger, waive an amount or cancel it."
      title="Bills"
    >
      <div className="grid gap-space-4">
        {canManage ? (
          <div>
            <Link className={primaryLinkClass} href="/admin/billing/generate">
              Generate Bills
            </Link>
          </div>
        ) : null}
        <BillsTable
          bills={bills}
          caption="Society bills"
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
  const [pending, recent, units] = await Promise.all([
    listBillingPayments(1, 100, 'awaiting_confirmation'),
    listBillingPayments(page, PAGE_SIZE),
    canManage ? listBillingUnits() : Promise.resolve([]),
  ]);
  return (
    <div className="grid gap-space-5">
      <Card
        description={`Check each UPI reference against the society bank statement before confirming. Payments waiting ${staleDays} days or more are flagged.`}
        title={`Awaiting confirmation (${pending.length})`}
      >
        <PaymentReviewQueue
          canManage={canManage}
          payments={pending}
          staleDays={staleDays}
          today={today}
        />
      </Card>
      <Card
        description="Confirmed payments include a downloadable receipt."
        title="All payments"
      >
        <div className="grid gap-space-4">
          {canManage ? (
            <div className="grid justify-items-start gap-space-3">
              <RecordPaymentButton today={today} units={units} />
            </div>
          ) : null}
          <PaymentsTable
            caption="Society payments"
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
  const [units, bills] = await Promise.all([
    canManage ? listBillingUnits() : Promise.resolve([]),
    listBillingBills(1, 100),
  ]);
  const fines = bills.filter((bill) => bill.kind !== 'regular');
  return (
    <div className="grid gap-space-5">
      {canManage ? (
        <Card
          description="Fines are billed immediately and residents of the unit are notified."
          title="Add fine"
        >
          <AddFineForm today={today} units={units} />
        </Card>
      ) : null}
      <Card
        description="Recent fines and automatic late fees."
        title="Fines and late fees"
      >
        <BillsTable
          bills={fines}
          caption="Fines and late fees"
          hrefBase="/admin/billing/bills"
          showUnit
          today={today}
        />
      </Card>
    </div>
  );
}

async function ReportsSection({ from, to }: { from: string; to: string }) {
  const dashboard = await getBillingDashboard({ from, to });
  return (
    <div className="grid gap-space-5">
      <Card
        description="Bills are counted by due date and collections by payment date."
        title="Report period"
      >
        <form
          action="/admin/billing"
          className="flex flex-wrap items-end gap-space-3"
          method="get"
        >
          <input name="tab" type="hidden" value="reports" />
          <label className="grid gap-space-1 text-body-strong">
            From
            <input
              className={dateInputClass}
              defaultValue={from}
              name="from"
              required
              type="date"
            />
          </label>
          <label className="grid gap-space-1 text-body-strong">
            To
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
            Update
          </button>
        </form>
      </Card>
      <div className="grid gap-space-3 medium:grid-cols-2 large:grid-cols-4">
        <StatTile
          context={`${dashboard.bill_count} bill${dashboard.bill_count === 1 ? '' : 's'} due in period`}
          label="Billed"
          value={formatRupees(dashboard.billed_paise)}
        />
        <StatTile
          context={
            dashboard.collection_percent === null
              ? 'No bills in period'
              : `${dashboard.collection_percent}% of billed`
          }
          label="Collected"
          value={formatRupees(dashboard.collected_paise)}
        />
        <StatTile
          context={`${formatRupees(dashboard.waived_paise)} waived`}
          label="Outstanding"
          value={formatRupees(dashboard.outstanding_paise)}
        />
        <StatTile
          context="Confirmed payments dated in period"
          label="Received"
          value={formatRupees(dashboard.received_paise)}
        />
      </div>
      <Card
        description="Units with the highest overdue balance today."
        title="Top defaulters"
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
                  {row.rank}. {row.unit_number}
                </Link>
                <span className="text-body tabular-nums">
                  {formatRupees(row.overdue_paise)} · {row.overdue_bill_count}{' '}
                  bill{row.overdue_bill_count === 1 ? '' : 's'} since{' '}
                  {formatBillingDate(row.oldest_due_date)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">No overdue units.</p>
        )}
      </Card>
      <Card
        description="Exports are recorded in the audit log. CSV files open in spreadsheet apps."
        title="Export"
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
    content = <ReportsSection from={from} to={to} />;
  } else {
    const setup = await getBillingSetup();
    content = <BillingSetup {...setup} embedded />;
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Billing</h1>
        <p className="text-body text-ink-muted">
          Maintenance bills, payments, fines and collection reports. Residents
          pay the society directly.
        </p>
      </header>
      {!admin.canManage ? (
        <Banner tone="info">
          {admin.suspended
            ? 'This society is suspended. Billing information is read-only.'
            : 'Read-only access. Only administrators can change billing.'}
        </Banner>
      ) : null}
      {tab === 'reports' && rangeReset ? (
        <Banner tone="warning">
          The start date was after the end date, so this month is shown.
        </Banner>
      ) : null}
      <nav aria-label="Billing sections" className="overflow-x-auto">
        <ul className="flex min-w-max gap-space-1 border-b border-rule">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <li key={item.id}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-12 items-center border-b-2 px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${active ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
                  href={`/admin/billing?tab=${item.id}`}
                >
                  {item.label}
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
