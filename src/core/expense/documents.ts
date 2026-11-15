// Render expense book CSV and summary PDF exports from authorized snapshots.
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
import type { ExpenseEntry, ExpenseReport } from './validation';

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
  line(writer, title, '', { bold: true, size: 12 });
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
      `In ${formatSignedRupees(month.income_paise)}   Out ${formatSignedRupees(month.expense_paise)}`,
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
      `${entry.entry_date}  ${entry.account_name}  ${entrySourceLabel(entry.source)}  ${entry.counterparty}`,
      `${entry.direction === 'in' ? '+' : '-'}${formatSignedRupees(entry.amount_paise)}`,
    );
  if (entries.length === 0) line(writer, 'No entries in this period.');
  return document.save();
}
