// Display the platform error summary for the preceding 24 hours.
import Link from 'next/link';
import { Card, StatusChip } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import {
  getDeveloperDailyJobHealthSummary,
  getDeveloperHealthSummary,
} from '@/core/developer/console';
import type { Json } from '@/core/db/database.types';
import type { ProductStatus } from '@/components/ui/data-display';

export const metadata = {
  title: 'Platform Health | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

type Severity = 'critical' | 'error' | 'warning' | 'info';
type HealthSummary = {
  last24HoursBySeverity: Partial<Record<Severity, number>>;
  topRoutes: { route: string; total: number }[];
  societyErrors: { societyId: string; societyName: string; total: number }[];
};

type DailyJobHealth = {
  lastDailyRunAt: string | null;
  ageHours: number | null;
  staleAfterHours: 36;
  missingTaskCount: number;
  isFresh: boolean;
};

function isRecord(
  value: Json | undefined,
): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseHealthSummary(value: Json): HealthSummary | null {
  if (!isRecord(value)) return null;
  const counts = value.last24HoursBySeverity;
  const topRoutes = value.topRoutes;
  const societyErrors = value.societyErrors;
  if (
    !isRecord(counts) ||
    !Array.isArray(topRoutes) ||
    !Array.isArray(societyErrors)
  ) {
    return null;
  }
  const severities: readonly Severity[] = [
    'critical',
    'error',
    'warning',
    'info',
  ];
  const parsedCounts: Partial<Record<Severity, number>> = {};
  for (const severity of severities) {
    const count = counts[severity];
    if (count !== undefined) {
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
        return null;
      }
      parsedCounts[severity] = count;
    }
  }
  const parsedRoutes: HealthSummary['topRoutes'] = [];
  for (const item of topRoutes) {
    if (
      !isRecord(item) ||
      typeof item.route !== 'string' ||
      typeof item.total !== 'number' ||
      !Number.isInteger(item.total) ||
      item.total < 0
    ) {
      return null;
    }
    parsedRoutes.push({ route: item.route, total: item.total });
  }
  const parsedSocietyErrors: HealthSummary['societyErrors'] = [];
  for (const item of societyErrors) {
    if (
      !isRecord(item) ||
      typeof item.societyId !== 'string' ||
      typeof item.societyName !== 'string' ||
      typeof item.total !== 'number' ||
      !Number.isInteger(item.total) ||
      item.total < 0
    ) {
      return null;
    }
    parsedSocietyErrors.push({
      societyId: item.societyId,
      societyName: item.societyName,
      total: item.total,
    });
  }
  return {
    last24HoursBySeverity: parsedCounts,
    topRoutes: parsedRoutes,
    societyErrors: parsedSocietyErrors,
  };
}

function parseDailyJobHealth(value: Json): DailyJobHealth | null {
  if (
    !isRecord(value) ||
    (value.lastDailyRunAt !== null &&
      (typeof value.lastDailyRunAt !== 'string' ||
        Number.isNaN(Date.parse(value.lastDailyRunAt)))) ||
    (value.ageHours !== null &&
      (typeof value.ageHours !== 'number' ||
        !Number.isInteger(value.ageHours) ||
        value.ageHours < 0)) ||
    value.staleAfterHours !== 36 ||
    typeof value.missingTaskCount !== 'number' ||
    !Number.isInteger(value.missingTaskCount) ||
    value.missingTaskCount < 0 ||
    typeof value.isFresh !== 'boolean'
  ) {
    return null;
  }
  return {
    lastDailyRunAt: value.lastDailyRunAt,
    ageHours: value.ageHours,
    staleAfterHours: 36,
    missingTaskCount: value.missingTaskCount,
    isFresh: value.isFresh,
  };
}

const severities: readonly Severity[] = [
  'critical',
  'error',
  'warning',
  'info',
];

const severityStatuses: Readonly<Record<Severity, ProductStatus>> = {
  critical: 'severity.critical',
  error: 'severity.error',
  warning: 'severity.warning',
  info: 'severity.info',
};

export default async function DeveloperHealthPage() {
  const [summaryValue, dailyJobHealthValue] = await Promise.all([
    getDeveloperHealthSummary(),
    getDeveloperDailyJobHealthSummary(),
  ]);
  const summary = parseHealthSummary(summaryValue);
  const dailyJobHealth = parseDailyJobHealth(dailyJobHealthValue);
  if (!summary || !dailyJobHealth) {
    return (
      <ErrorPanel
        message="The health summary could not be read. Try again or review the error logs."
        title="Platform health is unavailable"
      />
    );
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Platform Health</h1>
        <p className="text-body text-ink-muted">
          Error log summary for the last 24 hours.
        </p>
        <Link
          className="text-caption text-dev-label underline"
          href="/developer/errors"
        >
          Open Error Logs
        </Link>
      </header>
      <div className="grid gap-space-3 medium:grid-cols-2 expanded:grid-cols-4">
        {severities.map((severity) => (
          <Card key={severity} title={severity}>
            <div className="flex items-center justify-between gap-space-3">
              <StatusChip status={severityStatuses[severity]} />
              <p className="text-title font-semibold tabular-nums">
                {summary.last24HoursBySeverity[severity] ?? 0}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-space-4 expanded:grid-cols-2">
        <Card title="Most affected routes">
          {summary.topRoutes.length === 0 ? (
            <p className="text-body text-ink-muted">
              No route errors in the last 24 hours.
            </p>
          ) : (
            <ol className="grid gap-space-3">
              {summary.topRoutes.map(({ route, total }) => (
                <li
                  className="flex items-start justify-between gap-space-3 border-b border-rule pb-space-2 last:border-0"
                  key={route}
                >
                  <code className="break-all text-caption">{route}</code>
                  <span className="text-body-strong tabular-nums">{total}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Societies with most errors">
          {summary.societyErrors.length === 0 ? (
            <p className="text-body text-ink-muted">
              No society errors in the last 24 hours.
            </p>
          ) : (
            <ol className="grid gap-space-3">
              {summary.societyErrors.map(
                ({ societyId, societyName, total }) => (
                  <li
                    className="flex items-start justify-between gap-space-3 border-b border-rule pb-space-2 last:border-0"
                    key={societyId}
                  >
                    <Link
                      className="text-body text-brand underline"
                      href={`/developer/errors?societyId=${encodeURIComponent(societyId)}`}
                    >
                      {societyName}
                    </Link>
                    <span className="text-body-strong tabular-nums">
                      {total}
                    </span>
                  </li>
                ),
              )}
            </ol>
          )}
        </Card>
        <Card title="Daily jobs">
          <div className="grid gap-space-2">
            <p className="text-body-strong">
              {dailyJobHealth.isFresh
                ? 'Expected daily jobs completed within the last 36 hours.'
                : `${dailyJobHealth.missingTaskCount} expected daily job run(s) are missing or overdue.`}
            </p>
            <p className="text-caption text-ink-muted">
              Last completed run:{' '}
              {dailyJobHealth.lastDailyRunAt
                ? new Date(dailyJobHealth.lastDailyRunAt).toLocaleString()
                : 'No completed run recorded'}
            </p>
            {dailyJobHealth.ageHours !== null && (
              <p className="text-caption text-ink-muted">
                Age: {dailyJobHealth.ageHours} hours; alert threshold:{' '}
                {dailyJobHealth.staleAfterHours} hours.
              </p>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}
