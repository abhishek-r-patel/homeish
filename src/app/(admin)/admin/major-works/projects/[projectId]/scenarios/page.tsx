// Show P50.3 what-if-only funding scenarios without creating a levy or bill.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { MajorWorksScenarioForm } from '@/components/major-works/scenario-form';
import { listMajorWorksScenarios } from '@/core/major-works/operations';
import { formatLocalizedCurrency } from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Funding scenarios | Major works | Homeish',
  robots: { index: false, follow: false },
};

export default async function MajorWorksScenariosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const { projectId } = await params;
  const data = await listMajorWorksScenarios(projectId);
  const money = (amount: number) =>
    formatLocalizedCurrency(BigInt(amount), locale);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <Link className="text-brand underline" href="/admin/major-works">
          {t('Back to major works')}
        </Link>
        <h1 className="text-title font-semibold">
          {data.project
            ? t('{project}: funding scenarios', { project: data.project.title })
            : t('Funding scenarios')}
        </h1>
      </header>
      <Banner title={t('What-if only - not a levy')} tone="warning">
        {t(
          'Scenarios create no bill, charge, receivable, notice, receipt, fund allocation or Accounts entry.',
        )}
      </Banner>
      {data.scenarios.length ? (
        data.scenarios.map((scenario) => (
          <Card
            description={
              scenario.split === 'area'
                ? t('By unit area')
                : t('Equal per unit')
            }
            key={scenario.id}
            title={scenario.name}
          >
            <div className="grid gap-space-4">
              <dl className="grid gap-space-3 medium:grid-cols-3">
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Amount to raise')}
                  </dt>
                  <dd>{money(scenario.amount_paise)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Rounding difference')}
                  </dt>
                  <dd>{money(scenario.rounding_difference_paise)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">{t('Status')}</dt>
                  <dd>{scenario.complete ? t('Complete') : t('Incomplete')}</dd>
                </div>
              </dl>
              {scenario.missing_area_units.length ? (
                <Banner title={t('Unit area needed')} tone="warning">
                  {t('Units missing area: {units}', {
                    units: scenario.missing_area_units
                      .map((unit) => unit.unit_number)
                      .join(', '),
                  })}
                </Banner>
              ) : null}
              {scenario.shares.length ? (
                <div
                  aria-label={t('Scenario unit shares')}
                  className="max-w-full overflow-x-auto"
                  role="region"
                  tabIndex={0}
                >
                  <table className="min-w-112 border-collapse">
                    <thead>
                      <tr>
                        <th className="px-space-2 py-space-2 text-left">
                          {t('Unit')}
                        </th>
                        <th className="px-space-2 py-space-2 text-right">
                          {t('Area')}
                        </th>
                        <th className="px-space-2 py-space-2 text-right">
                          {t('What-if amount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenario.shares.map((share) => (
                        <tr
                          className="border-t border-rule"
                          key={share.unit_id}
                        >
                          <th className="px-space-2 py-space-2 text-left">
                            {share.unit_number}
                          </th>
                          <td className="px-space-2 py-space-2 text-right">
                            {share.area_sqft ?? t('Not set')}
                          </td>
                          <td className="px-space-2 py-space-2 text-right">
                            {money(share.amount_paise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {data.can_manage ? (
                <details className="rounded-md border border-rule p-space-3">
                  <summary className="cursor-pointer">
                    {t('Edit scenario')}
                  </summary>
                  <div className="mt-space-3">
                    <MajorWorksScenarioForm
                      data={data}
                      projectId={projectId}
                      scenario={scenario}
                    />
                  </div>
                </details>
              ) : null}
            </div>
          </Card>
        ))
      ) : (
        <Card title={t('Funding scenarios')}>
          <p>{t('No funding scenarios have been added.')}</p>
        </Card>
      )}
      {data.can_manage ? (
        <Card title={t('Add funding scenario')}>
          <MajorWorksScenarioForm data={data} projectId={projectId} />
        </Card>
      ) : null}
    </section>
  );
}
