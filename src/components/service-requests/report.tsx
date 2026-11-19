// Show the read-only helpdesk report and daily-check summary as tables with simple bars.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { Card, StatTile } from '@/components/ui/data-display';
import { PRIORITY_OPTIONS } from './priority-field';
import type {
  ServiceRequestReport,
  ServiceRequestRoundsReport,
} from '@/core/service-requests/validation';

const cellClass = 'border-b border-rule px-space-2 py-space-2 text-left';

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function show(value: number | null, suffix = '') {
  return value === null ? '—' : `${value}${suffix}`;
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span
      aria-hidden="true"
      className="block h-2 w-full rounded-sm bg-surface-sunken"
    >
      <span
        className="block h-2 rounded-sm bg-brand"
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

type Row = { logged: number; resolved: number; avg_days: number | null };

function BreakdownTable({
  caption,
  label,
  rows,
}: {
  caption: string;
  label: string;
  rows: (Row & { name: string })[];
}) {
  const { translate: t } = useUiTranslator();
  const max = Math.max(0, ...rows.map((row) => row.logged));
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-body">
        <caption className="mb-space-2 text-left text-body-strong">
          {caption}
        </caption>
        <thead>
          <tr>
            <th className={cellClass} scope="col">
              {label}
            </th>
            <th className={cellClass} scope="col">
              {t('Logged')}
            </th>
            <th className={cellClass} scope="col">
              {t('Resolved %')}
            </th>
            <th className={cellClass} scope="col">
              {t('Avg. days')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th className={cellClass} scope="row">
                {row.name}
              </th>
              <td className={cellClass}>
                <span className="grid gap-space-1">
                  {row.logged}
                  <Bar max={max} value={row.logged} />
                </span>
              </td>
              <td className={cellClass}>
                {show(percent(row.resolved, row.logged), '%')}
              </td>
              <td className={cellClass}>{show(row.avg_days)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ServiceRequestReportView({
  report,
}: {
  report: ServiceRequestReport;
}) {
  const { translate: t } = useUiTranslator();
  const { totals, feedback } = report;
  const priorityLabel = (value: string) =>
    t(
      PRIORITY_OPTIONS.find((option) => option.value === value)?.label ?? value,
    );
  return (
    <div className="grid min-w-0 gap-space-4">
      <p className="text-body text-ink-muted">
        {t('Requests logged since {month}.', { month: report.from_month })}
      </p>
      <div className="grid gap-space-3 small:grid-cols-2 medium:grid-cols-4">
        <StatTile label={t('Logged')} value={String(totals.logged)} />
        <StatTile
          label={t('Resolved %')}
          value={show(
            percent(totals.resolved, totals.logged - totals.rejected),
            '%',
          )}
        />
        <StatTile
          label={t('On time %')}
          value={show(percent(totals.on_time, totals.with_target), '%')}
        />
        <StatTile label={t('Avg. days')} value={show(totals.avg_days)} />
      </div>
      <Card className="min-w-0" title={t('By category')}>
        <BreakdownTable
          caption={t('Requests by category')}
          label={t('Category')}
          rows={report.by_category.map((row) => ({
            ...row,
            name: row.category,
          }))}
        />
      </Card>
      <Card className="min-w-0" title={t('By priority')}>
        <BreakdownTable
          caption={t('Requests by priority')}
          label={t('Priority')}
          rows={report.by_priority.map((row) => ({
            ...row,
            name: priorityLabel(row.priority),
          }))}
        />
      </Card>
      <Card className="min-w-0" title={t('By month')}>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-body">
            <caption className="mb-space-2 text-left text-body-strong">
              {t('Monthly volume and closing backlog')}
            </caption>
            <thead>
              <tr>
                <th className={cellClass} scope="col">
                  {t('Month')}
                </th>
                <th className={cellClass} scope="col">
                  {t('Logged')}
                </th>
                <th className={cellClass} scope="col">
                  {t('Resolved')}
                </th>
                <th className={cellClass} scope="col">
                  {t('Avg. days')}
                </th>
                <th className={cellClass} scope="col">
                  {t('Open at month end')}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.by_month.map((row) => (
                <tr key={row.month}>
                  <th className={cellClass} scope="row">
                    {row.month}
                  </th>
                  <td className={cellClass}>{row.logged}</td>
                  <td className={cellClass}>{row.resolved}</td>
                  <td className={cellClass}>{show(row.avg_days)}</td>
                  <td className={cellClass}>{row.closing_backlog}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="min-w-0" title={t('Open load per assignee')}>
        <ul className="grid gap-space-2">
          {report.open_load.map((row, index) => (
            <li
              className="flex flex-wrap justify-between gap-space-2 border-b border-rule py-space-2"
              key={`${row.assignee ?? 'unknown'}-${index}`}
            >
              <span>{row.assignee ?? t('Unnamed assignee')}</span>
              <span className="text-body-strong">{row.open}</span>
            </li>
          ))}
          <li className="flex flex-wrap justify-between gap-space-2 py-space-2">
            <span>{t('Not assigned')}</span>
            <span className="text-body-strong">{report.unassigned_open}</span>
          </li>
        </ul>
      </Card>
      <Card className="min-w-0" title={t('Feedback')}>
        <p className="text-body">
          {t(
            '{count} rated · overall {overall} · quality {quality} · speed {speed} · behaviour {behaviour}',
            {
              count: feedback.rated,
              overall: show(feedback.avg_overall),
              quality: show(feedback.avg_quality),
              speed: show(feedback.avg_speed),
              behaviour: show(feedback.avg_behaviour),
            },
          )}
        </p>
        <p className="text-caption text-ink-muted">
          {t('{count} need a follow-up', { count: feedback.follow_up_needed })}
        </p>
        {report.comments?.length ? (
          <ul className="mt-space-3 grid gap-space-3">
            {report.comments.map((comment) => (
              <li
                className="border-b border-rule pb-space-3"
                key={comment.request_id}
              >
                <p className="text-body-strong">
                  {comment.category} · {comment.rating}/5
                </p>
                <p className="whitespace-pre-wrap text-body">
                  {comment.comment}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      {report.repeats ? (
        <Card className="min-w-0" title={t('Repeat issues')}>
          {report.repeats.length ? (
            <ul className="grid gap-space-2">
              {report.repeats.map((row) => (
                <li
                  className="flex flex-wrap justify-between gap-space-2 border-b border-rule py-space-2"
                  key={`${row.category}-${row.unit_number}`}
                >
                  <span>
                    {row.category} · {row.unit_number}
                  </span>
                  <span className="text-body-strong">{row.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-ink-muted">
              {t('No repeat issues in this period.')}
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}

export function ServiceRequestRoundsReportView({
  rounds,
}: {
  rounds: ServiceRequestRoundsReport;
}) {
  const { translate: t } = useUiTranslator();
  const max = Math.max(0, ...rounds.points.map((point) => point.issues));
  return (
    <Card
      className="min-w-0"
      description={t('From {from} to {to}', {
        from: rounds.from,
        to: rounds.to,
      })}
      title={t('Daily checks summary')}
    >
      <div className="grid gap-space-3 small:grid-cols-3">
        <StatTile label={t('Checks')} value={String(rounds.totals.checks)} />
        <StatTile label={t('Issues')} value={String(rounds.totals.issues)} />
        <StatTile
          label={t('OK rate')}
          value={show(rounds.totals.ok_pct, '%')}
        />
      </div>
      {rounds.points.length ? (
        <div className="mt-space-4 min-w-0 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-body">
            <caption className="mb-space-2 text-left text-body-strong">
              {t('Points with the most issues')}
            </caption>
            <thead>
              <tr>
                <th className={cellClass} scope="col">
                  {t('Point')}
                </th>
                <th className={cellClass} scope="col">
                  {t('Checks')}
                </th>
                <th className={cellClass} scope="col">
                  {t('Issues')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.points.map((point) => (
                <tr key={point.point_id}>
                  <th className={cellClass} scope="row">
                    {point.name}
                  </th>
                  <td className={cellClass}>{point.checks}</td>
                  <td className={cellClass}>
                    <span className="grid gap-space-1">
                      {point.issues}
                      <Bar max={max} value={point.issues} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
