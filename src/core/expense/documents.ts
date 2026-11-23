// Render expense book and P41 statement, position and AGM exports from authorized snapshots.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { toCsv } from '../csv/serialize';
import { formatBillingDate, formatBillingPeriod } from '../billing/format';
import { pdfSafeText } from '../billing/documents';
import { rupeesFromPaise } from '../billing/validation';
import type {
  ExpenseAgmDraft,
  ExpenseAudit,
  ExpenseEntry,
  ExpenseFinancialPosition,
  ExpenseMultiYear,
  ExpenseReport,
  ExpenseStatements,
  ExpenseVendorSpend,
  ExpenseFundReconciliation,
} from './validation';
import type { ExpenseBudgetReport as BudgetReport } from './budget-validation';

export function formatSignedRupees(paise: number): string {
  return `${paise < 0 ? '-' : ''}Rs. ${rupeesFromPaise(Math.abs(paise))}`;
}

const INCOME_LABELS: Record<string, string> = {
  billing: 'Maintenance collections',
  donation: 'Donations',
  interest: 'Interest',
  other: 'Other income',
};
export function incomeSourceLabel(source: string): string {
  return INCOME_LABELS[source] ?? source;
}
const SOURCE_LABELS: Record<ExpenseEntry['source'], string> = {
  expense: 'Expense',
  income: 'Income',
  billing_payment: 'Maintenance collection',
  reversal: 'Reversal',
  transfer: 'Transfer',
  amenity_deposit: 'Held amenity deposit',
};
export function entrySourceLabel(source: ExpenseEntry['source']): string {
  return SOURCE_LABELS[source];
}

export function expenseExportFileName(
  from: string,
  to: string,
  format: 'csv' | 'pdf',
): string {
  return `homeish-accounts-${from}-to-${to}.${format}`;
}

export function expenseEntriesCsv(rows: ExpenseEntry[]): string {
  return toCsv(
    [
      'Date',
      'Voucher',
      'Account',
      'Type',
      'Category or income',
      'Counterparty',
      'Reference',
      'Description',
      'In (Rs.)',
      'Out (Rs.)',
      'Reverses entry',
      'Entry',
    ],
    rows.map((row) => [
      row.entry_date,
      row.voucher_no,
      row.account_name,
      entrySourceLabel(row.source),
      row.category_name ??
        (row.source === 'billing_payment'
          ? incomeSourceLabel('billing')
          : row.income_kind
            ? incomeSourceLabel(row.income_kind)
            : ''),
      row.counterparty,
      row.reference,
      row.description,
      row.direction === 'in' ? rupeesFromPaise(row.amount_paise) : '',
      row.direction === 'out' ? rupeesFromPaise(row.amount_paise) : '',
      row.reverses_entry_id,
      row.id,
    ]),
  );
}

export function expenseStatementsCsv(statements: ExpenseStatements): string {
  const rows: string[][] = [
    ['View', 'Period', 'Head', 'Amount (Rs.)'],
    [
      'Receipts and payments',
      statements.from,
      'Opening money held',
      rupeesFromPaise(statements.opening_money_paise),
    ],
    [
      'Receipts and payments',
      statements.from,
      'Opening balances of accounts added',
      rupeesFromPaise(statements.accounts_added_opening_paise),
    ],
    [
      'Receipts and payments',
      `${statements.from} to ${statements.to}`,
      'Receipts',
      rupeesFromPaise(statements.receipts_paise),
    ],
    [
      'Receipts and payments',
      `${statements.from} to ${statements.to}`,
      'Payments',
      rupeesFromPaise(statements.payments_paise),
    ],
    [
      'Held deposit detail (included in cash movements)',
      `${statements.from} to ${statements.to}`,
      'Amenity deposit receipts',
      rupeesFromPaise(statements.held_deposit_receipts_paise),
    ],
    [
      'Held deposit detail (included in cash movements)',
      `${statements.from} to ${statements.to}`,
      'Amenity deposit refunds',
      rupeesFromPaise(statements.held_deposit_refunds_paise),
    ],
    [
      'Non-cash reclassification',
      `${statements.from} to ${statements.to}`,
      'Retained amenity deposit income',
      rupeesFromPaise(statements.retained_deposit_income_paise),
    ],
    [
      'Receipts and payments',
      statements.to,
      'Closing money held',
      rupeesFromPaise(statements.closing_money_paise),
    ],
  ];
  for (const row of statements.receipt_heads)
    rows.push([
      'Receipt head',
      `${statements.from} to ${statements.to}`,
      incomeSourceLabel(row.label),
      rupeesFromPaise(row.amount_paise),
    ]);
  for (const row of statements.payment_heads)
    rows.push([
      'Payment head',
      `${statements.from} to ${statements.to}`,
      row.label,
      rupeesFromPaise(row.amount_paise),
    ]);
  for (const month of statements.months)
    for (const head of month.heads)
      rows.push([
        'Month by head',
        month.month,
        `${head.kind === 'receipt' ? 'Receipt' : 'Payment'}: ${
          head.kind === 'receipt' ? incomeSourceLabel(head.label) : head.label
        }`,
        rupeesFromPaise(head.amount_paise),
      ]);
  return toCsv(rows[0], rows.slice(1));
}

export function expenseVendorSpendCsv(report: ExpenseVendorSpend): string {
  return toCsv(
    [
      'Vendor or payee',
      'Linked vendor',
      'Actual spend (Rs.)',
      'Share (%)',
      'High share',
      'Active months',
      'Average per active month (Rs.)',
      'Approved quotes, not payments (Rs.)',
      'Accounts total (Rs.)',
    ],
    report.rows.map((row) => [
      row.vendor_name ?? row.payee ?? '',
      row.vendor_id ? 'Yes' : 'No',
      rupeesFromPaise(row.total_paise),
      (row.share_bp / 100).toFixed(1),
      row.high_share ? 'Reporting signal' : '',
      row.active_months,
      rupeesFromPaise(row.average_per_active_month_paise),
      row.approved_quote_paise === null
        ? ''
        : rupeesFromPaise(row.approved_quote_paise),
      rupeesFromPaise(report.accounts_expense_paise),
    ]),
  );
}

export function expenseBudgetCsv(report: BudgetReport): string {
  const rows: string[][] = [
    [
      'Section',
      'Month',
      'Head',
      'Original budget (Rs.)',
      'Changes (Rs.)',
      'Current budget (Rs.)',
      'Plan to date (Rs.)',
      'Actual to date (Rs.)',
      'Difference (Rs.)',
      'Burn rate / used (%)',
      'Warning',
      'Projected year-end (Rs.)',
      'Projected overrun (Rs.)',
      'Projection',
      'Money in (Rs.)',
      'Money out (Rs.)',
      'Net (Rs.)',
      'Running net (Rs.)',
      'Estimate',
    ],
  ];
  for (const row of report.summary)
    rows.push([
      'Summary',
      report.as_of,
      row.name,
      rupeesFromPaise(row.original_paise),
      rupeesFromPaise(row.changes_paise),
      rupeesFromPaise(row.current_paise),
      rupeesFromPaise(row.plan_to_date_paise),
      rupeesFromPaise(row.actual_to_date_paise),
      `${row.difference_label}: ${rupeesFromPaise(row.difference_paise)}`,
      row.burn_rate_bp === null
        ? 'Not available'
        : (row.burn_rate_bp / 100).toFixed(2),
      row.warning === 'on_track'
        ? 'On track'
        : row.warning === 'watch'
          ? 'Watch'
          : row.warning === 'over_plan'
            ? 'Over plan'
            : 'Not available',
      row.projected_year_end_paise === null
        ? 'Not available'
        : rupeesFromPaise(row.projected_year_end_paise),
      row.projected_overrun_paise === null
        ? ''
        : rupeesFromPaise(row.projected_overrun_paise),
      row.projection_available
        ? report.as_of === report.to
          ? 'Actual'
          : 'Estimate'
        : 'Not available',
      '',
      '',
      '',
      '',
      '',
    ]);
  for (const month of report.months)
    for (const head of month.heads)
      rows.push([
        'Month by head',
        month.month,
        head.name,
        '',
        '',
        rupeesFromPaise(head.budget_paise),
        '',
        rupeesFromPaise(head.actual_paise),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
  for (const month of report.cash_flow)
    rows.push([
      'Cash flow',
      month.month,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      rupeesFromPaise(month.money_in_paise),
      rupeesFromPaise(month.money_out_paise),
      rupeesFromPaise(month.net_paise),
      rupeesFromPaise(month.running_paise),
      month.is_estimate ? 'Estimate' : '',
    ]);
  return toCsv(rows[0], rows.slice(1));
}

export function expenseFundReconciliationCsv(
  report: ExpenseFundReconciliation,
): string {
  const signedRupees = (paise: number) =>
    `${paise < 0 ? '-' : ''}${rupeesFromPaise(Math.abs(paise))}`;
  const rows: string[][] = [
    [
      'Section',
      'Month',
      'Name',
      'Status',
      'Book balance (Rs.)',
      'Statement closing (Rs.)',
      'Difference (Rs.)',
      'Target (Rs.)',
      'Target date',
      'Target gap (Rs.)',
      'Estimated monthly (Rs.)',
      'Reason or note',
    ],
    [
      'Reconciliation',
      report.month,
      '',
      report.status === 'reconciled' ? 'Reconciled' : 'Needs review',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      report.reasons.join('; '),
    ],
  ];
  for (const account of report.accounts)
    rows.push([
      'Account',
      report.month,
      account.account_name,
      account.status === 'reconciled' ? 'Reconciled' : 'Needs review',
      signedRupees(account.book_balance_paise),
      account.statement_closing_paise === null
        ? ''
        : signedRupees(account.statement_closing_paise),
      account.difference_paise === null
        ? ''
        : signedRupees(account.difference_paise),
      '',
      '',
      '',
      '',
      account.note ?? '',
    ]);
  for (const fund of report.funds)
    rows.push([
      'Fund target',
      report.month,
      fund.fund_name,
      fund.target_status?.replaceAll('_', ' ') ?? '',
      signedRupees(fund.balance_paise),
      '',
      '',
      fund.target_paise === null ? '' : rupeesFromPaise(fund.target_paise),
      fund.target_date ?? '',
      fund.target_gap_paise === null
        ? ''
        : rupeesFromPaise(fund.target_gap_paise),
      fund.estimated_monthly_paise === null
        ? ''
        : rupeesFromPaise(fund.estimated_monthly_paise),
      fund.active ? '' : 'Inactive',
    ]);
  return toCsv(rows[0], rows.slice(1));
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
type Writer = {
  document: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

function line(
  writer: Writer,
  left: string,
  right = '',
  options: { bold?: boolean; size?: number } = {},
) {
  const size = options.size ?? 10;
  if (writer.y - size - 6 < MARGIN) {
    writer.page = writer.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    writer.y = PAGE_HEIGHT - MARGIN;
  }
  const font = options.bold ? writer.bold : writer.font;
  const safeLeft = pdfSafeText(left).slice(0, 90);
  const safeRight = pdfSafeText(right);
  writer.page.drawText(safeLeft, {
    x: MARGIN,
    y: writer.y,
    size,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  if (safeRight)
    writer.page.drawText(safeRight, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(safeRight, size),
      y: writer.y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  writer.y -= size + 6;
}

function section(writer: Writer, title: string) {
  writer.y -= 6;
  paragraph(writer, title, { bold: true, size: 12 });
}

function paragraph(
  writer: Writer,
  text: string,
  options: { bold?: boolean; size?: number } = {},
) {
  const size = options.size ?? 10;
  const font = options.bold ? writer.bold : writer.font;
  const words = pdfSafeText(text).trim().split(/\s+/);
  const width = PAGE_WIDTH - MARGIN * 2;
  let current = '';
  const write = (value: string) => {
    if (writer.y - size - 6 < MARGIN) {
      writer.page = writer.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      writer.y = PAGE_HEIGHT - MARGIN;
    }
    writer.page.drawText(value, {
      x: MARGIN,
      y: writer.y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    writer.y -= size + 6;
  };
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > width) {
      if (current) {
        write(current);
        current = '';
      }
      for (const character of word) {
        const candidate = `${current}${character}`;
        if (font.widthOfTextAtSize(candidate, size) > width && current) {
          write(current);
          current = character;
        } else {
          current = candidate;
        }
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      write(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) write(current);
}

export async function expenseReportPdf(
  societyName: string,
  report: ExpenseReport,
  entries: ExpenseEntry[],
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(pdfSafeText(`${societyName} accounts`));
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  const writer: Writer = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    y: PAGE_HEIGHT - MARGIN,
  };
  line(writer, societyName, '', { bold: true, size: 16 });
  line(
    writer,
    `Income and expenditure, ${formatBillingDate(report.from)} to ${formatBillingDate(report.to)}`,
  );
  section(writer, 'Summary');
  line(writer, 'Income', formatSignedRupees(report.income_paise));
  line(writer, 'Expenses', formatSignedRupees(report.expense_paise));
  line(
    writer,
    'Surplus or deficit',
    formatSignedRupees(report.income_paise - report.expense_paise),
    { bold: true },
  );
  if (report.outstanding_dues_paise !== null)
    line(
      writer,
      'Maintenance dues outstanding',
      formatSignedRupees(report.outstanding_dues_paise),
    );
  section(writer, 'By month');
  for (const month of report.months)
    line(
      writer,
      formatBillingPeriod(month.month),
      `In ${formatSignedRupees(month.income_paise)}   Out ${formatSignedRupees(month.expense_paise)}   Net ${formatSignedRupees(month.net_paise)}   FY to date ${formatSignedRupees(month.cumulative_net_paise)}`,
    );
  section(writer, 'Expenses by category');
  for (const row of report.categories)
    line(writer, row.category, formatSignedRupees(row.expense_paise));
  section(writer, 'Income by source');
  for (const row of report.income_sources)
    line(
      writer,
      incomeSourceLabel(row.source),
      formatSignedRupees(row.income_paise),
    );
  section(writer, `Balances on ${formatBillingDate(report.to)}`);
  for (const row of report.balances)
    line(
      writer,
      `${row.account} (${row.account_type}${row.active ? '' : ', inactive'})`,
      formatSignedRupees(row.balance_paise),
    );
  section(writer, 'Book entries');
  for (const entry of [...entries].reverse())
    line(
      writer,
      `${entry.entry_date}  ${entry.voucher_no}  ${entry.account_name}  ${entrySourceLabel(entry.source)}  ${entry.counterparty}`,
      `${entry.direction === 'in' ? '+' : '-'}${formatSignedRupees(entry.amount_paise)}`,
    );
  if (entries.length === 0) line(writer, 'No entries in this period.');
  return document.save();
}

async function expensePdfWriter(title: string, societyName: string) {
  const document = await PDFDocument.create();
  document.setTitle(pdfSafeText(title));
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  const writer: Writer = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    y: PAGE_HEIGHT - MARGIN,
  };
  line(writer, societyName, '', { bold: true, size: 16 });
  return { document, writer };
}

export async function expenseVendorSpendPdf(
  societyName: string,
  report: ExpenseVendorSpend,
): Promise<Uint8Array> {
  const { document, writer } = await expensePdfWriter(
    `${societyName} vendor spend`,
    societyName,
  );
  line(
    writer,
    `Vendor spend, ${formatBillingDate(report.from)} to ${formatBillingDate(report.to)}`,
  );
  line(
    writer,
    'Accounts expenditure',
    formatSignedRupees(report.accounts_expense_paise),
  );
  line(
    writer,
    'Filtered expenditure',
    formatSignedRupees(report.total_expense_paise),
  );
  paragraph(
    writer,
    'High share means 40% or more in this report. It is a reporting signal, not a finding. Approved quotes are not payments.',
  );
  for (const row of report.rows) {
    section(writer, row.vendor_name ?? row.payee ?? 'Unknown payee');
    line(
      writer,
      row.vendor_id ? 'Linked vendor' : 'Not linked to a vendor',
      formatSignedRupees(row.total_paise),
    );
    line(
      writer,
      `Share ${(row.share_bp / 100).toFixed(1)}%; ${row.active_months} active month(s)`,
      `Average ${formatSignedRupees(row.average_per_active_month_paise)}`,
    );
    if (row.high_share)
      line(writer, 'High share: reporting signal, not a finding.');
    if (row.approved_quote_paise !== null)
      line(
        writer,
        'Approved quotes, not payments',
        formatSignedRupees(row.approved_quote_paise),
      );
    for (const category of row.categories)
      line(
        writer,
        category.category_name,
        formatSignedRupees(category.amount_paise),
      );
  }
  if (report.rows.length === 0)
    line(writer, 'No posted expenditure matches this report.');
  return document.save();
}

export async function expenseBudgetPdf(
  societyName: string,
  report: BudgetReport,
): Promise<Uint8Array> {
  const { document, writer } = await expensePdfWriter(
    `${societyName} budget`,
    societyName,
  );
  line(
    writer,
    `Budget ${report.financial_year}-${report.financial_year + 1}, as of ${formatBillingDate(report.as_of)}`,
  );
  paragraph(
    writer,
    `Forecast method: ${report.forecast_method === 'average_3_months' ? `average of ${report.months_averaged} complete month(s)` : report.forecast_method === 'budget' ? 'budget' : 'none'}.`,
  );
  section(writer, 'Budget against actual');
  for (const row of report.summary) {
    line(
      writer,
      row.name,
      `${row.budgeted ? '' : 'Not budgeted · '}${row.difference_label} ${formatSignedRupees(row.difference_paise)}`,
    );
    paragraph(
      writer,
      `Current ${formatSignedRupees(row.current_paise)}. Plan to date ${formatSignedRupees(row.plan_to_date_paise)}. Actual to date ${formatSignedRupees(row.actual_to_date_paise)}. Burn rate ${row.burn_rate_bp === null ? 'Not available' : `${(row.burn_rate_bp / 100).toFixed(2)}%`}. Warning ${row.warning === 'on_track' ? 'On track' : row.warning === 'watch' ? 'Watch' : row.warning === 'over_plan' ? 'Over plan' : 'Not available'}.`,
    );
    if (row.projected_year_end_paise !== null)
      paragraph(
        writer,
        `Projected year-end ${formatSignedRupees(row.projected_year_end_paise)}. ${report.as_of === report.to ? 'Actual year total.' : 'Estimate.'}${row.projected_overrun_paise === null ? '' : ` Projected overrun ${formatSignedRupees(row.projected_overrun_paise)}.`}`,
      );
  }
  section(writer, 'Monthly cash flow');
  line(
    writer,
    'Opening money held',
    formatSignedRupees(report.opening_money_paise),
  );
  line(
    writer,
    'Opening balances of accounts added',
    formatSignedRupees(report.accounts_added_opening_paise),
  );
  for (const row of report.cash_flow)
    line(
      writer,
      `${formatBillingPeriod(row.month)}${row.is_estimate ? ' · Estimate' : ''}${row.forecast_available ? '' : ' · Not available'}`,
      `In ${formatSignedRupees(row.money_in_paise)} · Out ${formatSignedRupees(row.money_out_paise)} · Running ${formatSignedRupees(row.running_paise)}`,
    );
  return document.save();
}

export async function expenseStatementsPdf(
  societyName: string,
  statements: ExpenseStatements,
): Promise<Uint8Array> {
  const { document, writer } = await expensePdfWriter(
    `${societyName} statements`,
    societyName,
  );
  line(
    writer,
    `Financial statements, ${formatBillingDate(statements.from)} to ${formatBillingDate(statements.to)}`,
  );
  section(writer, 'Receipts and payments');
  line(
    writer,
    'Opening money held',
    formatSignedRupees(statements.opening_money_paise),
  );
  line(
    writer,
    'Opening balances of accounts added',
    formatSignedRupees(statements.accounts_added_opening_paise),
  );
  line(writer, 'Receipts', formatSignedRupees(statements.receipts_paise));
  line(writer, 'Payments', formatSignedRupees(statements.payments_paise));
  line(
    writer,
    'Held amenity deposit receipts (included in receipts)',
    formatSignedRupees(statements.held_deposit_receipts_paise),
  );
  line(
    writer,
    'Held amenity deposit refunds (included in payments)',
    formatSignedRupees(statements.held_deposit_refunds_paise),
  );
  line(
    writer,
    'Retained deposit income (non-cash)',
    formatSignedRupees(statements.retained_deposit_income_paise),
  );
  line(
    writer,
    'Closing money held',
    formatSignedRupees(statements.closing_money_paise),
    { bold: true },
  );
  if (!statements.identity_matches)
    line(writer, 'Attention: the statement totals do not reconcile.', '', {
      bold: true,
    });
  for (let start = 0; start < statements.months.length; start += 6) {
    section(writer, `Month by head — ${start / 6 + 1}`);
    for (const month of statements.months.slice(start, start + 6)) {
      line(writer, formatBillingPeriod(month.month), '', { bold: true });
      for (const head of month.heads)
        line(
          writer,
          `${head.kind === 'receipt' ? 'Receipt' : 'Payment'}: ${
            head.kind === 'receipt' ? incomeSourceLabel(head.label) : head.label
          }`,
          formatSignedRupees(head.amount_paise),
        );
      if (month.heads.length === 0) line(writer, 'No movements in this month.');
    }
  }
  return document.save();
}

export async function expenseFinancialPositionPdf(
  societyName: string,
  position: ExpenseFinancialPosition,
): Promise<Uint8Array> {
  const { document, writer } = await expensePdfWriter(
    `${societyName} financial position`,
    societyName,
  );
  line(writer, 'Financial position summary — not a balance sheet');
  line(writer, `As at ${formatBillingDate(position.as_of)}`);
  section(writer, 'Accounts');
  for (const row of position.accounts)
    line(
      writer,
      `${row.account} (${row.account_type}${row.active ? '' : ', inactive'})`,
      row.balance_paise === null
        ? 'Not available'
        : formatSignedRupees(row.balance_paise),
    );
  line(
    writer,
    'Accounts total',
    formatSignedRupees(position.accounts_total_paise),
    { bold: true },
  );
  if (position.funds_enabled) {
    section(writer, 'Funds');
    for (const fund of position.funds)
      line(writer, fund.fund, formatSignedRupees(fund.balance_paise));
    line(
      writer,
      'Unallocated',
      position.unallocated_paise === null
        ? 'Not available'
        : formatSignedRupees(position.unallocated_paise),
    );
  }
  section(writer, 'Amounts owed');
  line(
    writer,
    'Member dues still owed',
    position.member_dues_paise === null
      ? 'Not available'
      : formatSignedRupees(position.member_dues_paise),
  );
  line(
    writer,
    'Unpaid vendor bills',
    position.vendor_bills_paise === null
      ? 'Not available'
      : formatSignedRupees(position.vendor_bills_paise),
  );
  section(writer, 'Fixed deposits — not added to totals');
  for (const deposit of position.fixed_deposits)
    line(
      writer,
      `${deposit.bank_name}${deposit.reference ? ` (${deposit.reference})` : ''}, matures ${formatBillingDate(deposit.maturity_on)}`,
      deposit.principal_paise === null
        ? 'Not available'
        : formatSignedRupees(deposit.principal_paise),
    );
  if (position.fixed_deposits.length === 0)
    line(writer, 'No fixed deposits recorded.');
  return document.save();
}

export async function expenseAgmDraftPdf(
  societyName: string,
  statements: ExpenseStatements,
  position: ExpenseFinancialPosition,
  comparison: ExpenseMultiYear,
  audit: ExpenseAudit,
  draft: ExpenseAgmDraft,
): Promise<Uint8Array> {
  const { document, writer } = await expensePdfWriter(
    `${societyName} AGM draft`,
    societyName,
  );
  line(writer, 'Draft — not a statutory report', '', { bold: true });
  line(writer, `Financial year starting ${draft.financial_year_start}`);
  if (draft.sections.finances) {
    section(writer, "Year's finances");
    line(writer, 'Receipts', formatSignedRupees(statements.receipts_paise));
    line(writer, 'Payments', formatSignedRupees(statements.payments_paise));
    line(
      writer,
      'Opening / closing money held',
      `${formatSignedRupees(statements.opening_money_paise)} / ${formatSignedRupees(statements.closing_money_paise)}`,
    );
  }
  if (draft.sections.comparison) {
    section(writer, 'Multi-year comparison');
    for (const year of comparison.years)
      line(
        writer,
        `${year.financial_year_start}${year.is_current ? ' (year to date)' : year.part_year ? ' (part year)' : ''}`,
        year.not_available
          ? 'Not available'
          : `${formatSignedRupees(year.income_paise)} income / ${formatSignedRupees(year.expense_paise)} expenditure`,
      );
  }
  if (draft.sections.funds) {
    section(writer, 'Funds');
    for (const fund of position.funds)
      line(writer, fund.fund, formatSignedRupees(fund.balance_paise));
    if (!position.funds_enabled) line(writer, 'Fund tracking is not active.');
  }
  if (draft.sections.audit) {
    section(writer, 'Audit status');
    paragraph(
      writer,
      `Recorded opinion: ${audit.year?.opinion_text ?? 'Not recorded'}`,
    );
    for (const check of audit.checks)
      line(
        writer,
        check.detail,
        check.status === 'pass' ? 'Pass' : 'Attention',
      );
  }
  if (draft.sections.position) {
    section(writer, 'Financial position at year end');
    line(
      writer,
      'Accounts total',
      formatSignedRupees(position.accounts_total_paise),
    );
    line(
      writer,
      'Member dues and vendor bills',
      `${
        position.member_dues_paise === null
          ? 'Not available'
          : formatSignedRupees(position.member_dues_paise)
      } / ${
        position.vendor_bills_paise === null
          ? 'Not available'
          : formatSignedRupees(position.vendor_bills_paise)
      }`,
    );
  }
  if (draft.sections.written)
    for (const written of draft.draft?.written_sections ?? []) {
      section(writer, written.title);
      for (const bodyParagraph of written.body.split(/\n+/))
        paragraph(writer, bodyParagraph);
    }
  return document.save();
}
