// Show today's daily common-area checks for housekeeping supervisors.
import { ServiceRequestRoundsChecklist } from '@/components/service-requests/rounds';
import { getServiceRequestRoundsWorkspace } from '@/core/service-requests/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Daily checks | Homeish',
  robots: { index: false, follow: false },
};

export default async function HousekeepingRoundsPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const workspace = await getServiceRequestRoundsWorkspace();
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Daily checks')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Mark each point OK or Issue once a day. An issue can raise a new request or link an open one.',
          )}
        </p>
      </header>
      <ServiceRequestRoundsChecklist
        options={workspace.options}
        today={workspace.today}
      />
    </section>
  );
}
