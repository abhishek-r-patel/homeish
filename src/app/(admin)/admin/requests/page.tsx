// Administration workspace for request triage, logging, categories, reports and daily checks.
import Link from 'next/link';
import { z } from 'zod';
import { Card, StatTile, StatusChip } from '@/components/ui/data-display';
import {
  ServiceRequestCategoryManager,
  ServiceRequestEscalationSettingsForm,
} from '@/components/service-requests/category-manager';
import {
  INTAKE_SOURCE_LABELS,
  ServiceRequestLogForm,
} from '@/components/service-requests/log-form';
import {
  ServiceRequestReportView,
  ServiceRequestRoundsReportView,
} from '@/components/service-requests/report';
import {
  ServiceRequestInspectionPointManager,
  ServiceRequestRoundsChecklist,
} from '@/components/service-requests/rounds';
import {
  getServiceRequestEscalationSettings,
  getServiceRequestLogOptions,
  getServiceRequestReportWorkspace,
  getServiceRequestRoundsWorkspace,
  getServiceRequestTargets,
  getServiceRequestWorkspace,
} from '@/core/service-requests/operations';
import { serviceRequestStatusSchema } from '@/core/service-requests/validation';
import { formatLocalizedDate, formatLocalizedNumber } from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Requests | Homeish',
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string) {
  return typeof params[key] === 'string' ? params[key] : undefined;
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const params = await searchParams;
  const rawTab = single(params, 'tab');
  const tab =
    rawTab === 'categories' ||
    rawTab === 'log' ||
    rawTab === 'report' ||
    rawTab === 'rounds'
      ? rawTab
      : 'requests';
  const rawStatus = single(params, 'status');
  const status = serviceRequestStatusSchema.safeParse(rawStatus).success
    ? rawStatus
    : undefined;
  const rawCategoryId = single(params, 'categoryId');
  const categoryId = z.uuid().safeParse(rawCategoryId).success
    ? rawCategoryId
    : undefined;
  const sort = single(params, 'sort') === 'votes' ? 'votes' : 'default';
  const workspace = await getServiceRequestWorkspace({
    status,
    categoryId,
    limit: 50,
    sort,
  });
  if (!workspace.canReport) {
    return (
      <section className="grid min-w-0 gap-space-5">
        <h1 className="text-title font-semibold">{t('Service requests')}</h1>
        <p className="text-body text-ink-muted">
          {t('You do not have access to the request administration workspace.')}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Service requests')}</h1>
        <p className="text-body text-ink-muted">
          {t('Triage requests, track service targets and manage categories.')}
        </p>
      </header>
      <nav aria-label={t('Request administration sections')}>
        <ul className="flex gap-space-4 border-b border-rule">
          <li>
            <Link
              aria-current={tab === 'requests' ? 'page' : undefined}
              className="inline-flex min-h-12 items-center text-body-strong underline-offset-4 hover:underline"
              href="/admin/requests"
            >
              {t('Requests')}
            </Link>
          </li>
          {(
            [
              ['log', 'Log a request', workspace.canManage],
              ['report', 'Report', true],
              ['rounds', 'Daily checks', workspace.canManage],
              ['categories', 'Categories', workspace.canManage],
            ] as const
          )
            .filter(([, , visible]) => visible)
            .map(([key, label]) => (
              <li key={key}>
                <Link
                  aria-current={tab === key ? 'page' : undefined}
                  className="inline-flex min-h-12 items-center text-body-strong underline-offset-4 hover:underline"
                  href={`/admin/requests?tab=${key}`}
                >
                  {t(label)}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      {tab === 'categories' && workspace.canManage ? (
        <div className="grid min-w-0 gap-space-4">
          <ServiceRequestEscalationSettingsForm
            settings={await getServiceRequestEscalationSettings()}
          />
          <ServiceRequestCategoryManager
            categories={workspace.categories}
            targets={await getServiceRequestTargets()}
          />
        </div>
      ) : tab === 'log' && workspace.canManage ? (
        <Card className="min-w-0" title={t('Log a request')}>
          <ServiceRequestLogForm {...await getServiceRequestLogOptions()} />
        </Card>
      ) : tab === 'report' ? (
        await (async () => {
          const { report, rounds } = await getServiceRequestReportWorkspace();
          return (
            <div className="grid min-w-0 gap-space-4">
              <ServiceRequestReportView report={report} />
              <ServiceRequestRoundsReportView rounds={rounds} />
            </div>
          );
        })()
      ) : tab === 'rounds' && workspace.canManage ? (
        await (async () => {
          const rounds = await getServiceRequestRoundsWorkspace();
          return (
            <div className="grid min-w-0 gap-space-4">
              {rounds.summary ? (
                <ServiceRequestRoundsReportView rounds={rounds.summary} />
              ) : null}
              <section className="grid min-w-0 gap-space-3">
                <h2 className="text-heading font-semibold">
                  {t("Today's checklist")}
                </h2>
                <ServiceRequestRoundsChecklist
                  options={rounds.options}
                  today={rounds.today}
                />
              </section>
              <section className="grid min-w-0 gap-space-3">
                <h2 className="text-heading font-semibold">
                  {t('Check points')}
                </h2>
                <ServiceRequestInspectionPointManager
                  points={rounds.today.points}
                />
              </section>
            </div>
          );
        })()
      ) : (
        <>
          {workspace.dashboard ? (
            <div className="grid gap-space-3 small:grid-cols-2 medium:grid-cols-4">
              <StatTile
                label={t('Open requests')}
                value={formatLocalizedNumber(
                  workspace.dashboard.total_open,
                  locale,
                )}
              />
              <StatTile
                label={t('Overdue')}
                value={formatLocalizedNumber(
                  workspace.dashboard.overdue,
                  locale,
                )}
              />
              <StatTile
                label={t('Resolved')}
                value={formatLocalizedNumber(
                  workspace.dashboard.by_status.resolved ?? 0,
                  locale,
                )}
              />
              <StatTile
                label={t('Closed')}
                value={formatLocalizedNumber(
                  workspace.dashboard.by_status.closed ?? 0,
                  locale,
                )}
              />
            </div>
          ) : null}
          <Card className="min-w-0" title={t('Filter requests')}>
            <form className="flex flex-wrap items-end gap-space-3">
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="admin-request-status"
              >
                {t('Status')}
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  defaultValue={status ?? ''}
                  id="admin-request-status"
                  name="status"
                >
                  <option value="">{t('All statuses')}</option>
                  {serviceRequestStatusSchema.options.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="admin-request-category"
              >
                {t('Category')}
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  defaultValue={categoryId ?? ''}
                  id="admin-request-category"
                  name="categoryId"
                >
                  <option value="">{t('All categories')}</option>
                  {workspace.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="admin-request-sort"
              >
                {t('Sort')}
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  defaultValue={sort}
                  id="admin-request-sort"
                  name="sort"
                >
                  <option value="default">
                    {t('Overdue first, then newest')}
                  </option>
                  <option value="votes">{t('Most upvoted')}</option>
                </select>
              </label>
              <button
                className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
                type="submit"
              >
                {t('Apply')}
              </button>
            </form>
          </Card>
          {workspace.dashboard?.by_category.length ? (
            <Card className="min-w-0" title={t('Category performance')}>
              <ul className="grid gap-space-2">
                {workspace.dashboard.by_category.map((category) => (
                  <li
                    className="flex flex-wrap justify-between gap-space-2 border-b border-rule py-space-2"
                    key={category.category_id}
                  >
                    <span className="font-semibold">{category.category}</span>
                    <span className="text-body text-ink-muted">
                      {formatLocalizedNumber(category.total, locale)} ·{' '}
                      {t('Avg. resolution')}{' '}
                      {category.avg_resolution_hours === null
                        ? '—'
                        : `${formatLocalizedNumber(category.avg_resolution_hours, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`}
                      {' · '}
                      {t('Rating')}{' '}
                      {category.avg_rating === null ||
                      category.avg_rating === undefined
                        ? '—'
                        : formatLocalizedNumber(category.avg_rating, locale, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {workspace.requests.length === 0 ? (
            <Card title={t('No requests found')}>
              <p className="text-body text-ink-muted">
                {t('No service requests match these filters.')}
              </p>
            </Card>
          ) : (
            <ul className="grid gap-space-3">
              {workspace.requests.map((request) => (
                <li
                  className="min-w-0 rounded-md border border-rule bg-surface p-space-4"
                  key={request.id}
                >
                  <Link
                    className="grid gap-space-3 focus-visible:outline-2 focus-visible:outline-focus"
                    href={`/requests/${request.id}`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-space-2">
                      <span className="text-subheading font-semibold">
                        {request.category_name}
                        {request.unit_number
                          ? ` · ${request.unit_number}`
                          : ` · ${t('Common area')}`}
                      </span>
                      <span className="flex flex-wrap gap-space-2">
                        <StatusChip status={`request.${request.status}`} />
                        <StatusChip
                          status={`request.priority_${request.priority}`}
                        />
                        {request.on_hold_since ? (
                          <StatusChip
                            detail={translateMessage(locale, '{count} days', {
                              count: request.held_days ?? 0,
                            })}
                            status="request.on_hold"
                          />
                        ) : request.is_overdue ? (
                          <StatusChip status="request.overdue" />
                        ) : null}
                        {request.escalation_level !== 'none' ? (
                          <StatusChip
                            status={`request.escalated_${request.escalation_level}`}
                          />
                        ) : null}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-body text-ink-muted">
                      {request.description}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {request.requester_name ?? t('Resident')} ·{' '}
                      {formatLocalizedDate(
                        new Date(request.created_at),
                        locale,
                        { day: '2-digit', month: '2-digit', year: 'numeric' },
                      )}
                      {` · ${t(INTAKE_SOURCE_LABELS[request.intake_source])}`}
                      {' · '}
                      {t('Assigned to')}{' '}
                      {request.assignee_name ??
                        request.assigned_vendor_name ??
                        t('nobody')}
                      {request.location_type === 'common_area'
                        ? ` · ${formatLocalizedNumber(request.upvote_count, locale)} ${t('votes')}`
                        : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
