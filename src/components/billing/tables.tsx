// Responsive billing tables shared by admin and resident screens.
'use client';

import { DataTable } from '@/components/ui/table-controls';
import { StatusChip } from '@/components/ui/data-display';
import { billDisplayStatus, formatRupees } from '@/core/billing/format';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { useUiTranslator } from '@/components/ui/language';
import type {
  BillingBill,
  BillingLedgerEntry,
  BillingPayment,
} from '@/core/billing/validation';
import { textLinkClass } from './styles';

const KIND_LABELS = {
  regular: 'Maintenance',
  fine: 'Fine',
  late_fee: 'Late fee',
} as const;

function billingDate(value: string, locale: 'en' | 'hi') {
  return formatLocalizedDate(
    new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
    locale,
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    },
  );
}

function billingPeriod(value: string, locale: 'en' | 'hi') {
  return formatLocalizedDate(
    new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`),
    locale,
    { month: 'short', year: 'numeric', timeZone: 'UTC' },
  );
}

function rupees(paise: number | string, locale: 'en' | 'hi') {
  return locale === 'hi'
    ? formatLocalizedCurrency(Number(paise), locale)
    : formatRupees(paise);
}

export function BillsTable({
  bills,
  caption,
  hrefBase,
  showUnit,
  today,
}: {
  bills: readonly BillingBill[];
  caption: string;
  hrefBase: string;
  showUnit: boolean;
  today: string;
}) {
  const { locale: selectedLocale, translate: t } = useUiTranslator();
  const locale = selectedLocale ?? 'en';
  return (
    <DataTable
      caption={caption}
      columns={[
        ...(showUnit
          ? [
              {
                id: 'unit',
                header: t('Unit'),
                render: (bill: BillingBill) => bill.unit_number ?? '—',
              },
            ]
          : []),
        {
          id: 'title',
          header: t('Bill'),
          render: (bill: BillingBill) => (
            <span>
              {bill.title}
              <span className="block text-caption text-ink-muted">
                {t(KIND_LABELS[bill.kind])} ·{' '}
                {billingPeriod(bill.period_start, locale)}
              </span>
            </span>
          ),
        },
        {
          id: 'due',
          header: t('Due date'),
          render: (bill: BillingBill) => billingDate(bill.due_date, locale),
        },
        {
          id: 'total',
          header: t('Total'),
          align: 'right' as const,
          render: (bill: BillingBill) => rupees(bill.total_paise, locale),
        },
        {
          id: 'outstanding',
          header: t('Outstanding'),
          align: 'right' as const,
          render: (bill: BillingBill) => rupees(bill.outstanding_paise, locale),
        },
        {
          id: 'status',
          header: t('Status'),
          render: (bill: BillingBill) => (
            <StatusChip status={billDisplayStatus(bill, today)} />
          ),
        },
      ]}
      getRowHref={(bill) => `${hrefBase}/${bill.id}`}
      getRowId={(bill) => bill.id}
      getRowLabel={(bill) => bill.title}
      mobilePrimary={(bill) =>
        `${showUnit && bill.unit_number ? `${bill.unit_number} · ` : ''}${bill.title}`
      }
      mobileSecondary={(bill) =>
        t('{amount} outstanding · due {date}', {
          amount: rupees(bill.outstanding_paise, locale),
          date: billingDate(bill.due_date, locale),
        })
      }
      mobileStatus={(bill) => billDisplayStatus(bill, today)}
      rows={bills}
    />
  );
}

const MODE_LABELS = {
  upi: 'UPI',
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank transfer',
} as const;

export function PaymentsTable({
  caption,
  payments,
  showUnit,
}: {
  caption: string;
  payments: readonly BillingPayment[];
  showUnit: boolean;
}) {
  const { locale: selectedLocale, translate: t } = useUiTranslator();
  const locale = selectedLocale ?? 'en';
  return (
    <DataTable
      caption={caption}
      columns={[
        ...(showUnit
          ? [
              {
                id: 'unit',
                header: t('Unit'),
                render: (payment: BillingPayment) => payment.unit_number ?? '—',
              },
            ]
          : []),
        {
          id: 'paid',
          header: t('Paid on'),
          render: (payment: BillingPayment) =>
            billingDate(payment.paid_on, locale),
        },
        {
          id: 'mode',
          header: t('Mode'),
          render: (payment: BillingPayment) => (
            <span>
              {t(MODE_LABELS[payment.mode])}
              {payment.reference ? (
                <span className="block text-caption text-ink-muted">
                  {t('Ref. {reference}', { reference: payment.reference })}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          id: 'amount',
          header: t('Amount'),
          align: 'right' as const,
          render: (payment: BillingPayment) =>
            rupees(payment.amount_paise, locale),
        },
        {
          id: 'status',
          header: t('Status'),
          render: (payment: BillingPayment) => (
            <span className="grid gap-space-1">
              <StatusChip status={`payment.${payment.status}`} />
              {payment.status === 'rejected' && payment.reject_reason ? (
                <span className="text-caption text-ink-muted">
                  {t('Reason: {reason}', { reason: payment.reject_reason })}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          id: 'receipt',
          header: t('Receipt'),
          render: (payment: BillingPayment) =>
            payment.status === 'confirmed' && payment.receipt_no ? (
              <a
                className={textLinkClass}
                download
                href={`/api/billing/receipts/${payment.id}`}
              >
                {payment.receipt_no}
                <span className="sr-only"> {t('PDF')}</span>
              </a>
            ) : (
              '—'
            ),
        },
      ]}
      getRowHref={(payment) =>
        payment.status === 'confirmed'
          ? `/api/billing/receipts/${payment.id}`
          : undefined
      }
      getRowId={(payment) => payment.id}
      getRowLabel={(payment) =>
        t('{amount} on {date}', {
          amount: rupees(payment.amount_paise, locale),
          date: billingDate(payment.paid_on, locale),
        })
      }
      mobilePrimary={(payment) =>
        `${showUnit && payment.unit_number ? `${payment.unit_number} · ` : ''}${rupees(payment.amount_paise, locale)}`
      }
      mobileSecondary={(payment) =>
        payment.status === 'rejected' && payment.reject_reason
          ? t('Rejected: {reason}', { reason: payment.reject_reason })
          : `${t(MODE_LABELS[payment.mode])} · ${billingDate(payment.paid_on, locale)}${payment.receipt_no ? ` · ${payment.receipt_no}` : ''}`
      }
      mobileStatus={(payment) => `payment.${payment.status}`}
      rows={payments}
    />
  );
}

const LEDGER_LABELS = {
  bill: 'Bill',
  payment: 'Payment',
  waiver: 'Waiver',
  adjustment: 'Adjustment',
} as const;

function balanceText(
  balance: string,
  locale: 'en' | 'hi',
  t: ReturnType<typeof useUiTranslator>['translate'],
) {
  if (balance.startsWith('-'))
    return t('{amount} advance', {
      amount: rupees(balance.slice(1), locale),
    });
  return rupees(balance, locale);
}

export function LedgerTable({
  caption,
  entries,
  timeZone,
}: {
  caption: string;
  entries: readonly BillingLedgerEntry[];
  timeZone: string;
}) {
  const { locale: selectedLocale, translate: t } = useUiTranslator();
  const locale = selectedLocale ?? 'en';
  const date = (value: string) =>
    formatLocalizedDate(new Date(value), locale, {
      dateStyle: 'medium',
      timeZone,
    });
  return (
    <DataTable
      caption={caption}
      columns={[
        {
          id: 'date',
          header: t('Date'),
          render: (entry: BillingLedgerEntry) => date(entry.created_at),
        },
        {
          id: 'description',
          header: t('Description'),
          render: (entry: BillingLedgerEntry) => (
            <span>
              {t(LEDGER_LABELS[entry.kind])}
              {entry.reason ? (
                <span className="block text-caption text-ink-muted">
                  {entry.reason}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          id: 'debit',
          header: t('Debit'),
          align: 'right' as const,
          render: (entry: BillingLedgerEntry) =>
            entry.direction === 'debit'
              ? rupees(entry.amount_paise, locale)
              : '',
        },
        {
          id: 'credit',
          header: t('Credit'),
          align: 'right' as const,
          render: (entry: BillingLedgerEntry) =>
            entry.direction === 'credit'
              ? rupees(entry.amount_paise, locale)
              : '',
        },
        {
          id: 'balance',
          header: t('Balance'),
          align: 'right' as const,
          render: (entry: BillingLedgerEntry) =>
            balanceText(entry.balance_paise, locale, t),
        },
      ]}
      getRowId={(entry) => entry.id}
      getRowLabel={(entry) =>
        t('{kind} {id}', {
          kind: t(LEDGER_LABELS[entry.kind]),
          id: entry.id,
        })
      }
      mobilePrimary={(entry) =>
        t('{kind} · {sign}{amount}', {
          kind: t(LEDGER_LABELS[entry.kind]),
          sign: entry.direction === 'debit' ? '+' : '−',
          amount: rupees(entry.amount_paise, locale),
        })
      }
      mobileSecondary={(entry) =>
        t('{date} · balance {balance}', {
          date: date(entry.created_at),
          balance: balanceText(entry.balance_paise, locale, t),
        })
      }
      rows={entries}
    />
  );
}
