// Download the admin dues follow-up list (P43.3) as CSV; administrators only, every export audited with its row count.
import { runDownloadRoute } from '@/core/files/download';
import { getBillingDuesFollowUp } from '@/core/billing/collection-operations';
import { billingDuesFollowUpCsv } from '@/core/billing/collection-validation';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return runDownloadRoute(
    request,
    '/api/billing/dues-follow-up',
    async (requestId) => {
      const report = await getBillingDuesFollowUp('export', requestId);
      return {
        contentType: 'text/csv; charset=utf-8',
        fileName: `dues-follow-up-${report.today}.csv`,
        body: billingDuesFollowUpCsv(report.rows),
      };
    },
  );
}
