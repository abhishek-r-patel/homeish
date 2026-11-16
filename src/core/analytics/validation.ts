// Validate the analytics dashboard and settings read models plus range and settings input (client-safe).
import { z } from 'zod';
import { MODULE_KEYS } from '../modules/module-types';
import {
  ANALYTICS_METRIC_KEYS,
  ANALYTICS_METRICS,
  type AnalyticsMetricKey,
} from './catalogue';

export const ANALYTICS_MONTH_OPTIONS = [3, 6, 12] as const;
export const ANALYTICS_DEFAULT_MONTHS = 12;
export type AnalyticsMonths = (typeof ANALYTICS_MONTH_OPTIONS)[number];
export type AnalyticsMoneyRange = 'months' | 'fy';

const metricKey = z.enum(ANALYTICS_METRIC_KEYS);
const moduleKey = z.enum(MODULE_KEYS);
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const figure = z.number().finite().nullable();
const values = z.record(z.string(), figure);
const unit = z.enum([
  'count',
  'paise',
  'percent',
  'days',
  'minutes',
  'rating',
  'quantity',
]);
const series = z
  .array(z.object({ key: z.string().min(1), label: z.string().min(1) }))
  .max(50);

const metricBase = {
  key: metricKey,
  module: moduleKey,
  from: isoDate,
  to: isoDate,
  range: z.enum(['months', 'fy']),
  unit,
  series,
};

export const analyticsTrendSchema = z.object({
  ...metricBase,
  kind: z.literal('trend'),
  points: z
    .array(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/), values }))
    .max(24),
});

export const analyticsBreakdownSchema = z.object({
  ...metricBase,
  kind: z.literal('breakdown'),
  items: z
    .array(z.object({ label: z.string().min(1).max(200), values }))
    .max(30),
});

export const analyticsStatSchema = z.object({
  ...metricBase,
  kind: z.literal('stat'),
  values,
});

export const analyticsMetricSchema = z.discriminatedUnion('kind', [
  analyticsTrendSchema,
  analyticsBreakdownSchema,
  analyticsStatSchema,
]);

export type AnalyticsTrend = z.infer<typeof analyticsTrendSchema>;
export type AnalyticsBreakdown = z.infer<typeof analyticsBreakdownSchema>;
export type AnalyticsStat = z.infer<typeof analyticsStatSchema>;

// A metric whose payload did not match the contract is shown as "not available" instead of failing the page.
export type AnalyticsUnavailable = {
  kind: 'unavailable';
  key: AnalyticsMetricKey;
  module: string;
  from: string;
  to: string;
  range: 'months' | 'fy';
};

export type AnalyticsMetric =
  AnalyticsTrend | AnalyticsBreakdown | AnalyticsStat | AnalyticsUnavailable;

const dashboardEnvelopeSchema = z.object({
  today: isoDate,
  timezone: z.string().min(1),
  months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  moneyRange: z.enum(['months', 'fy']),
  from: isoDate,
  fyFrom: isoDate,
  generatedAt: timestamp,
  metrics: z.array(z.unknown()).max(ANALYTICS_METRICS.length),
});

export type AnalyticsDashboard = Omit<
  z.infer<typeof dashboardEnvelopeSchema>,
  'metrics'
> & { metrics: AnalyticsMetric[] };

const unavailableSchema = z.object({
  key: metricKey,
  module: z.string(),
  from: isoDate,
  to: isoDate,
  range: z.enum(['months', 'fy']),
});

export function parseAnalyticsDashboard(
  raw: unknown,
  onInvalidMetric?: (key: string | null) => void,
): AnalyticsDashboard {
  const envelope = dashboardEnvelopeSchema.parse(raw);
  const metrics: AnalyticsMetric[] = [];
  for (const item of envelope.metrics) {
    const parsed = analyticsMetricSchema.safeParse(item);
    if (parsed.success) {
      metrics.push(parsed.data);
      continue;
    }
    const fallback = unavailableSchema.safeParse(item);
    onInvalidMetric?.(fallback.success ? fallback.data.key : null);
    if (fallback.success) {
      metrics.push({ kind: 'unavailable', ...fallback.data });
    }
  }
  return { ...envelope, metrics };
}

export const analyticsSettingsSchema = z.object({
  metrics: z.array(metricKey).max(ANALYTICS_METRICS.length),
  isDefault: z.boolean(),
  version: z.number().int().min(0).max(2_147_483_647),
  updatedAt: timestamp.nullable(),
  catalogue: z
    .array(
      z.object({
        key: metricKey,
        module: moduleKey,
        defaultOn: z.boolean(),
        money: z.boolean(),
        moduleEnabled: z.boolean(),
      }),
    )
    .max(ANALYTICS_METRICS.length),
});

export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;

export const analyticsSettingsInputSchema = z
  .object({
    metrics: z
      .array(metricKey)
      .max(ANALYTICS_METRICS.length)
      .refine((keys) => new Set(keys).size === keys.length, {
        message: 'Each metric can be chosen only once.',
      }),
    expectedVersion: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();

export type AnalyticsSettingsInput = z.infer<
  typeof analyticsSettingsInputSchema
>;

export const analyticsRangeSchema = z
  .object({
    months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
    money: z.enum(['months', 'fy']),
  })
  .strict();

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

export const analyticsExportInputSchema = analyticsRangeSchema.extend({
  format: z.enum(['csv', 'pdf']),
});

export type AnalyticsExportInput = z.infer<typeof analyticsExportInputSchema>;

type SearchParamValue = string | string[] | null | undefined;

function first(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

// Screens fall back to the defaults for missing or unknown values; the export route validates strictly.
export function readAnalyticsRange(params: {
  months?: SearchParamValue;
  money?: SearchParamValue;
}): AnalyticsRange {
  const months = Number(first(params.months));
  const money = first(params.money);
  return {
    months:
      ANALYTICS_MONTH_OPTIONS.find((option) => option === months) ??
      ANALYTICS_DEFAULT_MONTHS,
    money: money === 'fy' ? 'fy' : 'months',
  };
}

export function parseAnalyticsExportInput(params: URLSearchParams): unknown {
  const months = params.get('months');
  return {
    format: params.get('format'),
    months: months === null || months === '' ? 12 : Number(months),
    money: params.get('money') ?? 'months',
  };
}

export function defaultAnalyticsMetricKeys(): AnalyticsMetricKey[] {
  return ANALYTICS_METRICS.filter((metric) => metric.defaultOn).map(
    (metric) => metric.key,
  );
}
