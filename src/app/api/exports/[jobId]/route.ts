// Download a completed report export as formula-safe CSV.
import { getExportJob } from '../../../../core/billing/operations';
import { exportFileName, toCsv } from '../../../../core/billing/documents';
import { runDownloadRoute } from '../../../../core/files/download';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  return runDownloadRoute(request, '/api/exports', async () => {
    const { jobId } = await params;
    const job = await getExportJob(jobId);
    return {
      body: `\uFEFF${toCsv(job.summary.columns, job.summary.rows)}`,
      contentType: 'text/csv; charset=utf-8',
      fileName: exportFileName(job),
    };
  });
}
