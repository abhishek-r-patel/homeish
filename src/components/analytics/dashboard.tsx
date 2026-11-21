// Render the committee analytics dashboard: range links, admin actions and one accessible card per metric.
'use client';
import { useUiTranslator } from '@/components/ui/language';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatTile } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import { getAnalyticsMetric } from '@/core/analytics/catalogue';
import {
  analyticsModuleLabel,
  formatAnalyticsValue,
  formatFinancialYear,
  formatGeneratedAt,
  formatPeriod,
  formatRangeCaption,
  seriesUnit,
  type AnalyticsUnit,
} from '@/core/analytics/format';
import {
  ANALYTICS_MONTH_OPTIONS,
  type AnalyticsBreakdown,
  type AnalyticsDashboard,
  type AnalyticsMetric,
  type AnalyticsMoneyRange,
  type AnalyticsStat,
  type AnalyticsTrend,
} from '@/core/analytics/validation';

const linkClass =
  'text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const pillClass =
  'inline-flex min-h-11 items-center rounded-md border px-space-3 text-caption focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const actionClass =
  'inline-flex min-h-11 items-center rounded-md border border-rule-strong bg-surface px-space-4 text-body-strong text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export type AnalyticsDashboardViewProps = {
  dashboard: AnalyticsDashboard;
  canManage: boolean;
  canExport: boolean;
  basePath: string;
  settingsHref: string;
  exportPath?: string;
  headlines?: ReactNode;
};

function rangeHref(
  basePath: string,
  months: number,
  money: AnalyticsMoneyRange,
): string {
  const params = new URLSearchParams({ months: String(months), money });
  return `${basePath}?${params.toString()}`;
}

function exportHref(
  exportPath: string,
  format: 'csv' | 'pdf',
  months: number,
  money: AnalyticsMoneyRange,
): string {
  const params = new URLSearchParams({
    format,
    months: String(months),
    money,
  });
  return `${exportPath}?${params.toString()}`;
}

function RangeLink({
  current,
  href,
  children,
}: {
  current: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      aria-current={current ? 'true' : undefined}
      className={`${pillClass} ${
        current
          ? 'border-brand bg-brand-tint font-semibold text-brand'
          : 'border-rule bg-surface text-ink'
      }`}
      href={href}
      scroll={false}
    >
      {children}
    </Link>
  );
}

function RangeControls({
  dashboard,
  basePath,
}: {
  dashboard: AnalyticsDashboard;
  basePath: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-3">
      <nav aria-label={t('Trend range')}>
        <p
          className="mb-space-1 text-caption text-ink-muted"
          id="analytics-range-label"
        >
          {t('Show trends for')}
        </p>
        <ul
          aria-labelledby="analytics-range-label"
          className="flex flex-wrap gap-space-2"
        >
          {ANALYTICS_MONTH_OPTIONS.map((months) => (
            <li key={months}>
              <RangeLink
                current={dashboard.months === months}
                href={rangeHref(basePath, months, dashboard.moneyRange)}
              >
                {t('Last {count} months', { count: months })}
              </RangeLink>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label={t('Money range')}>
        <p
          className="mb-space-1 text-caption text-ink-muted"
          id="analytics-money-label"
        >
          {t('Money')}
        </p>
        <ul
          aria-labelledby="analytics-money-label"
          className="flex flex-wrap gap-space-2"
        >
          <li>
            <RangeLink
              current={dashboard.moneyRange === 'months'}
              href={rangeHref(basePath, dashboard.months, 'months')}
            >
              {t('Last {count} months', { count: dashboard.months })}
            </RangeLink>
          </li>
          <li>
            <RangeLink
              current={dashboard.moneyRange === 'fy'}
              href={rangeHref(basePath, dashboard.months, 'fy')}
            >
              {t('This financial year ({year})', {
                year: formatFinancialYear(dashboard.today, locale ?? 'en'),
              })}
            </RangeLink>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function Bar({ value, max }: { value: number | null; max: number }) {
  const ratio =
    value === null || value <= 0 || max <= 0 ? 0 : Math.min(value / max, 1);
  return (
    <span
      aria-hidden="true"
      className="mt-space-1 block h-1.5 w-full min-w-12 overflow-hidden rounded-sm bg-surface-sunken"
    >
      <span
        className="block h-full rounded-sm bg-brand"
        style={{ width: `${(ratio * 100).toFixed(1)}%` }}
      />
    </span>
  );
}

// Percentages and ratings have a fixed ceiling; other figures are scaled to the largest value in the series.
function scaleFor(
  unit: AnalyticsUnit,
  rows: readonly Record<string, number | null>[],
  key: string,
): number {
  if (unit === 'percent') return 100;
  if (unit === 'rating') return 5;
  return rows.reduce((max, row) => {
    const value = row[key];
    return typeof value === 'number' && value > max ? value : max;
  }, 0);
}

function ScrollTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-label={label}
      className="max-w-full overflow-x-auto rounded-md border border-rule focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function NoData() {
  const { translate: t } = useUiTranslator();
  return (
    <p className="text-caption text-ink-muted">
      {t('No data for this period yet.')}
    </p>
  );
}

function TrendTable({
  metric,
  label,
}: {
  metric: AnalyticsTrend;
  label: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  if (metric.points.length === 0 || metric.series.length === 0)
    return <NoData />;
  const rows = metric.points.map((point) => point.values);
  const scales = Object.fromEntries(
    metric.series.map((series) => [
      series.key,
      scaleFor(seriesUnit(metric.unit, series.key), rows, series.key),
    ]),
  );
  return (
    <ScrollTable label={t('{label} table', { label })}>
      <table className="w-full min-w-max border-collapse text-caption">
        <caption className="sr-only">
          {t('{label}, by month. {range}', {
            label,
            range: formatRangeCaption(metric, locale ?? 'en'),
          })}
        </caption>
        <thead className="bg-surface-sunken">
          <tr>
            <th
              className="px-space-3 py-space-2 text-left font-semibold"
              scope="col"
            >
              {t('Month')}
            </th>
            {metric.series.map((series) => (
              <th
                className="px-space-3 py-space-2 text-right font-semibold"
                key={series.key}
                scope="col"
              >
                {t(series.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metric.points.map((point) => (
            <tr className="border-t border-rule" key={point.period}>
              <th
                className="px-space-3 py-space-2 text-left font-normal"
                scope="row"
              >
                {formatPeriod(point.period, locale ?? 'en')}
              </th>
              {metric.series.map((series) => {
                const value = point.values[series.key] ?? null;
                return (
                  <td
                    className="px-space-3 py-space-2 text-right tabular-nums"
                    key={series.key}
                  >
                    {formatAnalyticsValue(
                      value,
                      seriesUnit(metric.unit, series.key),
                      { locale: locale ?? 'en' },
                    )}
                    <Bar max={scales[series.key] ?? 0} value={value} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}

function BreakdownList({ metric }: { metric: AnalyticsBreakdown }) {
  const { locale, translate: t } = useUiTranslator();
  const localizedItemLabels = [
    'directory.vehicles',
    'vendor.requests',
    'metering.consumption',
    'home_services.providers',
    'home_services.ratings',
  ].includes(metric.key);
  const [primary, ...others] = metric.series;
  if (metric.items.length === 0 || !primary) return <NoData />;
  const primaryUnit = seriesUnit(metric.unit, primary.key);
  const max = scaleFor(
    primaryUnit,
    metric.items.map((item) => item.values),
    primary.key,
  );
  return (
    <ol className="grid gap-space-3">
      {metric.items.map((item, index) => (
        <li className="grid gap-space-1" key={`${index}-${item.label}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-space-3">
            <span className="min-w-0 break-words">
              <span className="sr-only">{index + 1}. </span>
              {localizedItemLabels ? t(item.label) : item.label}
            </span>
            <span className="text-body-strong tabular-nums">
              <span className="sr-only">{t(primary.label)}: </span>
              {formatAnalyticsValue(
                item.values[primary.key] ?? null,
                primaryUnit,
                { locale: locale ?? 'en' },
              )}
            </span>
          </div>
          <Bar max={max} value={item.values[primary.key] ?? null} />
          {others.length > 0 ? (
            <p className="text-micro text-ink-muted">
              {others
                .map(
                  (series) =>
                    `${t(series.label)}: ${formatAnalyticsValue(
                      item.values[series.key] ?? null,
                      seriesUnit(metric.unit, series.key),
                      { locale: locale ?? 'en' },
                    )}`,
                )
                .join(' · ')}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function StatTiles({ metric }: { metric: AnalyticsStat }) {
  const { locale, translate: t } = useUiTranslator();
  if (metric.series.length === 0) return <NoData />;
  return (
    <div className="grid grid-cols-1 gap-space-3 medium:grid-cols-2">
      {metric.series.map((series) => (
        <StatTile
          key={series.key}
          label={t(series.label)}
          value={formatAnalyticsValue(
            metric.values[series.key] ?? null,
            seriesUnit(metric.unit, series.key),
            { locale: locale ?? 'en' },
          )}
        />
      ))}
    </div>
  );
}

function MetricBody({
  metric,
  label,
}: {
  metric: AnalyticsMetric;
  label: string;
}) {
  const { translate: t } = useUiTranslator();
  switch (metric.kind) {
    case 'trend':
      return <TrendTable label={label} metric={metric} />;
    case 'breakdown':
      return <BreakdownList metric={metric} />;
    case 'stat':
      return <StatTiles metric={metric} />;
    case 'unavailable':
      return (
        <p className="text-caption text-ink-muted">
          {t('This figure is not available right now. Try again later.')}
        </p>
      );
  }
}

export function analyticsCardId(key: string): string {
  return `analytics-${key.replace(/\./g, '-')}`;
}

function MetricCard({ metric }: { metric: AnalyticsMetric }) {
  const { locale, translate: t } = useUiTranslator();
  const definition = getAnalyticsMetric(metric.key);
  const label = definition ? t(definition.label) : metric.key;
  const moduleLabel = t(analyticsModuleLabel(metric.module));
  const headingId = `${analyticsCardId(metric.key)}-title`;
  return (
    <section
      aria-labelledby={headingId}
      className="grid min-w-0 content-start gap-space-3 rounded-md border border-rule bg-surface p-space-4 medium:p-space-5"
      id={analyticsCardId(metric.key)}
    >
      <header className="grid gap-space-1">
        <div className="flex flex-wrap items-start justify-between gap-space-2">
          <h2 className="text-subheading" id={headingId}>
            {label}
          </h2>
          <span className="inline-flex min-h-6 items-center rounded-sm bg-neutral-tint px-space-2 text-micro text-neutral">
            {moduleLabel}
          </span>
        </div>
        {definition?.description ? (
          <p className="text-caption text-ink-muted">
            {t(definition.description)}
          </p>
        ) : null}
        <p className="text-micro text-ink-muted">
          {formatRangeCaption(metric, locale ?? 'en')}
        </p>
      </header>
      <MetricBody label={label} metric={metric} />
      {definition?.href ? (
        <Link className={`${linkClass} text-caption`} href={definition.href}>
          {t('View in {module}', { module: moduleLabel })}
          <span className="sr-only">{t(' for {label}', { label })}</span>
        </Link>
      ) : null}
    </section>
  );
}

export function AnalyticsDashboardView({
  dashboard,
  canManage,
  canExport,
  basePath,
  settingsHref,
  exportPath = '/api/analytics/export',
  headlines,
}: AnalyticsDashboardViewProps) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <div className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-3">
        <div className="flex flex-wrap items-start justify-between gap-space-3">
          <div className="grid gap-space-1">
            <h1 className="text-title font-semibold">{t('Analytics')}</h1>
            <p className="text-caption text-ink-muted">
              {t('Society totals only, worked out live. Updated {date}.', {
                date: formatGeneratedAt(
                  dashboard.generatedAt,
                  dashboard.timezone,
                  locale ?? 'en',
                ),
              })}
            </p>
          </div>
          {canManage || canExport ? (
            <div className="flex flex-wrap gap-space-2">
              {canManage ? (
                <Link className={actionClass} href={settingsHref}>
                  {t('Settings')}
                </Link>
              ) : null}
              {canExport ? (
                <>
                  <a
                    className={actionClass}
                    href={exportHref(
                      exportPath,
                      'csv',
                      dashboard.months,
                      dashboard.moneyRange,
                    )}
                  >
                    {t('Export CSV')}
                  </a>
                  <a
                    className={actionClass}
                    href={exportHref(
                      exportPath,
                      'pdf',
                      dashboard.months,
                      dashboard.moneyRange,
                    )}
                  >
                    {t('Export PDF')}
                  </a>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <RangeControls basePath={basePath} dashboard={dashboard} />
        {canExport ? (
          <p className="text-caption text-ink-muted">
            {t('PDF and CSV exports remain in English.')}
          </p>
        ) : null}
      </header>
      {headlines}
      {dashboard.metrics.length === 0 ? (
        <EmptyState
          title={t('No analytics selected')}
          description={
            canManage
              ? t(
                  'Choose the figures you want to see, or turn on the modules they come from.',
                )
              : t(
                  'An administrator has not chosen any figures yet, or their modules are turned off.',
                )
          }
          action={
            canManage ? (
              <Link className={linkClass} href={settingsHref}>
                {t('Choose analytics')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-space-4 expanded:grid-cols-2">
          {dashboard.metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </div>
      )}
    </div>
  );
}
