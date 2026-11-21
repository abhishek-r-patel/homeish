// List asynchronous and completed jobs for the active society.
import { JobList } from '@/components/structure/job-list';
import { QueryPagination } from '@/components/developer/query-pagination';
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { pageSchema } from '@/core/developer/console';
import { listSocietyJobs } from '@/core/jobs/operations';
import { formatLocalizedNumber } from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Jobs | Homeish',
  robots: { index: false, follow: false },
};

type JobListPageProps = {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export default async function JobsPage({ searchParams }: JobListPageProps) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const query = await searchParams;
  const parsedPage = pageSchema.safeParse({
    page: query.page ?? '1',
    pageSize: query.pageSize ?? '25',
  });
  if (!parsedPage.success) {
    return (
      <ErrorPanel
        message={t('Choose a valid page and row count.')}
        title={t('Jobs could not be opened')}
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
        <h1 className="text-title font-semibold">{t('Jobs')}</h1>
        <p className="text-body text-ink-muted">
          {t('Review imports and background work for this society.')}
        </p>
      </header>
      <Card
        title={t('Recent jobs')}
        description={t(result.total === 1 ? '{count} job' : '{count} jobs', {
          count: formatLocalizedNumber(result.total, locale),
        })}
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
