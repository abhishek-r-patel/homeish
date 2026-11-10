// Show bill line items as a definition list with totals and a PDF download.
import Link from 'next/link';
import { Card, StatusChip } from '@/components/ui/data-display';
import {
  billDisplayStatus,
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
} from '@/core/billing/format';
import type { BillingBillDetails } from '@/core/billing/validation';
import { linkButtonClass } from './styles';

export function BillDetail({
  backHref,
  backLabel,
  bill,
  children,
  ledgerHref,
  today,
}: {
  backHref: string;
  backLabel: string;
  bill: BillingBillDetails;
  children?: React.ReactNode;
  ledgerHref?: string;
  today: string;
}) {
  return (
    <section className="grid max-w-content-default gap-space-5">
      <Link className="text-body text-brand underline" href={backHref}>
        ← {backLabel}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h1 className="text-title font-semibold">{bill.title}</h1>
          <p className="text-body text-ink-muted">
            {bill.unit_label} {bill.unit_number} ·{' '}
            {formatBillingPeriod(bill.period_start)}
          </p>
        </div>
        <StatusChip status={billDisplayStatus(bill, today)} />
      </header>
      <Card title="Bill details">
        <dl className="grid gap-space-3 text-body">
          {bill.lines.map((line) => (
            <div className="flex justify-between gap-space-4" key={line.id}>
              <dt>{line.description}</dt>
              <dd className="tabular-nums">
                {formatRupees(line.amount_paise)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-space-4 border-t border-rule pt-space-3 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatRupees(bill.total_paise)}</dd>
          </div>
          {bill.paid_paise > 0 ? (
            <div className="flex justify-between gap-space-4">
              <dt>Paid</dt>
              <dd className="tabular-nums">{formatRupees(bill.paid_paise)}</dd>
            </div>
          ) : null}
          {bill.waived_paise > 0 ? (
            <div className="flex justify-between gap-space-4">
              <dt>Waived</dt>
              <dd className="tabular-nums">
                {formatRupees(bill.waived_paise)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-space-4 font-semibold">
            <dt>Outstanding</dt>
            <dd className="tabular-nums">
              {formatRupees(bill.outstanding_paise)}
            </dd>
          </div>
          <div className="flex justify-between gap-space-4">
            <dt>Due date</dt>
            <dd>{formatBillingDate(bill.due_date)}</dd>
          </div>
          {bill.cancel_reason ? (
            <div className="flex justify-between gap-space-4">
              <dt>Cancellation reason</dt>
              <dd>{bill.cancel_reason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>
      <div className="flex flex-wrap gap-space-3">
        <a
          className={linkButtonClass}
          download
          href={`/api/billing/bills/${bill.id}`}
        >
          Download PDF
        </a>
        {ledgerHref ? (
          <Link className={linkButtonClass} href={ledgerHref}>
            View Unit Ledger
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
