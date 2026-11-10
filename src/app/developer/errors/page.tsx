// Search error records and resolve or ignore actionable diagnostics.
import Link from 'next/link';
import {
  errorFilterSchema,
  getDeveloperSocieties,
  listDeveloperErrors,
} from '@/core/developer/console';
import { MODULE_KEYS, MODULE_REGISTRY } from '@/core/modules';
import { ErrorList } from '@/components/developer/error-list';
import { QueryPagination } from '@/components/developer/query-pagination';
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';

export const metadata = {
  title: 'Error Logs | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

type ErrorLogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorSources = ['server', 'client', 'job'] as const;
const errorSeverities = ['critical', 'error', 'warning', 'info'] as const;
const errorStatuses = ['open', 'resolved', 'ignored'] as const;

export default async function DeveloperErrorsPage({
  searchParams,
}: ErrorLogPageProps) {
  const rawSearch = await searchParams;
  const query = Object.fromEntries(
    Object.entries(rawSearch).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
  const filters = errorFilterSchema.safeParse(query);
  if (!filters.success) {
    return (
      <ErrorPanel
        message="Check the filters and dates, then try again."
        title="Error log filters could not be applied"
      />
    );
  }

  const [result, societyList] = await Promise.all([
    listDeveloperErrors(filters.data),
    getDeveloperSocieties(1, 100),
  ]);
  const societyNames = Object.fromEntries(
    societyList.societies.map(({ id, name }) => [id, name]),
  );
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
        <h1 className="text-title font-semibold">Error Logs</h1>
        <p className="text-body text-ink-muted">
          Search by a reference ID first, or filter recent errors.
        </p>
        <Link
          className="text-caption text-dev-label underline"
          href="/developer"
        >
          Back to societies
        </Link>
      </header>
      <Card title="Find by reference ID">
        <form
          action="/developer/errors"
          className="flex flex-col gap-space-3 medium:flex-row medium:items-end"
          method="get"
        >
          <label
            className="grid flex-1 gap-space-1 text-body-strong"
            htmlFor="reference-id"
          >
            Reference ID
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 font-mono text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
              id="reference-id"
              maxLength={32}
              minLength={4}
              name="referenceId"
              placeholder="ERR-XXXXXXXXXX"
              defaultValue={filters.data.referenceId ?? ''}
            />
          </label>
          <button
            className="min-h-12 rounded-md border border-brand bg-brand px-space-4 text-body-strong text-on-brand focus-visible:outline-2 focus-visible:outline-focus"
            type="submit"
          >
            Look Up
          </button>
        </form>
      </Card>
      <Card title="Filters">
        <form
          action="/developer/errors"
          className="grid gap-space-3 medium:grid-cols-2 expanded:grid-cols-4"
          method="get"
        >
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="error-society"
          >
            Society
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.societyId ?? ''}
              id="error-society"
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
            htmlFor="error-module"
          >
            Module
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.moduleKey ?? ''}
              id="error-module"
              name="moduleKey"
            >
              <option value="">All modules</option>
              {MODULE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {MODULE_REGISTRY[key].name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="error-severity"
          >
            Severity
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.severity ?? ''}
              id="error-severity"
              name="severity"
            >
              <option value="">All severities</option>
              {errorSeverities.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="error-status"
          >
            Status
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.status ?? ''}
              id="error-status"
              name="status"
            >
              <option value="">All statuses</option>
              {errorStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="error-source"
          >
            Source
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.source ?? ''}
              id="error-source"
              name="source"
            >
              <option value="">All sources</option>
              {errorSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="error-user"
          >
            User ID
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.userId ?? ''}
              id="error-user"
              name="userId"
              type="text"
            />
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="error-from"
          >
            From (IST)
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.from ?? ''}
              id="error-from"
              name="from"
              type="date"
            />
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="error-before"
          >
            Before (IST, exclusive)
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.before ?? ''}
              id="error-before"
              name="before"
              type="date"
            />
          </label>
          <label
            className="grid gap-space-1 text-body-strong medium:col-span-2"
            htmlFor="error-text"
          >
            Message contains
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              defaultValue={filters.data.text ?? ''}
              id="error-text"
              maxLength={60}
              minLength={2}
              name="text"
              type="search"
            />
          </label>
          <div className="flex flex-wrap gap-space-2 medium:col-span-2 expanded:col-span-4">
            <button
              className="min-h-12 rounded-md border border-brand bg-brand px-space-4 text-body-strong text-on-brand focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              Apply Filters
            </button>
            <Link
              className="inline-flex min-h-12 items-center rounded-md border border-rule-strong px-space-4 text-body-strong text-ink"
              href="/developer/errors"
            >
              Clear Filters
            </Link>
          </div>
        </form>
      </Card>
      <Card title={`${result.total} error records`}>
        <ErrorList rows={result.rows} societyNames={societyNames} />
        {result.total > filters.data.pageSize ? (
          <QueryPagination
            filters={queryFilters}
            href="/developer/errors"
            page={filters.data.page}
            pageSize={filters.data.pageSize}
            total={result.total}
          />
        ) : null}
      </Card>
    </section>
  );
}
