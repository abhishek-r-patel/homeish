// Render the P50.6 summary for admins and committee without consent details.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import type { MajorWorksSummary } from '@/core/major-works/validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { translateMessage } from '@/core/i18n/messages';
import { STAGE_LABELS } from './proposal-forms';
import { STATUS_LABELS } from './project-forms';

export function MajorWorksSummaryView({
  locale,
  summary,
}: {
  locale: 'en' | 'hi';
  summary: MajorWorksSummary;
}) {
  const t = (source: string) => translateMessage(locale, source);
  const money = (amount: number) =>
    formatLocalizedCurrency(BigInt(amount), locale);
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
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <Link className="text-brand underline" href="/admin/major-works">
          {t('Back to major works')}
        </Link>
        <h1 className="text-title font-semibold">{t('Major works summary')}</h1>
      </header>
      {summary.overdue_audits ? (
        <Banner title={t('Structural audit overdue')} tone="warning">
          {t(
            'The latest non-voided structural audit is past its next due date.',
          )}
        </Banner>
      ) : null}
      <div className="grid gap-space-3 medium:grid-cols-3">
        {summary.proposals_by_stage.map((row) => (
          <Card key={row.stage} title={t(STAGE_LABELS[row.stage])}>
            <p>{row.count}</p>
          </Card>
        ))}
      </div>
      <Card
        title={t('Active repair projects')}
        description={t(
          'Budget, spend, progress and delay only. Consent details and private files are not included.',
        )}
      >
        {summary.projects.length ? (
          <div className="grid gap-space-3">
            {summary.projects.map((project) => (
              <div
                className="rounded-md border border-rule p-space-3"
                key={project.id}
              >
                <div className="flex flex-wrap justify-between gap-space-2">
                  <strong>{project.title}</strong>
                  <span>{t(STATUS_LABELS[project.status])}</span>
                </div>
                <dl className="mt-space-2 grid gap-space-2 medium:grid-cols-4">
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Budget')}
                    </dt>
                    <dd>{money(project.budget_paise)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Spend')}
                    </dt>
                    <dd>
                      {project.spend_paise === null
                        ? t('Not available')
                        : money(project.spend_paise)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Progress')}
                    </dt>
                    <dd>{project.progress_percent}%</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Planned end')}
                    </dt>
                    <dd>
                      {date(project.planned_end_on)}
                      {project.delayed ? ` · ${t('Delayed')}` : ''}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p>{t('No active repair projects.')}</p>
        )}
      </Card>
    </section>
  );
}
