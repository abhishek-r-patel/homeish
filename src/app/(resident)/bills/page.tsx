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
import { todayInTimeZone } from '@/core/billing/format';
import {
  residentNextDueDate,
  residentOutstandingTotal,
} from '@/core/billing/resident-summary';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { getResidentBilling } from '@/core/billing/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';

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

function formatBillDate(value: string, locale: Locale) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return formatLocalizedDate(new Date(Date.UTC(year, month - 1, day)), locale, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

export default async function ResidentBillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const params = await searchParams;
  const tab: TabId = TABS.find((item) => item.id === params.tab)?.id ?? 'bills';
  const billing = await getResidentBilling();
  const today = todayInTimeZone(billing.timezone);

  if (billing.units.length === 0) {
    return (
      <section className="grid gap-space-5">
        <h1 className="text-title font-semibold">{t('Bills')}</h1>
        <EmptyState
          description={t(
            'You are not linked to an active {unit}. Contact the society office if this is wrong.',
            { unit: billing.unitLabel.toLowerCase() },
          )}
          title={t('No bills to show')}
        />
      </section>
    );
  }

  const outstanding = residentOutstandingTotal(billing.outstanding);
  const nextDue = residentNextDueDate(billing.outstanding);
  const overdue = nextDue !== null && nextDue < today;
  const awaiting = billing.payments.filter(
    (payment) => payment.status === 'awaiting_confirmation',
  );
  const awaitingPaise = awaiting.reduce(
    (sum, payment) => sum + BigInt(payment.amount_paise),
    BigInt(0),
  );
  const latest = billing.payments[0];
  const rejected = latest?.status === 'rejected' ? latest : null;
  const canPay = !billing.suspended && billing.paymentDetails !== null;
  const unitName = (unitId: string) =>
    `${billing.unitLabel} ${billing.units.find((unit) => unit.id === unitId)?.number ?? ''}`.trim();

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Bills')}</h1>
        <p className="text-body text-ink-muted">
          {t('Maintenance bills, fines and receipts for {units}.', {
            units: billing.units.map((unit) => unit.number).join(', '),
          })}
        </p>
      </header>
      {billing.suspended ? (
        <Banner tone="info">
          {t('This society is suspended. Billing information is read-only.')}
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
                {t('Resubmit')}
              </Link>
            ) : undefined
          }
          title={t('Payment rejected')}
          tone="danger"
        >
          {t('{amount} submitted on {date} was rejected', {
            amount: formatLocalizedCurrency(rejected.amount_paise, locale),
            date: formatBillDate(rejected.paid_on, locale),
          })}
          {rejected.reject_reason ? `: ${rejected.reject_reason}` : '.'}
        </Banner>
      ) : null}
      <Card title={t('Amount due')}>
        <div className="grid gap-space-3">
          <p
            className={`text-display font-semibold tabular-nums ${overdue ? 'text-danger' : ''}`}
          >
            {formatLocalizedCurrency(outstanding, locale)}
          </p>
          {nextDue ? (
            <p className="text-body text-ink-muted">
              {overdue
                ? t('Overdue since {date}', {
                    date: formatBillDate(nextDue, locale),
                  })
                : t('Next due {date}', {
                    date: formatBillDate(nextDue, locale),
                  })}
            </p>
          ) : (
            <p className="text-body text-ink-muted">
              {t('You are all paid up.')}
            </p>
          )}
          {awaiting.length ? (
            <p className="text-body">
              {t('{amount} awaiting society confirmation.', {
                amount: formatLocalizedCurrency(awaitingPaise, locale),
              })}
            </p>
          ) : null}
          {outstanding > BigInt(0) && canPay ? (
            <div>
              <Link className={primaryLinkClass} href="/bills/pay">
                {t('Pay Now')}
              </Link>
            </div>
          ) : null}
          {outstanding > BigInt(0) && !billing.paymentDetails ? (
            <p className="text-body text-ink-muted">
              {t(
                'The society has not added UPI payment details yet. Pay at the society office.',
              )}
            </p>
          ) : null}
        </div>
      </Card>
      <nav aria-label={t('Billing sections')} className="overflow-x-auto">
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
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {tab === 'bills' ? (
        <BillsTable
          bills={billing.bills}
          caption={t('Your bills')}
          hrefBase="/bills"
          showUnit={billing.units.length > 1}
          today={today}
        />
      ) : null}
      {tab === 'ledger'
        ? billing.ledgers.map((ledger) => (
            <Card
              key={ledger.unitId}
              title={t('{unit} ledger', { unit: unitName(ledger.unitId) })}
            >
              <LedgerTable
                caption={t('{unit} ledger', { unit: unitName(ledger.unitId) })}
                entries={ledger.entries}
                timeZone={billing.timezone}
              />
            </Card>
          ))
        : null}
      {tab === 'payments' ? (
        <PaymentsTable
          caption={t('Your payments')}
          payments={billing.payments}
          showUnit={billing.units.length > 1}
        />
      ) : null}
    </section>
  );
}
