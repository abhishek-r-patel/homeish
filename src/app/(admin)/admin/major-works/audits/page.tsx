// Show P50.1b structural audits, private reports and due-reminder state.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import {
  MajorWorksAuditForm,
  MajorWorksAuditVoidForm,
  RATING_LABELS,
  REPAIR_LABELS,
} from '@/components/major-works/audit-forms';
import { listMajorWorksAudits } from '@/core/major-works/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { formatLocalizedDate } from '@/core/i18n/format';

export const metadata = {
  title: 'Structural audits | Major works | Homeish',
  robots: { index: false, follow: false },
};

export default async function MajorWorksAuditsPage() {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const data = await listMajorWorksAudits();
  const date = (value: string) =>
    formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <Link
          className="text-caption text-brand underline"
          href="/admin/major-works"
        >
          {t('Back to major works')}
        </Link>
        <h1 className="text-title font-semibold">{t('Structural audits')}</h1>
        <p className="text-ink-muted">
          {t(
            'Keep reports private and follow repair status without treating the app as a structural or legal certificate.',
          )}
        </p>
      </header>
      {!data.can_manage ? (
        <Banner title={t('View only')} tone="info">
          {t(
            'Committee members can read audits and private reports but cannot change them.',
          )}
        </Banner>
      ) : null}
      <Banner title={t('Audit record only')} tone="warning">
        {t(
          'Homeish stores what the society records. It does not verify the auditor, rating or next due date.',
        )}
      </Banner>
      {data.audits.length ? (
        data.audits.map((audit) => (
          <Card
            description={`${date(audit.audit_on)} · ${t(RATING_LABELS[audit.rating])}`}
            key={audit.id}
            title={audit.auditor_name}
          >
            <div className="grid gap-space-3">
              {audit.voided_at ? (
                <Banner title={t('Voided')} tone="warning">
                  {audit.void_reason}
                </Banner>
              ) : null}
              <dl className="grid gap-space-3 medium:grid-cols-3">
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Repair status')}
                  </dt>
                  <dd>{t(REPAIR_LABELS[audit.repair_status])}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Next due')}
                  </dt>
                  <dd>{date(audit.next_due_on)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Reminder')}
                  </dt>
                  <dd>
                    {audit.reminder_overdue_sent_at
                      ? t('Overdue reminder sent')
                      : audit.reminder_due_sent_at
                        ? t('30-day reminder sent')
                        : t('Pending by due date')}
                  </dd>
                </div>
              </dl>
              <p>{audit.findings}</p>
              {audit.projects.length ? (
                <p className="text-caption text-ink-muted">
                  {t('Linked projects: {projects}', {
                    projects: audit.projects
                      .map((project) => project.title)
                      .join(', '),
                  })}
                </p>
              ) : null}
              {audit.report_url ? (
                <a className="text-brand underline" href={audit.report_url}>
                  {t('Open private report')}
                </a>
              ) : null}
              {data.can_manage ? (
                <details className="rounded-md border border-rule p-space-3">
                  <summary className="cursor-pointer">
                    {t('Manage audit')}
                  </summary>
                  <div className="mt-space-3 grid gap-space-4">
                    {!audit.voided_at ? (
                      <MajorWorksAuditForm
                        audit={audit}
                        projects={data.projects}
                      />
                    ) : null}
                    <MajorWorksAuditVoidForm audit={audit} />
                  </div>
                </details>
              ) : null}
            </div>
          </Card>
        ))
      ) : (
        <Card title={t('Structural audits')}>
          <p>{t('No structural audits have been recorded.')}</p>
        </Card>
      )}
      {data.can_manage ? (
        <Card title={t('Add structural audit')}>
          <MajorWorksAuditForm projects={data.projects} />
        </Card>
      ) : null}
    </section>
  );
}
