// Download the authorized cash and bank book as CSV or a summary PDF.
import { z } from 'zod';
import { runDownloadRoute } from '@/core/files/download';
import { parseModuleInput } from '@/core/db/validated-rpc';
import {
  exportExpenseAgmDraft,
  exportExpenseEntries,
  exportExpenseFinancialPosition,
  exportExpenseFundReconciliation,
  exportExpenseStatements,
  exportExpenseVendorSpend,
} from '@/core/expense/operations';
import { exportExpenseBudget } from '@/core/expense/budget-operations';
import {
  expenseAgmDraftPdf,
  expenseBudgetCsv,
  expenseBudgetPdf,
  expenseEntriesCsv,
  expenseExportFileName,
  expenseFinancialPositionPdf,
  expenseFundReconciliationCsv,
  expenseReportPdf,
  expenseStatementsCsv,
  expenseStatementsPdf,
  expenseVendorSpendCsv,
  expenseVendorSpendPdf,
} from '@/core/expense/documents';

export async function GET(request: Request) {
  return runDownloadRoute(request, '/api/expense/export', async () => {
    const query = new URL(request.url).searchParams;
    const format = parseModuleInput(
      z.enum(['csv', 'pdf']),
      query.get('format'),
    );
    const reportKind = parseModuleInput(
      z.enum([
        'entries',
        'statements',
        'position',
        'agm',
        'vendor_spend',
        'budget',
        'fund_reconciliation',
      ]),
      query.get('report') ?? 'entries',
    );
    if (reportKind === 'statements') {
      const { statements, societyName } = await exportExpenseStatements({
        from: query.get('from'),
        to: query.get('to'),
      });
      return {
        contentType:
          format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
        fileName: `homeish-statements-${statements.from}-to-${statements.to}.${format}`,
        body:
          format === 'csv'
            ? expenseStatementsCsv(statements)
            : await expenseStatementsPdf(societyName, statements),
      };
    }
    if (reportKind === 'position') {
      parseModuleInput(z.literal('pdf'), format);
      const { position, societyName } = await exportExpenseFinancialPosition(
        query.get('asOf'),
      );
      return {
        contentType: 'application/pdf',
        fileName: `homeish-financial-position-${position.as_of}.pdf`,
        body: await expenseFinancialPositionPdf(societyName, position),
      };
    }
    if (reportKind === 'agm') {
      parseModuleInput(z.literal('pdf'), format);
      const exported = await exportExpenseAgmDraft(
        query.get('financialYearStart'),
      );
      return {
        contentType: 'application/pdf',
        fileName: `homeish-agm-draft-${exported.draft.financial_year_start}.pdf`,
        body: await expenseAgmDraftPdf(
          exported.societyName,
          exported.statements,
          exported.position,
          exported.comparison,
          exported.audit,
          exported.draft,
        ),
      };
    }
    if (reportKind === 'vendor_spend') {
      const { report, societyName } = await exportExpenseVendorSpend({
        from: query.get('from'),
        to: query.get('to'),
        categoryId: query.get('categoryId'),
        group: query.get('group'),
        costNature: query.get('costNature'),
      });
      return {
        contentType:
          format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
        fileName: `homeish-vendor-spend-${report.from}-to-${report.to}.${format}`,
        body:
          format === 'csv'
            ? expenseVendorSpendCsv(report)
            : await expenseVendorSpendPdf(societyName, report),
      };
    }
    if (reportKind === 'budget') {
      const { report, societyName } = await exportExpenseBudget({
        financialYear: query.get('financialYear'),
        asOf: query.get('asOf'),
      });
      return {
        contentType:
          format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
        fileName: `homeish-budget-${report.financial_year}-${report.as_of}.${format}`,
        body:
          format === 'csv'
            ? expenseBudgetCsv(report)
            : await expenseBudgetPdf(societyName, report),
      };
    }
    if (reportKind === 'fund_reconciliation') {
      parseModuleInput(z.literal('csv'), format);
      const report = await exportExpenseFundReconciliation(query.get('month'));
      return {
        contentType: 'text/csv; charset=utf-8',
        fileName: `homeish-fund-reconciliation-${report.month}.csv`,
        body: expenseFundReconciliationCsv(report),
      };
    }
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
