// Format committee analytics figures, months and ranges for screens and exports (pure, client-safe).
import type { ModuleKey } from '../modules/module-types';
import { formatLocalizedDate, formatLocalizedDateTime } from '../i18n/format';
import type { Locale } from '../i18n/locale';
import { translateMessage } from '../i18n/messages';

export type AnalyticsUnit =
  'count' | 'paise' | 'percent' | 'days' | 'minutes' | 'rating' | 'quantity';

export const NO_VALUE = '—';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MODULE_LABELS: Readonly<Record<ModuleKey, string>> = {
  core: 'Society',
  visitor: 'Visitors',
  delivery: 'Deliveries',
  billing: 'Billing',
  service_request: 'Requests',
  staff: 'Staff',
  housekeeping: 'Housekeeping',
  amc: 'AMC',
  notice: 'Notices',
  amenity: 'Amenities',
  directory: 'Directory',
  expense: 'Expenses',
  tenancy: 'Tenancy',
  document: 'Documents',
  parking: 'Parking',
  sos: 'SOS',
  vendor: 'Vendors',
  patrol: 'Patrol',
  metering: 'Metering',
  asset: 'Assets',
  home_services: 'Home services',
  poll: 'Polls',
  meeting: 'Meetings',
  event: 'Events',
  community: 'Community',
  language: 'Language',
  major_works: 'Major works',
};

export function analyticsModuleLabel(moduleKey: string): string {
  return MODULE_LABELS[moduleKey as ModuleKey] ?? moduleKey;
}

function decimal(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

// Whole rupees with Indian digit grouping, e.g. 12345600 paise -> "₹1,23,456".
export function formatPaise(
  paise: number | null,
  options: { plain?: boolean; locale?: Locale } = {},
): string {
  if (paise === null) return NO_VALUE;
  const rupees = Math.round(paise / 100);
  const sign = rupees < 0 ? '-' : '';
  const symbol = options.plain ? 'Rs ' : '₹';
  return `${sign}${symbol}${decimal(Math.abs(rupees), 0)}`;
}

export function formatAnalyticsValue(
  value: number | null,
  unit: AnalyticsUnit,
  options: { plain?: boolean; locale?: Locale } = {},
): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE;
  switch (unit) {
    case 'paise':
      return formatPaise(value, options);
    case 'percent':
      return `${decimal(value, 1)}%`;
    case 'days':
      return translateMessage(
        options.locale ?? 'en',
        value === 1 ? '{count} day' : '{count} days',
        { count: decimal(value, 1) },
      );
    case 'minutes':
      return translateMessage(options.locale ?? 'en', '{count} min', {
        count: decimal(value, 1),
      });
    case 'rating':
      return options.plain
        ? `${value.toFixed(1)} / 5`
        : `${value.toFixed(1)} ★`;
    case 'quantity':
      return decimal(value, 2);
    case 'count':
      return decimal(value, 0);
  }
}

// Rating breakdowns carry a count series beside the average (contract: unit "rating", series "ratings" is a count).
export function seriesUnit(
  unit: AnalyticsUnit,
  seriesKey: string,
): AnalyticsUnit {
  return unit === 'rating' && seriesKey !== 'average' ? 'count' : unit;
}

export function unitLabel(unit: AnalyticsUnit): string {
  switch (unit) {
    case 'paise':
      return 'rupees';
    case 'percent':
      return 'percent';
    case 'days':
      return 'days';
    case 'minutes':
      return 'minutes';
    case 'rating':
      return 'rating out of 5';
    case 'quantity':
      return 'quantity';
    case 'count':
      return 'count';
  }
}

// "2026-04" -> "Apr 2026"; anything else is returned unchanged.
export function formatPeriod(period: string, locale: Locale = 'en'): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return period;
  return locale === 'en'
    ? `${month} ${match[1]}`
    : formatLocalizedDate(new Date(`${period}-01T00:00:00Z`), locale, {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

// Financial year (1 April -> 31 March) containing a YYYY-MM-DD date, e.g. "FY 2026–27".
export function formatFinancialYear(
  date: string,
  locale: Locale = 'en',
): string {
  const match = /^(\d{4})-(\d{2})/.exec(date);
  if (!match) return date;
  const year = Number(match[1]);
  const start = Number(match[2]) >= 4 ? year : year - 1;
  return translateMessage(locale, 'FY {from}–{to}', {
    from: start,
    to: String((start + 1) % 100).padStart(2, '0'),
  });
}

// "2026-11-16" -> "16 Nov 2026".
export function formatAnalyticsDate(
  date: string,
  locale: Locale = 'en',
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return date;
  return locale === 'en'
    ? `${Number(match[3])} ${month} ${match[1]}`
    : formatLocalizedDate(new Date(`${date}T00:00:00Z`), locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

export function formatRangeCaption(
  metric: {
    kind: 'trend' | 'breakdown' | 'stat' | 'unavailable';
    from: string;
    to: string;
    range: 'months' | 'fy';
  },
  locale: Locale = 'en',
): string {
  if (metric.kind === 'stat')
    return translateMessage(locale, 'Today, {date}', {
      date: formatAnalyticsDate(metric.to, locale),
    });
  if (metric.range === 'fy') {
    return translateMessage(locale, '{year} to date ({from} – {to})', {
      year: formatFinancialYear(metric.from, locale),
      from: formatAnalyticsDate(metric.from, locale),
      to: formatAnalyticsDate(metric.to, locale),
    });
  }
  return `${formatPeriod(metric.from.slice(0, 7), locale)} – ${formatPeriod(metric.to.slice(0, 7), locale)}`;
}

export function formatGeneratedAt(
  value: string,
  timeZone = 'Asia/Kolkata',
  locale: Locale = 'en',
) {
  // ICU may emit narrow no-break spaces, which the PDF's standard font cannot encode.
  return formatLocalizedDateTime(new Date(value), locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).replace(/[\u00a0\u202f]/g, ' ');
}
