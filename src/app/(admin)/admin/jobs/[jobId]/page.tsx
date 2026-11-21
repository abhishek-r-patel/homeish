// Show a finished or in-progress job and any bounded row-level errors.
import Link from 'next/link';
import { Card, StatusChip } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { getSocietyJob } from '@/core/jobs/operations';
import type { ProductStatus } from '@/components/ui/data-display';
import {
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { JOB_TYPE_LABELS } from '@/components/structure/job-labels';
import { JobResult } from '@/components/structure/job-result';

export const metadata = {
  title: 'Job Details | Homeish',
  robots: { index: false, follow: false },
};

type JobDetailPageProps = {
  params: Promise<{ jobId: string }>;
};

const jobStatus: Readonly<Record<string, ProductStatus>> = {
  queued: 'job.queued',
  running: 'job.running',
  succeeded: 'job.succeeded',
  partial: 'job.partial',
  failed: 'job.failed',
} as const;

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const { jobId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      jobId,
    )
  ) {
    return (
      <ErrorPanel
        message={t('Check the job address.')}
        title={t('Job not found')}
      />
    );
  }
  const job = await getSocietyJob(jobId);
  const status = jobStatus[job.status] ?? 'job.queued';
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-caption text-brand underline" href="/admin/jobs">
          {t('Back to Jobs')}
        </Link>
        <h1 className="text-title font-semibold">{t('Job Details')}</h1>
      </header>
      <Card title={t(JOB_TYPE_LABELS[job.type] ?? job.type)}>
        <dl className="grid gap-space-3 medium:grid-cols-2">
          <div>
            <dt className="text-caption text-ink-muted">{t('Status')}</dt>
            <dd className="mt-space-1">
              <StatusChip status={status} />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Progress')}</dt>
            <dd className="text-body">
              {formatLocalizedNumber(job.progress, locale)}%
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Created')}</dt>
            <dd className="text-body">
              {formatLocalizedDateTime(new Date(job.created_at), locale, {
                dateStyle: 'full',
                timeStyle: 'long',
                timeZone: 'Asia/Kolkata',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Finished')}</dt>
            <dd className="text-body">
              {job.finished_at
                ? formatLocalizedDateTime(new Date(job.finished_at), locale, {
                    dateStyle: 'full',
                    timeStyle: 'long',
                    timeZone: 'Asia/Kolkata',
                  })
                : t('Not finished')}
            </dd>
          </div>
        </dl>
      </Card>
      <Card title={t('Result')}>
        {job.summary ? (
          <div className="grid gap-space-3">
            <JobResult summary={job.summary} />
            {job.type === 'csv_import_units' &&
            typeof job.summary === 'object' &&
            !Array.isArray(job.summary) &&
            Array.isArray(job.summary.errors) &&
            job.summary.errors.length > 0 ? (
              <a
                className="w-fit text-body text-brand underline"
                href={`/admin/jobs/${job.id}/errors.csv`}
              >
                {t('Download row error report')}
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No result is available yet.')}
          </p>
        )}
      </Card>
    </section>
  );
}
