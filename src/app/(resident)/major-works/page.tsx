// Show residents only the P50.1 simplified repair-project list.
import { Card } from '@/components/ui/data-display';
import { listResidentMajorWorksProjects } from '@/core/major-works/operations';
import { listMyMajorWorksConsents } from '@/core/major-works/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { formatLocalizedDate } from '@/core/i18n/format';
import { STATUS_LABELS } from '@/components/major-works/project-forms';

export const metadata = {
  title: 'Major works | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentMajorWorksPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const [data, consentData] = await Promise.all([
    listResidentMajorWorksProjects(),
    listMyMajorWorksConsents(),
  ]);
  const date = (value: string | null) =>
    value
      ? formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : t('Not set');
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Major works')}</h1>
        <p className="text-ink-muted">
          {t('Project status, progress and planned dates.')}
        </p>
      </header>
      {data.projects.length ? (
        <div className="grid gap-space-4">
          {data.projects.map((project) => (
            <Card key={project.id} title={project.title}>
              <dl className="grid gap-space-3 medium:grid-cols-2">
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Location')}
                  </dt>
                  <dd>{project.location}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">{t('Status')}</dt>
                  <dd>{t(STATUS_LABELS[project.status])}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Progress')}
                  </dt>
                  <dd>{project.progress_percent}%</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Planned dates')}
                  </dt>
                  <dd>
                    {date(project.planned_start_on)} –{' '}
                    {date(project.planned_end_on)}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      ) : (
        <Card title={t('Repair projects')}>
          <p>{t('No repair projects have been added.')}</p>
        </Card>
      )}
      {consentData.consents.length ? (
        <Card
          title={t('My unit consent status')}
          description={t(
            'Only consent records for your own owner unit are shown.',
          )}
        >
          <ul className="grid gap-space-3">
            {consentData.consents.map((consent) => (
              <li
                className="rounded-md border border-rule p-space-3"
                key={`${consent.proposal_id}:${consent.unit_id}`}
              >
                <strong>{consent.developer_name}</strong>
                <p className="text-caption text-ink-muted">
                  {consent.unit_number} -{' '}
                  {consent.status === 'consents'
                    ? t('Consents')
                    : consent.status === 'does_not_consent'
                      ? t('Does not consent')
                      : t('Pending')}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
