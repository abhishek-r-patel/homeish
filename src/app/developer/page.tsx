// List societies and begin new Core Platform setup.
import Link from 'next/link';
import { getDeveloperSocieties, pageSchema } from '@/core/developer/console';
import { SocietyList } from '@/components/developer/society-list';
import { ErrorPanel } from '@/components/ui/feedback';

export const metadata = {
  title: 'Societies | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

type SocietyPageProps = {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export default async function DeveloperHomePage({
  searchParams,
}: SocietyPageProps) {
  const query = await searchParams;
  const parsedPage = pageSchema.safeParse({
    page: query.page ?? '1',
    pageSize: query.pageSize ?? '25',
  });
  if (!parsedPage.success) {
    return (
      <ErrorPanel
        message="The page number or row count is not valid. Choose a valid page and try again."
        title="Society list could not be opened"
      />
    );
  }

  const result = await getDeveloperSocieties(
    parsedPage.data.page,
    parsedPage.data.pageSize,
  );
  return (
    <section className="grid gap-space-5">
      <header className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h1 className="text-title font-semibold">Societies</h1>
          <p className="text-body text-ink-muted">
            Set up each society and its Core Platform access.
          </p>
        </div>
        <div className="flex flex-wrap gap-space-2">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-rule-strong px-space-4 text-body-strong text-ink hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href="/developer/users/erase"
          >
            Erase User
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-brand bg-brand px-space-4 text-body-strong text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href="/developer/societies/new"
          >
            Create Society
          </Link>
        </div>
      </header>
      <SocietyList result={result} />
    </section>
  );
}
