// Download inventory reports only after checking society, module and role access.
import { runDownloadRoute } from '@/core/files/download';
import { getInventoryReport } from '@/core/housekeeping/operations';
import {
  inventoryReportCsv,
  inventoryReportKindSchema,
} from '@/core/housekeeping/reports';
import { ValidationError } from '@/core/errors';

export async function GET(request: Request) {
  return runDownloadRoute(request, '/api/housekeeping/export', async () => {
    const query = new URL(request.url).searchParams;
    const type = inventoryReportKindSchema.safeParse(query.get('type'));
    if (!type.success)
      throw new ValidationError({ type: 'Choose a valid inventory report.' });
    const from = query.get('from');
    const to = query.get('to');
    const report = await getInventoryReport({
      from,
      to,
      itemId: query.get('itemId'),
    });
    return {
      body: `\uFEFF${inventoryReportCsv(type.data, report.items, report.transactions)}`,
      contentType: 'text/csv; charset=utf-8',
      fileName: `homeish-inventory-${type.data}-${from}-to-${to}.csv`,
    };
  });
}
