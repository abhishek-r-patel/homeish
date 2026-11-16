// Render the live analytics dashboard as a formula-safe CSV and a paginated A4 PDF of small tables.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { toCsv } from '../csv/serialize';
import { ValidationError } from '../errors';
import { getAnalyticsMetric } from './catalogue';
import {
  analyticsModuleLabel,
  formatAnalyticsValue,
  formatFinancialYear,
  formatGeneratedAt,
  formatPeriod,
  formatRangeCaption,
  seriesUnit,
  unitLabel,
  type AnalyticsUnit,
} from './format';
import type { AnalyticsDashboard, AnalyticsMetric } from './validation';

export type AnalyticsExportData = {
  societyName: string;
  dashboard: AnalyticsDashboard;
};

export const ANALYTICS_CSV_COLUMNS = [
  'Metric',
  'Module',
  'Period or Label',
  'Series',
  'Value',
  'Unit',
] as const;

export function analyticsExportFileName(
  today: string,
  format: 'csv' | 'pdf',
): string {
  return `analytics-${today}.${format}`;
}

export function analyticsMetricLabel(key: string): string {
  return getAnalyticsMetric(key)?.label ?? key;
}

// CSV money is exported in rupees (not paise) so spreadsheets show familiar amounts.
function csvValue(value: number | null, unit: AnalyticsUnit) {
  if (value === null) return null;
  return unit === 'paise' ? Math.round(value) / 100 : value;
}

type MetricRow = {
  position: string;
  seriesKey: string;
  seriesLabel: string;
  value: number | null;
};

function metricRows(metric: AnalyticsMetric): MetricRow[] {
  if (metric.kind === 'unavailable') return [];
  const rows: MetricRow[] = [];
  const add = (position: string, values: Record<string, number | null>) => {
    for (const series of metric.series) {
      rows.push({
        position,
        seriesKey: series.key,
        seriesLabel: series.label,
        value: values[series.key] ?? null,
      });
    }
  };
  if (metric.kind === 'trend') {
    for (const point of metric.points) add(point.period, point.values);
  } else if (metric.kind === 'breakdown') {
    for (const item of metric.items) add(item.label, item.values);
  } else {
    add('Today', metric.values);
  }
  return rows;
}

export function analyticsExportCsv({ dashboard }: AnalyticsExportData): string {
  const rows: (string | number | null)[][] = [];
  for (const metric of dashboard.metrics) {
    const label = analyticsMetricLabel(metric.key);
    const moduleLabel = analyticsModuleLabel(metric.module);
    if (metric.kind === 'unavailable') {
      rows.push([label, moduleLabel, 'Not available', null, null, null]);
      continue;
    }
    const metricData = metricRows(metric);
    if (metricData.length === 0) {
      rows.push([label, moduleLabel, 'No data', null, null, null]);
      continue;
    }
    for (const row of metricData) {
      const unit = seriesUnit(metric.unit, row.seriesKey);
      rows.push([
        label,
        moduleLabel,
        row.position,
        row.seriesLabel,
        csvValue(row.value, unit),
        unitLabel(unit),
      ]);
    }
  }
  return `\uFEFF${toCsv(ANALYTICS_CSV_COLUMNS, rows)}`;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_GAP = 5;
const ROW_HEIGHT = 15;
const TABLE_SIZE = 9;

type PdfWriter = {
  document: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
};

function assertSupportedText(texts: readonly string[], font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  for (const text of texts) {
    if (
      [...text].some((character) => !supported.has(character.codePointAt(0)!))
    ) {
      throw new ValidationError({
        export:
          'This report contains text the PDF format cannot display. Use the CSV export instead.',
      });
    }
  }
}

function nextPage(writer: PdfWriter) {
  writer.page = writer.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(writer: PdfWriter, height: number) {
  if (writer.y - height < MARGIN) {
    nextPage(writer);
    return true;
  }
  return false;
}

function fit(text: string, font: PDFFont, size: number, width: number) {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut && font.widthOfTextAtSize(`${cut}…`, size) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.map((value) => fit(value, font, size, width));
}

function writeText(
  writer: PdfWriter,
  text: string,
  options: { bold?: boolean; size?: number; muted?: boolean } = {},
) {
  const size = options.size ?? 10;
  const font = options.bold ? writer.bold : writer.regular;
  for (const line of wrap(text, font, size, CONTENT_WIDTH)) {
    ensureSpace(writer, size + LINE_GAP);
    writer.page.drawText(line, {
      x: MARGIN,
      y: writer.y,
      size,
      font,
      color: options.muted ? rgb(0.35, 0.35, 0.35) : rgb(0.1, 0.1, 0.1),
    });
    writer.y -= size + LINE_GAP;
  }
}

function writeRow(
  writer: PdfWriter,
  cells: readonly string[],
  widths: readonly number[],
  bold: boolean,
) {
  const font = bold ? writer.bold : writer.regular;
  let x = MARGIN;
  cells.forEach((cell, index) => {
    const width = widths[index] ?? 0;
    const text = fit(cell, font, TABLE_SIZE, width - 6);
    const textWidth = font.widthOfTextAtSize(text, TABLE_SIZE);
    // Numbers are right-aligned; the first column holds the period or label.
    const offset = index === 0 ? 0 : width - 6 - textWidth;
    writer.page.drawText(text, {
      x: x + offset,
      y: writer.y,
      size: TABLE_SIZE,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    x += width;
  });
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y - 4 },
    end: { x: MARGIN + CONTENT_WIDTH, y: writer.y - 4 },
    thickness: 0.4,
    color: rgb(0.8, 0.8, 0.8),
  });
  writer.y -= ROW_HEIGHT;
}

function writeTable(
  writer: PdfWriter,
  header: readonly string[],
  rows: readonly (readonly string[])[],
) {
  const columns = header.length;
  const first = columns > 4 ? 140 : 200;
  const rest = columns > 1 ? (CONTENT_WIDTH - first) / (columns - 1) : 0;
  const widths = header.map((_, index) => (index === 0 ? first : rest));
  ensureSpace(writer, ROW_HEIGHT * 2);
  writeRow(writer, header, widths, true);
  for (const row of rows) {
    if (ensureSpace(writer, ROW_HEIGHT)) writeRow(writer, header, widths, true);
    writeRow(writer, row, widths, false);
  }
}

function formatCell(
  value: number | null | undefined,
  unit: AnalyticsUnit,
  seriesKey: string,
) {
  return formatAnalyticsValue(value ?? null, seriesUnit(unit, seriesKey), {
    plain: true,
  });
}

function writeMetric(writer: PdfWriter, metric: AnalyticsMetric) {
  writer.y -= LINE_GAP * 2;
  ensureSpace(writer, 60);
  writeText(writer, analyticsMetricLabel(metric.key), { bold: true, size: 12 });
  writeText(
    writer,
    `${analyticsModuleLabel(metric.module)} · ${formatRangeCaption(metric)}`,
    { size: 9, muted: true },
  );
  if (metric.kind === 'unavailable') {
    writeText(writer, 'This figure is not available right now.');
    return;
  }
  const seriesLabels = metric.series.map((series) => series.label);
  if (metric.kind === 'stat') {
    writeTable(
      writer,
      ['Figure', 'Value'],
      metric.series.map((series) => [
        series.label,
        formatCell(metric.values[series.key], metric.unit, series.key),
      ]),
    );
    return;
  }
  if (metric.kind === 'trend') {
    if (metric.points.length === 0) {
      writeText(writer, 'No data for this period.');
      return;
    }
    writeTable(
      writer,
      ['Month', ...seriesLabels],
      metric.points.map((point) => [
        formatPeriod(point.period),
        ...metric.series.map((series) =>
          formatCell(point.values[series.key], metric.unit, series.key),
        ),
      ]),
    );
    return;
  }
  if (metric.items.length === 0) {
    writeText(writer, 'No data for this period.');
    return;
  }
  writeTable(
    writer,
    ['Label', ...seriesLabels],
    metric.items.map((item) => [
      item.label,
      ...metric.series.map((series) =>
        formatCell(item.values[series.key], metric.unit, series.key),
      ),
    ]),
  );
}

export function analyticsRangeSummary(dashboard: AnalyticsDashboard): string {
  const months = `Last ${dashboard.months} months (${formatPeriod(dashboard.from.slice(0, 7))} – ${formatPeriod(dashboard.today.slice(0, 7))})`;
  return dashboard.moneyRange === 'fy'
    ? `${months}. Money figures: ${formatFinancialYear(dashboard.fyFrom)} to date.`
    : `${months}. Money figures use the same months.`;
}

export async function analyticsExportPdf({
  societyName,
  dashboard,
}: AnalyticsExportData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Committee analytics - ${societyName}`);
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  assertSupportedText(
    [
      societyName,
      ...dashboard.metrics.flatMap((metric) =>
        metric.kind === 'unavailable'
          ? []
          : [
              ...metric.series.map((series) => series.label),
              ...(metric.kind === 'breakdown'
                ? metric.items.map((item) => item.label)
                : []),
            ],
      ),
    ],
    regular,
  );

  const writer: PdfWriter = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  };
  writeText(writer, 'Committee analytics', { bold: true, size: 16 });
  writeText(writer, societyName, { bold: true, size: 13 });
  writeText(writer, analyticsRangeSummary(dashboard));
  writeText(
    writer,
    `Generated ${formatGeneratedAt(dashboard.generatedAt, dashboard.timezone)} (${dashboard.timezone}). Totals only; no names of people or units.`,
    { size: 9, muted: true },
  );
  if (dashboard.metrics.length === 0) {
    writer.y -= LINE_GAP;
    writeText(writer, 'No analytics are selected for this society.');
  }
  for (const metric of dashboard.metrics) writeMetric(writer, metric);
  return document.save();
}
