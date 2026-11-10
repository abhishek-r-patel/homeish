// Responsive, developer-only view of scrubbed operational error records.
'use client';

import Link from 'next/link';
import { DataTable } from '@/components/ui/table-controls';
import type { DataTableColumn } from '@/components/ui/table-controls';
import { StatusChip } from '@/components/ui/data-display';
import type { ProductStatus } from '@/components/ui/data-display';
import type { Database } from '@/core/db/database.types';
import { ErrorStatusControl } from './console-controls';

type ErrorRow = Database['public']['Tables']['error_logs']['Row'];

const severityStatus: Record<string, ProductStatus> = {
  critical: 'severity.critical',
  error: 'severity.error',
  warning: 'severity.warning',
  info: 'severity.info',
};

const errorStatus: Record<string, ProductStatus> = {
  open: 'error_log.open',
  resolved: 'error_log.resolved',
  ignored: 'error_log.ignored',
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function ErrorList({
  rows,
  societyNames,
}: {
  rows: readonly ErrorRow[];
  societyNames: Readonly<Record<string, string>>;
}) {
  const columns: readonly DataTableColumn<ErrorRow>[] = [
    {
      header: 'Time',
      id: 'time',
      render: (row) => formatTime(row.created_at),
    },
    {
      header: 'Severity',
      id: 'severity',
      render: (row) => (
        <StatusChip status={severityStatus[row.severity] ?? 'severity.error'} />
      ),
    },
    {
      header: 'Society',
      id: 'society',
      render: (row) =>
        row.society_id
          ? (societyNames[row.society_id] ?? 'Unknown')
          : 'Platform',
    },
    {
      header: 'Module',
      id: 'module',
      render: (row) => row.module_key ?? 'Core',
    },
    {
      header: 'Route',
      id: 'route',
      render: (row) => row.route ?? 'Not recorded',
    },
    {
      header: 'Message',
      id: 'message',
      render: (row) => (
        <Link
          className="block max-w-80 truncate font-mono text-body text-brand underline"
          href={`/developer/errors/${row.id}`}
        >
          {row.message}
        </Link>
      ),
    },
    {
      header: 'Status',
      id: 'status',
      render: (row) => (
        <StatusChip status={errorStatus[row.status] ?? 'error_log.open'} />
      ),
    },
    {
      header: 'Actions',
      id: 'actions',
      render: (row) => (
        <ErrorStatusControl currentStatus={row.status} errorId={row.id} />
      ),
    },
  ];

  return (
    <DataTable
      caption="Error log"
      columns={columns}
      getRowHref={(row) => `/developer/errors/${row.id}`}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.message}
      mobilePrimary={(row) => (
        <Link
          className="font-mono text-body text-brand underline"
          href={`/developer/errors/${row.id}`}
        >
          {row.message}
        </Link>
      )}
      mobileSecondary={(row) => (
        <span>
          {formatTime(row.created_at)} · {row.route ?? 'Route not recorded'}
        </span>
      )}
      mobileStatus={(row) => severityStatus[row.severity] ?? 'severity.error'}
      rows={rows}
      scrollable
    />
  );
}
