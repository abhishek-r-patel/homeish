// Resident billing home: amount due, bills, unit ledger and receipts.
import Link from 'next/link';
import { primaryLinkClass, textLinkClass } from '@/components/billing/styles';
import {
  BillsTable,
  LedgerTable,
  PaymentsTable,
} from '@/components/billing/tables';
import { Card } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  formatBillingDate,
  formatRupees,
  todayInTimeZone,
} from '@/core/billing/format';
import { getResidentBilling } from '@/core/billing/operations';

export const metadata = {
  title: 'Bills | Homeish',
  robots: { index: false, follow: false },
};

const TABS = [
  { id: 'bills', label: 'Bills' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'payments', label: 'Payments & Receipts' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default async function ResidentBillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab: TabId = TABS.find((item) => item.id === params.tab)?.id ?? 'bills';
  const billing = await getResidentBilling();
  const today = todayInTimeZone(billing.timezone);

  if (billing.units.length === 0) {
    return (
      <section className="grid gap-space-5">
        <h1 className="text-title font-semibold">Bills</h1>
        <EmptyState
          description={`You are not linked to an active ${billing.unitLabel.toLowerCase()}. Contact the society office if this is wrong.`}
          title="No bills to show"
        />
      </section>
    );
  }

  const openBills = billing.bills.filter(
    (bill) => bill.status === 'due' || bill.status === 'partially_paid',
  );
  const outstanding = openBills.reduce(
    (sum, bill) => sum + bill.outstanding_paise,
    0,
  );
  const nextDue = openBills
    .map((bill) => bill.due_date)
    .sort((left, right) => left.localeCompare(right))[0];
  const overdue = openBills.some((bill) => bill.due_date < today);
  const awaiting = billing.payments.filter(
    (payment) => payment.status === 'awaiting_confirmation',
  );
  const awaitingPaise = awaiting.reduce(
    (sum, payment) => sum + payment.amount_paise,
    0,
  );
  const latest = billing.payments[0];
  const rejected = latest?.status === 'rejected' ? latest : null;
  const canPay = !billing.suspended && billing.paymentDetails !== null;
  const unitName = (unitId: string) =>
    `${billing.unitLabel} ${billing.units.find((unit) => unit.id === unitId)?.number ?? ''}`.trim();

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Bills</h1>
        <p className="text-body text-ink-muted">
          Maintenance bills, fines and receipts for{' '}
          {billing.units.map((unit) => unit.number).join(', ')}.
        </p>
      </header>
      {billing.suspended ? (
        <Banner tone="info">
          This society is suspended. Billing information is read-only.
        </Banner>
      ) : null}
      {rejected ? (
        <Banner
          action={
            canPay ? (
              <Link
                className={textLinkClass}
                href={`/bills/pay?resubmit=${rejected.id}`}
              >
                Resubmit
              </Link>
            ) : undefined
          }
          title="Payment rejected"
          tone="danger"
        >
          {formatRupees(rejected.amount_paise)} submitted on{' '}
          {formatBillingDate(rejected.paid_on)} was rejected
          {rejected.reject_reason ? `: ${rejected.reject_reason}` : '.'}
        </Banner>
      ) : null}
      <Card title="Amount due">
        <div className="grid gap-space-3">
          <p
            className={`text-display font-semibold tabular-nums ${overdue ? 'text-danger' : ''}`}
          >
            {formatRupees(outstanding)}
          </p>
          {nextDue ? (
            <p className="text-body text-ink-muted">
              {overdue ? 'Overdue since' : 'Next due'}{' '}
              {formatBillingDate(nextDue)}
            </p>
          ) : (
            <p className="text-body text-ink-muted">You are all paid up.</p>
          )}
          {awaiting.length ? (
            <p className="text-body">
              {formatRupees(awaitingPaise)} awaiting society confirmation.
            </p>
          ) : null}
          {outstanding > 0 && canPay ? (
            <div>
              <Link className={primaryLinkClass} href="/bills/pay">
                Pay Now
              </Link>
            </div>
          ) : null}
          {outstanding > 0 && !billing.paymentDetails ? (
            <p className="text-body text-ink-muted">
              The society has not added UPI payment details yet. Pay at the
              society office.
            </p>
          ) : null}
        </div>
      </Card>
      <nav aria-label="Billing sections" className="overflow-x-auto">
        <ul className="flex min-w-max gap-space-1 border-b border-rule">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <li key={item.id}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-12 items-center border-b-2 px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus ${active ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
                  href={`/bills?tab=${item.id}`}
                  scroll={false}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {tab === 'bills' ? (
        <BillsTable
          bills={billing.bills}
          caption="Your bills"
          hrefBase="/bills"
          showUnit={billing.units.length > 1}
          today={today}
        />
      ) : null}
      {tab === 'ledger'
        ? billing.ledgers.map((ledger) => (
            <Card
              key={ledger.unitId}
              title={`${unitName(ledger.unitId)} ledger`}
            >
              <LedgerTable
                caption={`${unitName(ledger.unitId)} ledger`}
                entries={ledger.entries}
                timeZone={billing.timezone}
              />
            </Card>
          ))
        : null}
      {tab === 'payments' ? (
        <PaymentsTable
          caption="Your payments"
          payments={billing.payments}
          showUnit={billing.units.length > 1}
        />
      ) : null}
    </section>
  );
}
