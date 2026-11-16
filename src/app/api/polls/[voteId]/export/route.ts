// Download a completed poll report after server-side role and state checks.
import { z } from 'zod';
import { parseModuleInput } from '@/core/db/validated-rpc';
import { runDownloadRoute } from '@/core/files/download';
import {
  pollExportCsv,
  pollExportFileName,
  pollExportPdf,
} from '@/core/poll/exports';
import { getPollExport } from '@/core/poll/operations';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ voteId: string }> },
) {
  return runDownloadRoute(request, '/api/polls/[voteId]/export', async () => {
    const { voteId } = await params;
    const format = parseModuleInput(
      z.enum(['csv', 'pdf']),
      new URL(request.url).searchParams.get('format'),
    );
    const data = await getPollExport(voteId);
    return format === 'csv'
      ? {
          contentType: 'text/csv; charset=utf-8',
          fileName: pollExportFileName(voteId, 'csv'),
          body: pollExportCsv(data),
        }
      : {
          contentType: 'application/pdf',
          fileName: pollExportFileName(voteId, 'pdf'),
          body: await pollExportPdf(data),
        };
  });
}
