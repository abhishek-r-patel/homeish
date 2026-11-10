// Render billing PDFs and CSV exports from already-authorized database snapshots.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import {
  formatBillingDate,
  formatBillingPeriod,
  formatBillingTimestamp,
  formatRupees,
} from './format';
import {
  type BillingBillDetails,
  type BillingReceipt,
  type ExportJob,
} from './validation';

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(
  columns: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return `${[columns, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')}\r\n`;
}

export function exportFileName(job: ExportJob): string {
  return `homeish-${job.summary.report.replaceAll('_', '-')}-${job.summary.from}-to-${job.summary.to}.csv`;
}

// Standard PDF fonts only cover WinAnsi, so keep text printable ASCII.
export function pdfSafeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

type Writer = {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

function text(
  writer: Writer,
  value: string,
  options: { x?: number; size?: number; bold?: boolean; right?: boolean } = {},
) {
  const size = options.size ?? 11;
  const font = options.bold ? writer.bold : writer.font;
  const safe = pdfSafeText(value);
  const width = font.widthOfTextAtSize(safe, size);
  const x = options.right
    ? (options.x ?? PAGE_WIDTH - MARGIN) - width
    : (options.x ?? MARGIN);
  writer.page.drawText(safe, {
    x,
    y: writer.y,
    size,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
}

function wrap(writer: Writer, value: string, size: number, maxWidth: number) {
  const words = pdfSafeText(value).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (writer.font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function rule(writer: Writer) {
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y },
    end: { x: PAGE_WIDTH - MARGIN, y: writer.y },
    thickness: 0.75,
    color: rgb(0.75, 0.75, 0.75),
  });
}

async function startDocument(title: string) {
  const document = await PDFDocument.create();
  document.setTitle(pdfSafeText(title));
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  const writer: Writer = {
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    y: PAGE_HEIGHT - MARGIN,
  };
  return { document, writer };
}

function ensureSpace(document: PDFDocument, writer: Writer, needed: number) {
  if (writer.y - needed >= MARGIN) return;
  writer.page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.y = PAGE_HEIGHT - MARGIN;
}

function header(
  writer: Writer,
  societyName: string,
  societyAddress: string,
  heading: string,
) {
  text(writer, societyName, { size: 16, bold: true });
  writer.y -= 16;
  for (const line of wrap(
    writer,
    societyAddress,
    10,
    PAGE_WIDTH - 2 * MARGIN,
  )) {
    text(writer, line, { size: 10 });
    writer.y -= 13;
  }
  writer.y -= 10;
  text(writer, heading, { size: 14, bold: true });
  writer.y -= 12;
  rule(writer);
  writer.y -= 20;
}

function field(writer: Writer, label: string, value: string) {
  text(writer, label, { bold: true });
  text(writer, value, { x: MARGIN + 140 });
  writer.y -= 18;
}

function amountTable(
  document: PDFDocument,
  writer: Writer,
  heading: string,
  rows: { label: string; amount: number }[],
  totalLabel: string,
  total: number,
) {
  ensureSpace(document, writer, 60);
  text(writer, heading, { bold: true });
  text(writer, 'Amount', { bold: true, right: true });
  writer.y -= 8;
  rule(writer);
  writer.y -= 16;
  for (const row of rows) {
    const lines = wrap(writer, row.label, 11, PAGE_WIDTH - 2 * MARGIN - 140);
    ensureSpace(document, writer, lines.length * 14 + 4);
    text(writer, formatRupees(row.amount), { right: true });
    for (const line of lines) {
      text(writer, line);
      writer.y -= 14;
    }
    writer.y -= 4;
  }
  ensureSpace(document, writer, 30);
  rule(writer);
  writer.y -= 16;
  text(writer, totalLabel, { bold: true });
  text(writer, formatRupees(total), { bold: true, right: true });
  writer.y -= 24;
}

function footer(writer: Writer, note: string) {
  writer.y = MARGIN;
  text(writer, note, { size: 9 });
}

const MODE_LABELS = {
  upi: 'UPI',
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank transfer',
} as const;

export async function renderReceiptPdf(
  receipt: BillingReceipt,
): Promise<Uint8Array> {
  const { document, writer } = await startDocument(
    `Receipt ${receipt.receipt_no}`,
  );
  header(
    writer,
    receipt.society_name,
    receipt.society_address,
    'Payment Receipt',
  );
  field(writer, 'Receipt number', receipt.receipt_no);
  field(writer, receipt.unit_label, receipt.unit_number);
  if (receipt.payer_name) field(writer, 'Paid by', receipt.payer_name);
  field(writer, 'Paid on', formatBillingDate(receipt.paid_on));
  field(writer, 'Mode', MODE_LABELS[receipt.mode]);
  if (receipt.reference) field(writer, 'Reference', receipt.reference);
  field(
    writer,
    'Confirmed on',
    formatBillingTimestamp(receipt.confirmed_at, receipt.timezone),
  );
  if (receipt.confirmed_by_name)
    field(writer, 'Confirmed by', receipt.confirmed_by_name);
  writer.y -= 10;
  const allocated = receipt.allocations.reduce(
    (sum, item) => sum + item.amount_paise,
    0,
  );
  const rows = receipt.allocations.map((item) => ({
    label: `${item.title} (${formatBillingPeriod(item.period_start)}, due ${formatBillingDate(item.due_date)})`,
    amount: item.amount_paise,
  }));
  if (receipt.amount_paise > allocated) {
    rows.push({
      label: 'Advance credit',
      amount: receipt.amount_paise - allocated,
    });
  }
  amountTable(
    document,
    writer,
    'Applied to',
    rows,
    'Total received',
    receipt.amount_paise,
  );
  footer(writer, 'This is a computer-generated receipt from Homeish.');
  return document.save();
}

const BILL_STATUS_LABELS = {
  due: 'Due',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  waived: 'Waived',
  cancelled: 'Cancelled',
} as const;

export async function renderBillPdf(
  bill: BillingBillDetails,
): Promise<Uint8Array> {
  const { document, writer } = await startDocument(bill.title);
  header(writer, bill.society_name, bill.society_address, bill.title);
  field(writer, bill.unit_label, bill.unit_number);
  field(writer, 'Period', formatBillingPeriod(bill.period_start));
  field(writer, 'Due date', formatBillingDate(bill.due_date));
  field(writer, 'Status', BILL_STATUS_LABELS[bill.status]);
  writer.y -= 10;
  amountTable(
    document,
    writer,
    'Description',
    bill.lines.map((line) => ({
      label: line.description,
      amount: line.amount_paise,
    })),
    'Total',
    bill.total_paise,
  );
  if (bill.paid_paise > 0) field(writer, 'Paid', formatRupees(bill.paid_paise));
  if (bill.waived_paise > 0)
    field(writer, 'Waived', formatRupees(bill.waived_paise));
  field(writer, 'Outstanding', formatRupees(bill.outstanding_paise));
  footer(writer, 'This is a computer-generated bill from Homeish.');
  return document.save();
}
