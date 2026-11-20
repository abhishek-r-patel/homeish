// Let housekeeping supervisors log a request reported by a resident or found on site.
import { Card } from '@/components/ui/data-display';
import { ServiceRequestLogForm } from '@/components/service-requests/log-form';
import { getServiceRequestLogOptions } from '@/core/service-requests/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Log a request | Homeish',
  robots: { index: false, follow: false },
};

export default async function HousekeepingLogRequestPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const options = await getServiceRequestLogOptions();
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Log a request')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Record a request for a unit or common area and how it reached you. The admin team takes it from there.',
          )}
        </p>
      </header>
      <Card className="min-w-0" title={t('Request details')}>
        <ServiceRequestLogForm
          categories={options.categories}
          units={options.units}
        />
      </Card>
    </section>
  );
}
