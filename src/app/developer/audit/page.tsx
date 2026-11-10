// Review audited platform changes across societies.
import Link from 'next/link';
import { AuditList } from '@/components/developer/audit-list';
import { QueryPagination } from '@/components/developer/query-pagination';
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import {
  auditFilterSchema,
  getDeveloperSocieties,
  listDeveloperAudit,
} from '@/core/developer/console';

export const metadata = {
  title: 'Audit Log | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DeveloperAuditPage({
  searchParams,
}: AuditPageProps) {
  const rawSearch = await searchParams;
  const query = Object.fromEntries(
    Object.entries(rawSearch).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
  const filters = auditFilterSchema.safeParse(query);
  if (!filters.success) {
    return (
      <ErrorPanel
        message="Check the filters and dates, then try again."
        title="Audit log filters could not be applied"
      />
    );
  }

  const [result, societyList] = await Promise.all([
    listDeveloperAudit(filters.data),
    getDeveloperSocieties(1, 100),
  ]);
  const queryFilters = Object.fromEntries(
    Object.entries(filters.data)
      .filter(
        ([key, value]) =>
          key !== 'page' && key !== 'pageSize' && value !== undefined,
      )
      .map(([key, value]) => [key, String(value)]),
  );

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Audit Log</h1>
        <p className="text-body text-ink-muted">
          Review who changed platform and society settings, with
          before-and-after values. Dates use IST; the end date is exclusive.
        </p>
        <Link
          className="text-caption text-dev-label underline"
          href="/developer"
        >
          Back to societies
        </Link>
      </header>
      <Card title="Filters">
        <form
          action="/developer/audit"
          className="grid gap-space-3 medium:grid-cols-2 expanded:grid-cols-4"
          method="get"
        >
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="audit-society"
          >
            Society
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.societyId ?? ''}
              id="audit-society"
              name="societyId"
            >
              <option value="">All societies</option>
              {societyList.societies.map((society) => (
                <option key={society.id} value={society.id}>
                  {society.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="audit-actor"
          >
            Actor user ID
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 font-mono text-body text-ink"
              defaultValue={filters.data.actorId ?? ''}
              id="audit-actor"
              name="actorId"
            />
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="audit-action"
          >
            Action
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.action ?? ''}
              id="audit-action"
              maxLength={120}
              minLength={2}
              name="action"
            />
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="audit-entity"
          >
            Entity type
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.entityType ?? ''}
              id="audit-entity"
              maxLength={80}
              minLength={2}
              name="entityType"
            />
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="audit-from"
          >
            From (IST)
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.from ?? ''}
              id="audit-from"
              name="from"
              type="date"
            />
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="audit-before"
          >
            Before (IST, exclusive)
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.before ?? ''}
              id="audit-before"
              name="before"
              type="date"
            />
          </label>
          <div className="flex items-end gap-space-2">
            <button
              className="min-h-12 rounded-md border border-brand bg-brand px-space-4 text-body-strong text-on-brand focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              Apply Filters
            </button>
            <Link
              className="inline-flex min-h-12 items-center text-body text-brand underline"
              href="/developer/audit"
            >
              Clear
            </Link>
          </div>
        </form>
      </Card>
      <Card
        title="Recent changes"
        description={`${result.total} matching audit record${result.total === 1 ? '' : 's'}`}
      >
        <AuditList rows={result.rows} />
        <div className="mt-space-4">
          <QueryPagination
            filters={queryFilters}
            href="/developer/audit"
            page={filters.data.page}
            pageSize={filters.data.pageSize}
            total={result.total}
          />
        </div>
      </Card>
    </section>
  );
}
