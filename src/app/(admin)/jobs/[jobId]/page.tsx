// Show a finished or in-progress job and any bounded row-level errors.
import Link from 'next/link';
import { Card, StatusChip } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { getSocietyJob } from '@/core/jobs/operations';
import type { ProductStatus } from '@/components/ui/data-display';

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
  const { jobId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      jobId,
    )
  ) {
    return (
      <ErrorPanel message="Check the job address." title="Job not found" />
    );
  }
  const job = await getSocietyJob(jobId);
  const status = jobStatus[job.status] ?? 'job.queued';
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-caption text-brand underline" href="/admin/jobs">
          Back to Jobs
        </Link>
        <h1 className="text-title font-semibold">Job Details</h1>
      </header>
      <Card title={job.type}>
        <dl className="grid gap-space-3 medium:grid-cols-2">
          <div>
            <dt className="text-caption text-ink-muted">Status</dt>
            <dd className="mt-space-1">
              <StatusChip status={status} />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Progress</dt>
            <dd className="text-body">{job.progress}%</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Created</dt>
            <dd className="text-body">
              {new Intl.DateTimeFormat('en', {
                dateStyle: 'full',
                timeStyle: 'long',
                timeZone: 'Asia/Kolkata',
              }).format(new Date(job.created_at))}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Finished</dt>
            <dd className="text-body">
              {job.finished_at
                ? new Intl.DateTimeFormat('en', {
                    dateStyle: 'full',
                    timeStyle: 'long',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(job.finished_at))
                : 'Not finished'}
            </dd>
          </div>
        </dl>
      </Card>
      <Card title="Result">
        {job.summary ? (
          <div className="grid gap-space-3">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-sunken p-space-3 font-mono text-caption">
              {JSON.stringify(job.summary, null, 2)}
            </pre>
            {job.type === 'csv_import_units' &&
            typeof job.summary === 'object' &&
            !Array.isArray(job.summary) &&
            Array.isArray(job.summary.errors) &&
            job.summary.errors.length > 0 ? (
              <a
                className="w-fit text-body text-brand underline"
                href={`/admin/jobs/${job.id}/errors.csv`}
              >
                Download row error report
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            No result is available yet.
          </p>
        )}
      </Card>
    </section>
  );
}
