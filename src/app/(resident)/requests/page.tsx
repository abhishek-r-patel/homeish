// Resident service request list and status filters.
import Link from 'next/link';
import { EmptyState } from '@/components/ui/feedback';
import { StatusChip } from '@/components/ui/data-display';
import { getServiceRequestWorkspace } from '@/core/service-requests/operations';
import { serviceRequestStatusSchema } from '@/core/service-requests/validation';

export const metadata = {
  title: 'Requests | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = typeof params.status === 'string' ? params.status : '';
  const status = serviceRequestStatusSchema.safeParse(rawStatus).success
    ? rawStatus
    : undefined;
  const workspace = await getServiceRequestWorkspace({ status });

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="flex flex-wrap items-end justify-between gap-space-3">
        <div className="grid gap-space-2">
          <h1 className="text-title font-semibold">Service requests</h1>
          <p className="text-body text-ink-muted">
            Report an issue and follow updates from your society.
          </p>
        </div>
        <Link
          className="inline-flex min-h-12 items-center rounded-md bg-brand px-space-4 font-semibold text-on-brand focus-visible:outline-2 focus-visible:outline-focus"
          href="/requests/new"
        >
          New request
        </Link>
      </header>
      <form className="flex flex-wrap items-end gap-space-3">
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="request-filter-status"
        >
          Status
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            defaultValue={status ?? ''}
            id="request-filter-status"
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
        <button
          className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
          type="submit"
        >
          Filter
        </button>
      </form>
      {workspace.requests.length === 0 ? (
        <EmptyState
          description="Requests you submit will appear here with their latest status."
          title="No service requests"
        />
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
                  <StatusChip status={`request.${request.status}`} />
                </span>
                <span className="line-clamp-2 text-body text-ink-muted">
                  {request.description}
                </span>
                <span className="text-caption text-ink-muted">
                  Submitted{' '}
                  {new Date(request.created_at).toLocaleDateString('en-IN')}
                  {request.is_overdue ? ' · Overdue' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
