// Download the authorized cash and bank book as CSV or a summary PDF.
import { z } from 'zod';
import { runDownloadRoute } from '@/core/files/download';
import { parseModuleInput } from '@/core/db/validated-rpc';
import { exportExpenseEntries } from '@/core/expense/operations';
import {
  expenseEntriesCsv,
  expenseExportFileName,
  expenseReportPdf,
} from '@/core/expense/documents';

export async function GET(request: Request) {
  return runDownloadRoute(request, '/api/expense/export', async () => {
    const query = new URL(request.url).searchParams;
    const format = parseModuleInput(
      z.enum(['csv', 'pdf']),
      query.get('format'),
    );
    const { rows, report, societyName } = await exportExpenseEntries({
      from: query.get('from'),
      to: query.get('to'),
    });
    const fileName = expenseExportFileName(report.from, report.to, format);
    return format === 'csv'
      ? {
          contentType: 'text/csv; charset=utf-8',
          fileName,
          body: expenseEntriesCsv(rows),
        }
      : {
          contentType: 'application/pdf',
          fileName,
          body: await expenseReportPdf(societyName, report, rows),
        };
  });
}
