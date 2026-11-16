// Verify analytics CSV rows are spreadsheet-safe and the PDF is a readable, paginated report.
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  ANALYTICS_CSV_COLUMNS,
  analyticsExportCsv,
  analyticsExportFileName,
  analyticsExportPdf,
} from '../../src/core/analytics/export';
import type {
  AnalyticsDashboard,
  AnalyticsMetric,
} from '../../src/core/analytics/validation';

const base = { from: '2025-12-01', to: '2026-11-16', range: 'months' as const };

function dashboard(metrics: AnalyticsMetric[]): AnalyticsDashboard {
  return {
    today: '2026-11-16',
    timezone: 'Asia/Kolkata',
    months: 12,
    moneyRange: 'months',
    from: '2025-12-01',
    fyFrom: '2026-04-01',
    generatedAt: '2026-11-16T09:30:00+05:30',
    metrics,
  };
}

const collection: AnalyticsMetric = {
  ...base,
  key: 'billing.collection_trend',
  module: 'billing',
  kind: 'trend',
  unit: 'paise',
  series: [
    { key: 'billed', label: 'Billed' },
    { key: 'collected', label: 'Collected' },
  ],
  points: [
    { period: '2026-10', values: { billed: 12_345_650, collected: null } },
  ],
};
const ratings: AnalyticsMetric = {
  ...base,
  key: 'home_services.ratings',
  module: 'home_services',
  kind: 'breakdown',
  unit: 'rating',
  series: [
    { key: 'average', label: 'Average rating' },
    { key: 'ratings', label: 'Ratings' },
  ],
  items: [{ label: '=SUM(1)', values: { average: 4.3, ratings: 12 } }],
};

function csvLines(text: string) {
  expect(text.startsWith('\uFEFF')).toBe(true);
  return text.slice(1).trim().split(/\r?\n/);
}

describe('analytics CSV export', () => {
  it('writes one row per metric, position and series with money in rupees', () => {
    const lines = csvLines(
      analyticsExportCsv({
        societyName: 'Synthetic Society',
        dashboard: dashboard([collection]),
      }),
    );
    expect(lines[0]).toBe(ANALYTICS_CSV_COLUMNS.join(','));
    expect(lines.slice(1)).toEqual([
      'Collection trend,Billing,2026-10,Billed,123456.5,rupees',
      'Collection trend,Billing,2026-10,Collected,,rupees',
    ]);
  });

  it('neutralises formula-like labels and keeps rating counts as counts', () => {
    const lines = csvLines(
      analyticsExportCsv({
        societyName: 'Synthetic Society',
        dashboard: dashboard([ratings]),
      }),
    );
    expect(lines[1]).toContain(`'=SUM(1)`);
    expect(lines[1]).not.toMatch(/,=SUM/);
    expect(lines[1]).toMatch(/Average rating,4\.3,rating out of 5$/);
    expect(lines[2]).toMatch(/Ratings,12,count$/);
  });

  it('marks unavailable and empty metrics instead of dropping them', () => {
    const lines = csvLines(
      analyticsExportCsv({
        societyName: 'Synthetic Society',
        dashboard: dashboard([
          {
            ...base,
            key: 'notice.read_rate',
            module: 'notice',
            kind: 'unavailable',
          },
          {
            ...collection,
            key: 'visitor.trend',
            module: 'visitor',
            points: [],
          },
        ]),
      }),
    );
    expect(lines.slice(1)).toEqual([
      expect.stringMatching(/,Notices,Not available,,,$/),
      expect.stringMatching(/,Visitors,No data,,,$/),
    ]);
  });

  it('names files by the society date', () => {
    expect(analyticsExportFileName('2026-11-16', 'pdf')).toBe(
      'analytics-2026-11-16.pdf',
    );
  });
});

describe('analytics PDF export', () => {
  it('produces a multi-page report for a long dashboard', async () => {
    const points = Array.from({ length: 12 }, (_, index) => ({
      period: `2026-${String(index + 1).padStart(2, '0')}`,
      values: { billed: index * 100_000, collected: index * 90_000 },
    }));
    const metrics = Array.from({ length: 8 }, () => ({
      ...collection,
      points,
    })) as AnalyticsMetric[];
    const bytes = await analyticsExportPdf({
      societyName: 'Synthetic Society',
      dashboard: dashboard([...metrics, ratings]),
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(document.getTitle()).toBe('Committee analytics - Synthetic Society');
  });

  it('asks for CSV when a label cannot be shown in the PDF font', async () => {
    await expect(
      analyticsExportPdf({
        societyName: 'Synthetic Society',
        dashboard: dashboard([
          {
            ...ratings,
            items: [{ label: 'प्लंबिंग', values: { average: 4, ratings: 2 } }],
          },
        ]),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
