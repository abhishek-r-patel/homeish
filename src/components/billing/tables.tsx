// Responsive billing tables shared by admin and resident screens.
'use client';

import { DataTable } from '@/components/ui/table-controls';
import { StatusChip } from '@/components/ui/data-display';
import {
  billDisplayStatus,
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
} from '@/core/billing/format';
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
  return (
    <DataTable
      caption={caption}
      columns={[
        ...(showUnit
          ? [
              {
                id: 'unit',
                header: 'Unit',
                render: (bill: BillingBill) => bill.unit_number ?? '—',
              },
            ]
          : []),
        {
          id: 'title',
          header: 'Bill',
          render: (bill: BillingBill) => (
            <span>
              {bill.title}
              <span className="block text-caption text-ink-muted">
                {KIND_LABELS[bill.kind]} ·{' '}
                {formatBillingPeriod(bill.period_start)}
              </span>
            </span>
          ),
        },
        {
          id: 'due',
          header: 'Due date',
          render: (bill: BillingBill) => formatBillingDate(bill.due_date),
        },
        {
          id: 'total',
          header: 'Total',
          align: 'right' as const,
          render: (bill: BillingBill) => formatRupees(bill.total_paise),
        },
        {
          id: 'outstanding',
          header: 'Outstanding',
          align: 'right' as const,
          render: (bill: BillingBill) => formatRupees(bill.outstanding_paise),
        },
        {
          id: 'status',
          header: 'Status',
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
        `${formatRupees(bill.outstanding_paise)} outstanding · due ${formatBillingDate(bill.due_date)}`
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
  return (
    <DataTable
      caption={caption}
      columns={[
        ...(showUnit
          ? [
              {
                id: 'unit',
                header: 'Unit',
                render: (payment: BillingPayment) => payment.unit_number ?? '—',
              },
            ]
          : []),
        {
          id: 'paid',
          header: 'Paid on',
          render: (payment: BillingPayment) =>
            formatBillingDate(payment.paid_on),
        },
        {
          id: 'mode',
          header: 'Mode',
          render: (payment: BillingPayment) => (
            <span>
              {MODE_LABELS[payment.mode]}
              {payment.reference ? (
                <span className="block text-caption text-ink-muted">
                  Ref. {payment.reference}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          id: 'amount',
          header: 'Amount',
          align: 'right' as const,
          render: (payment: BillingPayment) =>
            formatRupees(payment.amount_paise),
        },
        {
          id: 'status',
          header: 'Status',
          render: (payment: BillingPayment) => (
            <span className="grid gap-space-1">
              <StatusChip status={`payment.${payment.status}`} />
              {payment.status === 'rejected' && payment.reject_reason ? (
                <span className="text-caption text-ink-muted">
                  Reason: {payment.reject_reason}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          id: 'receipt',
          header: 'Receipt',
          render: (payment: BillingPayment) =>
            payment.status === 'confirmed' && payment.receipt_no ? (
              <a
                className={textLinkClass}
                download
                href={`/api/billing/receipts/${payment.id}`}
              >
                {payment.receipt_no}
                <span className="sr-only"> PDF</span>
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
        `${formatRupees(payment.amount_paise)} on ${formatBillingDate(payment.paid_on)}`
      }
      mobilePrimary={(payment) =>
        `${showUnit && payment.unit_number ? `${payment.unit_number} · ` : ''}${formatRupees(payment.amount_paise)}`
      }
      mobileSecondary={(payment) =>
        payment.status === 'rejected' && payment.reject_reason
          ? `Rejected: ${payment.reject_reason}`
          : `${MODE_LABELS[payment.mode]} · ${formatBillingDate(payment.paid_on)}${payment.receipt_no ? ` · ${payment.receipt_no}` : ''}`
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

function balanceText(balance: string) {
  if (balance.startsWith('-'))
    return `${formatRupees(balance.slice(1))} advance`;
  return formatRupees(balance);
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
  const date = (value: string) =>
    new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone }).format(
      new Date(value),
    );
  return (
    <DataTable
      caption={caption}
      columns={[
        {
          id: 'date',
          header: 'Date',
          render: (entry: BillingLedgerEntry) => date(entry.created_at),
        },
        {
          id: 'description',
          header: 'Description',
          render: (entry: BillingLedgerEntry) => (
            <span>
              {LEDGER_LABELS[entry.kind]}
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
          header: 'Debit',
          align: 'right' as const,
          render: (entry: BillingLedgerEntry) =>
            entry.direction === 'debit' ? formatRupees(entry.amount_paise) : '',
        },
        {
          id: 'credit',
          header: 'Credit',
          align: 'right' as const,
          render: (entry: BillingLedgerEntry) =>
            entry.direction === 'credit'
              ? formatRupees(entry.amount_paise)
              : '',
        },
        {
          id: 'balance',
          header: 'Balance',
          align: 'right' as const,
          render: (entry: BillingLedgerEntry) =>
            balanceText(entry.balance_paise),
        },
      ]}
      getRowId={(entry) => entry.id}
      getRowLabel={(entry) => `${LEDGER_LABELS[entry.kind]} ${entry.id}`}
      mobilePrimary={(entry) =>
        `${LEDGER_LABELS[entry.kind]} · ${entry.direction === 'debit' ? '+' : '−'}${formatRupees(entry.amount_paise)}`
      }
      mobileSecondary={(entry) =>
        `${date(entry.created_at)} · balance ${balanceText(entry.balance_paise)}`
      }
      rows={entries}
    />
  );
}
