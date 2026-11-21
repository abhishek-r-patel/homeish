// Download the monthly collection report (P43.2) as CSV; administrators only, audited before the file is built.
import { parseModuleInput } from '@/core/db/validated-rpc';
import { runDownloadRoute } from '@/core/files/download';
import { exportBillingMonthlyCollection } from '@/core/billing/collection-operations';
import {
  billingMonthlyCollectionCsv,
  billingMonthlyCollectionExportInputSchema,
} from '@/core/billing/collection-validation';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return runDownloadRoute(
    request,
    '/api/billing/monthly-collection',
    async (requestId) => {
      const input = parseModuleInput(
        billingMonthlyCollectionExportInputSchema,
        { period: new URL(request.url).searchParams.get('period') },
      );
      const report = await exportBillingMonthlyCollection(input, requestId);
      return {
        contentType: 'text/csv; charset=utf-8',
        fileName: `monthly-collection-${report.range.from.slice(0, 7)}-to-${report.range.toMonth.slice(0, 7)}.csv`,
        body: billingMonthlyCollectionCsv(report.rows),
      };
    },
  );
}
