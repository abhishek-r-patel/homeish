// Show the stored bill-generation outcome without repeating the mutation.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ResultScreen } from '@/components/ui/result-screen';
import { getBillingGenerationCompletion } from '@/core/billing/operations';
import { formatBillingPeriod, formatRupees } from '@/core/billing/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Bills generated | Homeish',
  robots: { index: false, follow: false },
};

export default async function BillingCompletePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  if (!z.uuid().safeParse(jobId).success) notFound();
  const completion = await getBillingGenerationCompletion(jobId);
  if (!completion) notFound();
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const count = completion.generated_bill_count;

  return (
    <ResultScreen
      actions={[
        {
          href: '/admin/billing?tab=bills',
          label: t('View bills'),
          primary: true,
        },
        { href: '/admin/billing', label: t('Back to Billing') },
      ]}
      outcome={t(
        count === 1
          ? '{count} bill was generated for the selected billing period.'
          : '{count} bills were generated for the selected billing period.',
        { count },
      )}
      summary={[
        {
          label: t('Billing month'),
          value: formatBillingPeriod(completion.period_start),
        },
        { label: t('Bills generated'), value: String(count) },
        {
          label: t('Total amount'),
          value: formatRupees(completion.total_paise),
        },
      ]}
      title={t(count === 0 ? 'No new bills generated' : 'Bills generated')}
    />
  );
}
