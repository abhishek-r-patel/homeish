// Show bill line items as a definition list with totals and a PDF download.
'use client';

import Link from 'next/link';
import { Card, StatusChip } from '@/components/ui/data-display';
import { billDisplayStatus } from '@/core/billing/format';
import { useUiTranslator } from '@/components/ui/language';
import { billingDate, billingMoney, billingPeriod } from './presentation';
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
  const { locale, translate: t } = useUiTranslator();
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
            {billingPeriod(bill.period_start, locale)}
          </p>
        </div>
        <StatusChip status={billDisplayStatus(bill, today)} />
      </header>
      <Card title={t('Bill details')}>
        <dl className="grid gap-space-3 text-body">
          {bill.lines.map((line) => (
            <div className="flex justify-between gap-space-4" key={line.id}>
              <dt>{line.description}</dt>
              <dd className="tabular-nums">
                {billingMoney(line.amount_paise, locale)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-space-4 border-t border-rule pt-space-3 font-semibold">
            <dt>{t('Total')}</dt>
            <dd className="tabular-nums">
              {billingMoney(bill.total_paise, locale)}
            </dd>
          </div>
          {bill.paid_paise > 0 ? (
            <div className="flex justify-between gap-space-4">
              <dt>{t('Paid')}</dt>
              <dd className="tabular-nums">
                {billingMoney(bill.paid_paise, locale)}
              </dd>
            </div>
          ) : null}
          {bill.waived_paise > 0 ? (
            <div className="flex justify-between gap-space-4">
              <dt>{t('Waived')}</dt>
              <dd className="tabular-nums">
                {billingMoney(bill.waived_paise, locale)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-space-4 font-semibold">
            <dt>{t('Outstanding')}</dt>
            <dd className="tabular-nums">
              {billingMoney(bill.outstanding_paise, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-space-4">
            <dt>{t('Due date')}</dt>
            <dd>{billingDate(bill.due_date, locale)}</dd>
          </div>
          {bill.cancel_reason ? (
            <div className="flex justify-between gap-space-4">
              <dt>{t('Cancellation reason')}</dt>
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
          {t('Download PDF')}
        </a>
        {ledgerHref ? (
          <Link className={linkButtonClass} href={ledgerHref}>
            {t('View Unit Ledger')}
          </Link>
        ) : null}
      </div>
      <p className="text-caption text-ink-muted">
        {t('PDF documents remain in English.')}
      </p>
      {children}
    </section>
  );
}
