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
} from './validation';

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
