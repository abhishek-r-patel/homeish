// List asynchronous and completed jobs for the active society.
import { JobList } from '@/components/structure/job-list';
import { QueryPagination } from '@/components/developer/query-pagination';
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { pageSchema } from '@/core/developer/console';
import { listSocietyJobs } from '@/core/jobs/operations';

export const metadata = {
  title: 'Jobs | Homeish',
  robots: { index: false, follow: false },
};

type JobListPageProps = {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export default async function JobsPage({ searchParams }: JobListPageProps) {
  const query = await searchParams;
  const parsedPage = pageSchema.safeParse({
    page: query.page ?? '1',
    pageSize: query.pageSize ?? '25',
  });
  if (!parsedPage.success) {
    return (
      <ErrorPanel
        message="Choose a valid page and row count."
        title="Jobs could not be opened"
      />
    );
  }
  const result = await listSocietyJobs(
    parsedPage.data.page,
    parsedPage.data.pageSize,
  );
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Jobs</h1>
        <p className="text-body text-ink-muted">
          Review imports and background work for this society.
        </p>
      </header>
      <Card
        title="Recent jobs"
        description={`${result.total} job${result.total === 1 ? '' : 's'}`}
      >
        <JobList rows={result.rows} />
        <div className="mt-space-4">
          <QueryPagination
            filters={{}}
            href="/admin/jobs"
            page={parsedPage.data.page}
            pageSize={parsedPage.data.pageSize}
            total={result.total}
          />
        </div>
      </Card>
    </section>
  );
}
