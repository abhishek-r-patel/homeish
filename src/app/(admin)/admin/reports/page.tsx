// List existing reports and exports available to the current manager.
import { ReportsHub } from '@/components/home/reports-hub';
import { createRequestId, AppError } from '@/core/errors';
import { getAllowedReports } from '@/core/home/reports';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { authorizeRequest } from '@/core/permissions/authorize';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Reports | Homeish',
  robots: { index: false, follow: false },
};

export default async function ReportsHubPage() {
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'reports:read',
  });
  const reports = getAllowedReports(context.roles, context.enabledModules);
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Reports')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Open existing reports and exports available for your role and enabled modules.',
          )}
        </p>
      </header>
      <ReportsHub reports={reports} />
    </section>
  );
}
