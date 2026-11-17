// Verify analytics figure formatting and the dashboard, settings and range contracts.
import { describe, expect, it } from 'vitest';
import {
  formatAnalyticsValue,
  formatFinancialYear,
  formatGeneratedAt,
  formatPaise,
  formatPeriod,
  formatRangeCaption,
  seriesUnit,
} from '../../src/core/analytics/format';
import {
  analyticsExportInputSchema,
  analyticsSettingsInputSchema,
  parseAnalyticsDashboard,
  parseAnalyticsExportInput,
  readAnalyticsRange,
} from '../../src/core/analytics/validation';

describe('analytics formatting', () => {
  it('formats money in whole rupees with Indian grouping', () => {
    expect(formatPaise(12_345_600)).toBe('₹1,23,456');
    expect(formatPaise(-50_000)).toBe('-₹500');
    expect(formatPaise(12_345_600, { plain: true })).toBe('Rs 1,23,456');
    expect(formatPaise(null)).toBe('—');
  });

  it('formats each unit and shows a dash for missing values', () => {
    expect(formatAnalyticsValue(72.5, 'percent')).toBe('72.5%');
    expect(formatAnalyticsValue(3.24, 'days')).toBe('3.2 days');
    expect(formatAnalyticsValue(1, 'days')).toBe('1 day');
    expect(formatAnalyticsValue(14, 'minutes')).toBe('14 min');
    expect(formatAnalyticsValue(4.32, 'rating')).toBe('4.3 ★');
    expect(formatAnalyticsValue(4.32, 'rating', { plain: true })).toBe(
      '4.3 / 5',
    );
    expect(formatAnalyticsValue(1234.567, 'quantity')).toBe('1,234.57');
    expect(formatAnalyticsValue(123456, 'count')).toBe('1,23,456');
    expect(formatAnalyticsValue(null, 'count')).toBe('—');
  });

  it('treats the rating count series as a count', () => {
    expect(seriesUnit('rating', 'average')).toBe('rating');
    expect(seriesUnit('rating', 'ratings')).toBe('count');
    expect(seriesUnit('paise', 'billed')).toBe('paise');
  });

  it('labels months, financial years and ranges', () => {
    expect(formatPeriod('2026-04')).toBe('Apr 2026');
    expect(formatFinancialYear('2026-04-01')).toBe('FY 2026–27');
    expect(formatFinancialYear('2027-03-31')).toBe('FY 2026–27');
    expect(
      formatRangeCaption({
        kind: 'trend',
        from: '2025-12-01',
        to: '2026-11-16',
        range: 'months',
      }),
    ).toBe('Dec 2025 – Nov 2026');
    expect(
      formatRangeCaption({
        kind: 'trend',
        from: '2026-04-01',
        to: '2026-11-16',
        range: 'fy',
      }),
    ).toBe('FY 2026–27 to date (1 Apr 2026 – 16 Nov 2026)');
    expect(
      formatRangeCaption({
        kind: 'stat',
        from: '2026-11-16',
        to: '2026-11-16',
        range: 'months',
      }),
    ).toBe('Today, 16 Nov 2026');
  });

  it('shows generated times in the society time zone with plain spaces', () => {
    const text = formatGeneratedAt('2026-11-16T04:00:00Z');
    expect(text).toContain('9:30');
    expect(text).not.toMatch(/[\u00a0\u202f]/);
  });

  it('localizes screen units and dates while exports keep their English defaults', () => {
    expect(formatAnalyticsValue(3.24, 'days', { locale: 'hi' })).toBe(
      '3.2 दिन',
    );
    expect(formatAnalyticsValue(14, 'minutes', { locale: 'hi' })).toBe(
      '14 मिनट',
    );
    expect(formatPeriod('2026-03', 'hi')).toContain('मार्च');
    expect(formatFinancialYear('2026-04-01', 'hi')).toBe('वित्त वर्ष 2026–27');
    const range = {
      kind: 'stat',
      from: '2026-03-05',
      to: '2026-03-05',
      range: 'months',
    } as const;
    expect(formatRangeCaption(range, 'hi')).toMatch(/आज, .*मार्च.*2026/);
    expect(formatRangeCaption(range)).toBe('Today, 5 Mar 2026');
    expect(formatGeneratedAt('2026-03-05T18:30:00Z', 'UTC', 'hi')).toMatch(
      /मार्च.*6:30\s*pm/i,
    );
  });
});

const envelope = {
  today: '2026-11-16',
  timezone: 'Asia/Kolkata',
  months: 12,
  moneyRange: 'months',
  from: '2025-12-01',
  fyFrom: '2026-04-01',
  generatedAt: '2026-11-16T09:30:00+05:30',
};
const trend = {
  key: 'visitor.trend',
  module: 'visitor',
  from: '2025-12-01',
  to: '2026-11-16',
  range: 'months',
  kind: 'trend',
  unit: 'count',
  series: [{ key: 'entries', label: 'Visitor entries' }],
  points: [{ period: '2026-11', values: { entries: null } }],
};

describe('analytics dashboard contract', () => {
  it('parses trends with missing values', () => {
    const dashboard = parseAnalyticsDashboard({
      ...envelope,
      metrics: [trend],
    });
    expect(dashboard.metrics).toEqual([trend]);
  });

  it('marks a malformed metric as unavailable instead of failing the page', () => {
    const invalid: (string | null)[] = [];
    const dashboard = parseAnalyticsDashboard(
      {
        ...envelope,
        metrics: [
          trend,
          { ...trend, key: 'delivery.trend', points: 'oops' },
          { key: 'not.a.metric' },
        ],
      },
      (key) => invalid.push(key),
    );
    expect(dashboard.metrics.map((metric) => metric.kind)).toEqual([
      'trend',
      'unavailable',
    ]);
    expect(invalid).toEqual(['delivery.trend', null]);
  });

  it('rejects an invalid envelope', () => {
    expect(() =>
      parseAnalyticsDashboard({ ...envelope, months: 5, metrics: [] }),
    ).toThrow();
  });
});

describe('analytics inputs', () => {
  it('accepts unique catalogue keys with a version', () => {
    expect(
      analyticsSettingsInputSchema.safeParse({
        metrics: ['visitor.trend', 'billing.dues_ageing'],
        expectedVersion: 0,
      }).success,
    ).toBe(true);
    expect(
      analyticsSettingsInputSchema.safeParse({
        metrics: [],
        expectedVersion: 2,
      }).success,
    ).toBe(true);
  });

  it('rejects duplicate, unknown or extra settings input', () => {
    for (const input of [
      { metrics: ['visitor.trend', 'visitor.trend'], expectedVersion: 0 },
      { metrics: ['visitor.unknown'], expectedVersion: 0 },
      { metrics: [], expectedVersion: -1 },
      { metrics: [], expectedVersion: 0, societyId: 'x' },
    ]) {
      expect(analyticsSettingsInputSchema.safeParse(input).success).toBe(false);
    }
  });

  it('falls back to the default range on screens', () => {
    expect(readAnalyticsRange({})).toEqual({ months: 12, money: 'months' });
    expect(readAnalyticsRange({ months: '6', money: 'fy' })).toEqual({
      months: 6,
      money: 'fy',
    });
    expect(readAnalyticsRange({ months: ['3', '6'], money: 'x' })).toEqual({
      months: 3,
      money: 'months',
    });
    expect(readAnalyticsRange({ months: '7' })).toEqual({
      months: 12,
      money: 'months',
    });
  });

  it('validates export queries strictly apart from range defaults', () => {
    const parse = (query: string) =>
      analyticsExportInputSchema.safeParse(
        parseAnalyticsExportInput(new URLSearchParams(query)),
      );
    expect(parse('format=csv').data).toEqual({
      format: 'csv',
      months: 12,
      money: 'months',
    });
    expect(parse('format=pdf&months=3&money=fy').data).toEqual({
      format: 'pdf',
      months: 3,
      money: 'fy',
    });
    expect(parse('format=xlsx').success).toBe(false);
    expect(parse('format=csv&months=5').success).toBe(false);
    expect(parse('format=csv&money=week').success).toBe(false);
  });
});
