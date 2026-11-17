// Resident UPI payment screen with optional resubmission of a rejected payment.
import Link from 'next/link';
import { BillingPayForm } from '@/components/billing/pay-form';
import { EmptyState } from '@/components/ui/feedback';
import { todayInTimeZone } from '@/core/billing/format';
import { getResidentBilling } from '@/core/billing/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';

export const metadata = {
  title: 'Pay maintenance | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentPayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const params = await searchParams;
  const billing = await getResidentBilling();
  const back = (
    <Link className="text-body text-brand underline" href="/bills">
      {t('← Bills')}
    </Link>
  );

  if (
    billing.suspended ||
    !billing.paymentDetails ||
    billing.units.length === 0
  ) {
    return (
      <section className="grid gap-space-5">
        {back}
        <h1 className="text-title font-semibold">{t('Pay maintenance')}</h1>
        <EmptyState
          description={
            billing.suspended
              ? t(
                  'This society is suspended. Payments cannot be submitted right now.',
                )
              : billing.units.length === 0
                ? t('You are not linked to an active {unit}.', {
                    unit: billing.unitLabel.toLowerCase(),
                  })
                : t(
                    'The society has not added UPI payment details yet. Pay at the society office.',
                  )
          }
          title={t('Online payment unavailable')}
        />
      </section>
    );
  }

  const units = billing.units.map((unit) => ({
    ...unit,
    outstandingPaise: billing.bills
      .filter(
        (bill) =>
          bill.unit_id === unit.id &&
          (bill.status === 'due' || bill.status === 'partially_paid'),
      )
      .reduce((sum, bill) => sum + bill.outstanding_paise, 0),
  }));
  const resubmitId =
    typeof params.resubmit === 'string' ? params.resubmit : undefined;
  const rejected = billing.payments.find(
    (payment) => payment.id === resubmitId && payment.status === 'rejected',
  );
  const defaultUnit =
    units.find((unit) => unit.outstandingPaise > 0) ?? units[0];

  return (
    <section className="grid max-w-content-default gap-space-5">
      {back}
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Pay maintenance')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Pay with your UPI app, then submit the reference so the society can confirm it and issue a receipt.',
          )}
        </p>
      </header>
      <BillingPayForm
        details={billing.paymentDetails}
        initialAmountPaise={rejected?.amount_paise ?? null}
        initialUnitId={rejected?.unit_id ?? defaultUnit?.id ?? ''}
        qrUrl={billing.qrUrl}
        resubmitReason={
          rejected
            ? (rejected.reject_reason ??
              t('The society rejected this payment.'))
            : null
        }
        timezone={billing.timezone}
        today={todayInTimeZone(billing.timezone)}
        unitLabel={billing.unitLabel}
        units={units}
      />
    </section>
  );
}
