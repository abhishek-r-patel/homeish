// Download the bounded row-error report from a completed CSV import job.
import { getSocietyJob } from '@/core/jobs/operations';
import type { Json } from '@/core/db/database.types';

type RouteProps = {
  params: Promise<{ jobId: string }>;
};

function isRecord(value: Json | undefined): value is {
  [key: string]: Json | undefined;
} {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeCell(value: string) {
  const formulaSafe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { jobId } = await params;
  const job = await getSocietyJob(jobId);
  const errors =
    job.summary && isRecord(job.summary) ? job.summary.errors : undefined;
  const rows = Array.isArray(errors)
    ? errors.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const rowNumber = entry.rowNumber;
        const message = entry.message;
        if (typeof rowNumber !== 'number' || typeof message !== 'string') {
          return [];
        }
        return [[String(rowNumber), message]];
      })
    : [];
  const csv = [
    ['row', 'message'].map(safeCell).join(','),
    ...rows.map((row) => row.map(safeCell).join(',')),
  ].join('\r\n');
  return new Response(`${csv}\r\n`, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="unit-import-${job.id}-errors.csv"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}
