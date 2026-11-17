// Resident form for submitting a service request with optional photos.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { ServiceRequestCreateForm } from '@/components/service-requests/create-form';
import { getServiceRequestCreateOptions } from '@/core/service-requests/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'New request | Homeish',
  robots: { index: false, follow: false },
};

export default async function NewServiceRequestPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const { categories, units } = await getServiceRequestCreateOptions();
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-body text-brand underline" href="/requests">
          {t('Back to requests')}
        </Link>
        <h1 className="text-title font-semibold">{t('New service request')}</h1>
        <p className="text-body text-ink-muted">
          {t('Share enough detail to help the society resolve the issue.')}
        </p>
      </header>
      {categories.length === 0 ? (
        <Banner tone="info">
          {t(
            'The society has no active request categories. Contact the society office.',
          )}
        </Banner>
      ) : (
        <Card className="min-w-0" title={t('Request details')}>
          <ServiceRequestCreateForm categories={categories} units={units} />
        </Card>
      )}
    </section>
  );
}
