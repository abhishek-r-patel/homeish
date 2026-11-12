// Administration workspace for service request triage and categories.
import Link from 'next/link';
import { z } from 'zod';
import { Card, StatTile, StatusChip } from '@/components/ui/data-display';
import { ServiceRequestCategoryManager } from '@/components/service-requests/category-manager';
import { getServiceRequestWorkspace } from '@/core/service-requests/operations';
import { serviceRequestStatusSchema } from '@/core/service-requests/validation';

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
  const params = await searchParams;
  const rawTab = single(params, 'tab');
  const tab = rawTab === 'categories' ? rawTab : 'requests';
  const rawStatus = single(params, 'status');
  const status = serviceRequestStatusSchema.safeParse(rawStatus).success
    ? rawStatus
    : undefined;
  const rawCategoryId = single(params, 'categoryId');
  const categoryId = z.uuid().safeParse(rawCategoryId).success
    ? rawCategoryId
    : undefined;
  const workspace = await getServiceRequestWorkspace({
    status,
    categoryId,
    limit: 50,
  });
  if (!workspace.canReport) {
    return (
      <section className="grid min-w-0 gap-space-5">
        <h1 className="text-title font-semibold">Service requests</h1>
        <p className="text-body text-ink-muted">
          You do not have access to the request administration workspace.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Service requests</h1>
        <p className="text-body text-ink-muted">
          Triage requests, track service targets and manage categories.
        </p>
      </header>
      <nav aria-label="Request administration sections">
        <ul className="flex gap-space-4 border-b border-rule">
          <li>
            <Link
              aria-current={tab === 'requests' ? 'page' : undefined}
              className="inline-flex min-h-12 items-center text-body-strong underline-offset-4 hover:underline"
              href="/admin/requests"
            >
              Requests
            </Link>
          </li>
          {workspace.canManage ? (
            <li>
              <Link
                aria-current={tab === 'categories' ? 'page' : undefined}
                className="inline-flex min-h-12 items-center text-body-strong underline-offset-4 hover:underline"
                href="/admin/requests?tab=categories"
              >
                Categories
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
      {tab === 'categories' && workspace.canManage ? (
        <ServiceRequestCategoryManager categories={workspace.categories} />
      ) : (
        <>
          {workspace.dashboard ? (
            <div className="grid gap-space-3 small:grid-cols-2 medium:grid-cols-4">
              <StatTile
                label="Open requests"
                value={workspace.dashboard.total_open}
              />
              <StatTile label="Overdue" value={workspace.dashboard.overdue} />
              <StatTile
                label="Resolved"
                value={workspace.dashboard.by_status.resolved ?? 0}
              />
              <StatTile
                label="Closed"
                value={workspace.dashboard.by_status.closed ?? 0}
              />
            </div>
          ) : null}
          <Card className="min-w-0" title="Filter requests">
            <form className="flex flex-wrap items-end gap-space-3">
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="admin-request-status"
              >
                Status
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  defaultValue={status ?? ''}
                  id="admin-request-status"
                  name="status"
                >
                  <option value="">All statuses</option>
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
                Category
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  defaultValue={categoryId ?? ''}
                  id="admin-request-category"
                  name="categoryId"
                >
                  <option value="">All categories</option>
                  {workspace.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
                type="submit"
              >
                Apply
              </button>
            </form>
          </Card>
          {workspace.dashboard?.by_category.length ? (
            <Card className="min-w-0" title="Category performance">
              <ul className="grid gap-space-2">
                {workspace.dashboard.by_category.map((category) => (
                  <li
                    className="flex flex-wrap justify-between gap-space-2 border-b border-rule py-space-2"
                    key={category.category_id}
                  >
                    <span className="font-semibold">{category.category}</span>
                    <span className="text-body text-ink-muted">
                      {category.total} · Avg. resolution{' '}
                      {category.avg_resolution_hours === null
                        ? '—'
                        : `${category.avg_resolution_hours.toFixed(1)} h`}
                      {' · '}Rating {category.avg_rating?.toFixed(1) ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {workspace.requests.length === 0 ? (
            <Card title="No requests found">
              <p className="text-body text-ink-muted">
                No service requests match these filters.
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
                          : ' · Common area'}
                      </span>
                      <span className="flex flex-wrap gap-space-2">
                        <StatusChip status={`request.${request.status}`} />
                        {request.is_overdue ? (
                          <StatusChip status="request.overdue" />
                        ) : null}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-body text-ink-muted">
                      {request.description}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {request.requester_name ?? 'Resident'} ·{' '}
                      {new Date(request.created_at).toLocaleDateString('en-IN')}
                      {' · '}Assigned to{' '}
                      {request.assignee_name ??
                        request.assigned_vendor_name ??
                        'nobody'}
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
