// Show cross-society audit events with readable before-and-after values.
'use client';

import type { Json } from '@/core/db/database.types';
import type { listDeveloperAudit } from '@/core/developer/console';
import { DataTable } from '@/components/ui/table-controls';
import type { DataTableColumn } from '@/components/ui/table-controls';

type AuditRow = Awaited<ReturnType<typeof listDeveloperAudit>>['rows'][number];

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function objectEntries(
  value: Json | null,
): readonly [string, Json | undefined][] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value);
}

function display(value: Json | undefined) {
  if (value === undefined || value === null || value === '') return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function AuditDiff({ row }: { row: AuditRow }) {
  const before = objectEntries(row.before);
  const after = objectEntries(row.after);
  const keys = [
    ...new Set([...before.map(([key]) => key), ...after.map(([key]) => key)]),
  ];
  if (keys.length === 0) return <span>No field changes recorded</span>;

  const beforeValues = new Map(before);
  const afterValues = new Map(after);
  return (
    <details className="min-w-52">
      <summary className="min-h-10 cursor-pointer text-brand underline">
        View changes
      </summary>
      <dl className="grid gap-space-2 p-space-2">
        {keys.map((key) => (
          <div className="grid gap-x-space-3 medium:grid-cols-3" key={key}>
            <dt className="font-semibold">{key}</dt>
            <dd className="break-all text-ink-muted">
              Before: {display(beforeValues.get(key))}
            </dd>
            <dd className="break-all">
              After: {display(afterValues.get(key))}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function AuditList({ rows }: { rows: readonly AuditRow[] }) {
  const columns: readonly DataTableColumn<AuditRow>[] = [
    {
      header: 'Time',
      id: 'time',
      render: (row) => formatTime(row.created_at),
    },
    {
      header: 'Society',
      id: 'society',
      render: (row) => row.societyName,
    },
    {
      header: 'Actor',
      id: 'actor',
      render: (row) => row.actorName,
    },
    {
      header: 'Action',
      id: 'action',
      render: (row) => row.action,
    },
    {
      header: 'Entity',
      id: 'entity',
      render: (row) => row.entity_type,
    },
    {
      header: 'Change',
      id: 'change',
      render: (row) => <AuditDiff row={row} />,
    },
  ];

  return (
    <DataTable
      caption="Audit log"
      columns={columns}
      getRowId={(row) => String(row.id)}
      getRowLabel={(row) => row.action}
      mobilePrimary={(row) => (
        <span>
          {row.action} · {row.entity_type}
        </span>
      )}
      mobileSecondary={(row) => (
        <span>
          {row.societyName} · {row.actorName} · {formatTime(row.created_at)}
        </span>
      )}
      rows={rows}
      scrollable
    />
  );
}
