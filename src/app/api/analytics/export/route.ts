// Download the live analytics dashboard as CSV or PDF; administrators only, audited before the file is built.
import { parseModuleInput } from '@/core/db/validated-rpc';
import { runDownloadRoute } from '@/core/files/download';
import {
  analyticsExportCsv,
  analyticsExportFileName,
  analyticsExportPdf,
} from '@/core/analytics/export';
import { getAnalyticsExport } from '@/core/analytics/operations';
import {
  analyticsExportInputSchema,
  parseAnalyticsExportInput,
} from '@/core/analytics/validation';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return runDownloadRoute(
    request,
    '/api/analytics/export',
    async (requestId) => {
      const input = parseModuleInput(
        analyticsExportInputSchema,
        parseAnalyticsExportInput(new URL(request.url).searchParams),
      );
      const data = await getAnalyticsExport(input, requestId);
      const fileName = analyticsExportFileName(
        data.dashboard.today,
        data.format,
      );
      return data.format === 'csv'
        ? {
            contentType: 'text/csv; charset=utf-8',
            fileName,
            body: analyticsExportCsv(data),
          }
        : {
            contentType: 'application/pdf',
            fileName,
            body: await analyticsExportPdf(data),
          };
    },
  );
}
