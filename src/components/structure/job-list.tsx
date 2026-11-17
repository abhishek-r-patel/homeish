// Responsive job-history list for import and operational tasks.
'use client';

import Link from 'next/link';
import type { listSocietyJobs } from '@/core/jobs/operations';
import type { ProductStatus } from '@/components/ui/data-display';
import { StatusChip } from '@/components/ui/data-display';
import { DataTable } from '@/components/ui/table-controls';
import type { DataTableColumn } from '@/components/ui/table-controls';
import { useUiTranslator } from '@/components/ui/language';
import {
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { JOB_TYPE_LABELS } from './job-labels';

type JobRow = Awaited<ReturnType<typeof listSocietyJobs>>['rows'][number];

const jobStatus: Readonly<Record<string, ProductStatus>> = {
  queued: 'job.queued',
  running: 'job.running',
  succeeded: 'job.succeeded',
  partial: 'job.partial',
  failed: 'job.failed',
};

export function JobList({ rows }: { rows: readonly JobRow[] }) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const formatTime = (value: string) =>
    formatLocalizedDateTime(new Date(value), locale ?? 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });
  const columns: readonly DataTableColumn<JobRow>[] = [
    {
      header: t('Created'),
      id: 'created',
      render: (job) => formatTime(job.created_at),
    },
    {
      header: t('Job'),
      id: 'type',
      render: (job) => t(JOB_TYPE_LABELS[job.type] ?? job.type),
    },
    {
      header: t('Status'),
      id: 'status',
      render: (job) => (
        <StatusChip status={jobStatus[job.status] ?? 'job.queued'} />
      ),
    },
    {
      header: t('Progress'),
      id: 'progress',
      render: (job) => `${number(job.progress)}%`,
    },
    {
      header: t('Summary'),
      id: 'summary',
      render: (job) => {
        const summary = job.summary;
        if (!summary || Array.isArray(summary) || typeof summary !== 'object') {
          return t('No summary');
        }
        const imported = summary.importedRows;
        const failed = summary.failedRows;
        if (typeof imported === 'number' && typeof failed === 'number') {
          return t('{imported} imported · {failed} failed', {
            imported: number(imported),
            failed: number(failed),
          });
        }
        return t(job.finished_at ? 'Completed' : 'In progress');
      },
    },
  ];

  return (
    <DataTable
      caption={t('Society jobs')}
      columns={columns}
      getRowHref={(job) => `/admin/jobs/${job.id}`}
      getRowId={(job) => job.id}
      getRowLabel={(job) => t(JOB_TYPE_LABELS[job.type] ?? job.type)}
      mobilePrimary={(job) => (
        <Link className="text-brand underline" href={`/admin/jobs/${job.id}`}>
          {t(JOB_TYPE_LABELS[job.type] ?? job.type)}
        </Link>
      )}
      mobileSecondary={(job) => (
        <span>
          {t('{date} · {progress}% complete', {
            date: formatTime(job.created_at),
            progress: number(job.progress),
          })}
        </span>
      )}
      mobileStatus={(job) => jobStatus[job.status] ?? 'job.queued'}
      rows={rows}
    />
  );
}
