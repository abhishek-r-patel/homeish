// Responsive job-history list for import and operational tasks.
'use client';

import Link from 'next/link';
import type { listSocietyJobs } from '@/core/jobs/operations';
import type { ProductStatus } from '@/components/ui/data-display';
import { StatusChip } from '@/components/ui/data-display';
import { DataTable } from '@/components/ui/table-controls';
import type { DataTableColumn } from '@/components/ui/table-controls';

type JobRow = Awaited<ReturnType<typeof listSocietyJobs>>['rows'][number];

const jobStatus: Readonly<Record<string, ProductStatus>> = {
  queued: 'job.queued',
  running: 'job.running',
  succeeded: 'job.succeeded',
  partial: 'job.partial',
  failed: 'job.failed',
};

const jobType: Readonly<Record<string, string>> = {
  bill_generation: 'Bill generation',
  csv_import_units: 'Unit CSV import',
  csv_import_residents: 'Resident CSV import',
  export: 'Export',
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function JobList({ rows }: { rows: readonly JobRow[] }) {
  const columns: readonly DataTableColumn<JobRow>[] = [
    {
      header: 'Created',
      id: 'created',
      render: (job) => formatTime(job.created_at),
    },
    {
      header: 'Job',
      id: 'type',
      render: (job) => jobType[job.type] ?? job.type,
    },
    {
      header: 'Status',
      id: 'status',
      render: (job) => (
        <StatusChip status={jobStatus[job.status] ?? 'job.queued'} />
      ),
    },
    {
      header: 'Progress',
      id: 'progress',
      render: (job) => `${job.progress}%`,
    },
    {
      header: 'Summary',
      id: 'summary',
      render: (job) => {
        const summary = job.summary;
        if (!summary || Array.isArray(summary) || typeof summary !== 'object') {
          return 'No summary';
        }
        const imported = summary.importedRows;
        const failed = summary.failedRows;
        if (typeof imported === 'number' && typeof failed === 'number') {
          return `${imported} imported · ${failed} failed`;
        }
        return job.finished_at ? 'Completed' : 'In progress';
      },
    },
  ];

  return (
    <DataTable
      caption="Society jobs"
      columns={columns}
      getRowHref={(job) => `/admin/jobs/${job.id}`}
      getRowId={(job) => job.id}
      getRowLabel={(job) => jobType[job.type] ?? job.type}
      mobilePrimary={(job) => (
        <Link className="text-brand underline" href={`/admin/jobs/${job.id}`}>
          {jobType[job.type] ?? job.type}
        </Link>
      )}
      mobileSecondary={(job) => (
        <span>
          {formatTime(job.created_at)} · {job.progress}% complete
        </span>
      )}
      mobileStatus={(job) => jobStatus[job.status] ?? 'job.queued'}
      rows={rows}
    />
  );
}
