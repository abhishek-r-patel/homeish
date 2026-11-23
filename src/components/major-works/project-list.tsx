// Present P50.1 project, budget and spend details with role-gated controls.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import {
  CATEGORY_LABELS,
  MajorWorksProjectForm,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from './project-forms';
import {
  MajorWorksBudgetForm,
  MajorWorksStatusForm,
} from './status-budget-forms';
import {
  MajorWorksSpendTagForm,
  MajorWorksSpendTagRemoveForm,
} from './spend-forms';
import type { MajorWorksAdminList } from '@/core/major-works/validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { translateMessage } from '@/core/i18n/messages';

export function MajorWorksProjectList({
  locale,
  data,
}: {
  locale: 'en' | 'hi';
  data: MajorWorksAdminList;
}) {
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const money = (paise: number) =>
    formatLocalizedCurrency(BigInt(paise), locale);
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
    <div className="grid gap-space-5">
      {!data.expense_enabled ? (
        <Banner title={t('Accounts is off')} tone="info">
          {t(
            'Project budgets still show. Forecast links, sanctioned work and spend are unavailable.',
          )}
        </Banner>
      ) : null}
      {!data.can_manage ? (
        <Banner title={t('View only')} tone="info">
          {t(
            'Committee members can review project, budget and spend records but cannot change them.',
          )}
        </Banner>
      ) : null}
      {data.projects.length ? (
        data.projects.map((project) => (
          <Card
            description={`${t(CATEGORY_LABELS[project.category])} · ${t(
              PRIORITY_LABELS[project.priority],
            )}`}
            key={project.id}
            title={project.title}
          >
            <div className="grid gap-space-4">
              <div className="flex flex-wrap gap-space-2">
                <span className="rounded-full bg-surface-sunken px-space-3 py-space-1 text-caption">
                  {t(STATUS_LABELS[project.status])}
                </span>
                {project.status_reason ? (
                  <span className="rounded-full bg-surface-sunken px-space-3 py-space-1 text-caption">
                    {project.status_reason}
                  </span>
                ) : null}
                {project.forecast_item_id ? (
                  <span className="rounded-full bg-surface-sunken px-space-3 py-space-1 text-caption">
                    {t('Linked to repair forecast')}
                  </span>
                ) : null}
              </div>
              <dl className="grid gap-space-3 medium:grid-cols-4">
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Location')}
                  </dt>
                  <dd>{project.location}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Progress')}
                  </dt>
                  <dd>{project.progress_percent}%</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Planned')}
                  </dt>
                  <dd>
                    {date(project.planned_start_on)} –{' '}
                    {date(project.planned_end_on)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Budget / spend')}
                  </dt>
                  <dd>
                    {money(project.budget_paise)} /{' '}
                    {project.spend_paise === null
                      ? t('Not available')
                      : money(project.spend_paise)}
                  </dd>
                </div>
              </dl>
              {project.spend_paise !== null &&
              project.spend_paise > project.budget_paise ? (
                <Banner title={t('Spend is above budget')} tone="warning">
                  {t('This warning does not block work or create an approval.')}
                </Banner>
              ) : null}
              {project.approval_body && project.approval_date ? (
                <p className="text-caption text-ink-muted">
                  {t(
                    'Approval recorded from {body} on {date}. Homeish did not approve the work.',
                    {
                      body:
                        project.approval_body === 'general_body'
                          ? t('General body')
                          : project.approval_body === 'committee'
                            ? t('Committee')
                            : t('Other'),
                      date: date(project.approval_date),
                    },
                  )}
                </p>
              ) : null}
              {project.notes ? <p>{project.notes}</p> : null}
              <Link
                className="justify-self-start text-brand underline"
                href={`/admin/major-works/projects/${project.id}/scoring`}
              >
                {t('Quotes and scoring')}
              </Link>
              <Link
                className="justify-self-start text-brand underline"
                href={`/admin/major-works/projects/${project.id}/scenarios`}
              >
                {t('Funding scenarios')}
              </Link>
              {project.spend_tags.length ? (
                <div className="grid gap-space-2">
                  <h3 className="text-body-strong">
                    {t('Tagged Accounts expenses')}
                  </h3>
                  {project.spend_tags.map((tag) => (
                    <div
                      className={`grid gap-space-2 rounded-md border border-rule p-space-3 ${
                        tag.removed_at ? 'text-ink-muted' : ''
                      }`}
                      key={tag.id}
                    >
                      <p>
                        {tag.entry_date} - {tag.counterparty} -{' '}
                        {money(tag.amount_paise)}
                        {tag.removed_at ? ` - ${t('Removed')}` : ''}
                      </p>
                      {tag.removal_reason ? (
                        <p className="text-caption">{tag.removal_reason}</p>
                      ) : null}
                      {data.can_manage ? (
                        <MajorWorksSpendTagRemoveForm tag={tag} />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {data.can_manage ? (
                <details className="rounded-md border border-rule p-space-3">
                  <summary className="cursor-pointer">
                    {t('Manage project')}
                  </summary>
                  <div className="mt-space-4 grid gap-space-5">
                    <MajorWorksProjectForm
                      forecastItems={data.forecast_items}
                      project={project}
                    />
                    <MajorWorksStatusForm
                      meetingResolutions={data.meeting_resolutions}
                      project={project}
                    />
                    <MajorWorksBudgetForm
                      project={project}
                      sanctionedWorks={data.sanctioned_works}
                    />
                    {data.expense_enabled ? (
                      <MajorWorksSpendTagForm
                        entries={data.expense_entries}
                        project={project}
                      />
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          </Card>
        ))
      ) : (
        <Card title={t('Repair projects')}>
          <p>{t('No repair projects have been added.')}</p>
        </Card>
      )}
      {data.can_manage ? (
        <Card title={t('Add repair project')}>
          <MajorWorksProjectForm forecastItems={data.forecast_items} />
        </Card>
      ) : null}
    </div>
  );
}
