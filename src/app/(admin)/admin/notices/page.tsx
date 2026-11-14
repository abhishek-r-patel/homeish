// Administration and committee workspace for publishing and tracking notices.
import Link from 'next/link';
import { EmptyState } from '@/components/ui/feedback';
import { NoticeListItem } from '@/components/notices/notice-list-item';
import { getNoticeBoard } from '@/core/notices/operations';

export const metadata = {
  title: 'Notices | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.tab === 'archive' ? 'archive' : 'current';
  const board = await getNoticeBoard(view);

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="flex flex-wrap items-end justify-between gap-space-3">
        <div className="grid gap-space-2">
          <h1 className="text-title font-semibold">Notice board</h1>
          <p className="text-body text-ink-muted">
            Publish announcements to residents and see how many have read them.
          </p>
        </div>
        <Link
          className="inline-flex min-h-12 items-center rounded-md bg-brand px-space-4 font-semibold text-on-brand focus-visible:outline-2 focus-visible:outline-focus"
          href="/admin/notices/new"
        >
          New notice
        </Link>
      </header>
      <nav aria-label="Notice board sections">
        <ul className="flex gap-space-4 border-b border-rule">
          <li>
            <Link
              aria-current={view === 'current' ? 'page' : undefined}
              className="inline-flex min-h-12 items-center text-body-strong underline-offset-4 hover:underline"
              href="/admin/notices"
            >
              Current
            </Link>
          </li>
          <li>
            <Link
              aria-current={view === 'archive' ? 'page' : undefined}
              className="inline-flex min-h-12 items-center text-body-strong underline-offset-4 hover:underline"
              href="/admin/notices?tab=archive"
            >
              Archive
            </Link>
          </li>
        </ul>
      </nav>
      {board.notices.length === 0 ? (
        <EmptyState
          description={
            view === 'archive'
              ? 'Expired and withdrawn notices will appear here.'
              : 'Publish a notice to keep residents informed.'
          }
          title={view === 'archive' ? 'No archived notices' : 'No notices yet'}
        />
      ) : (
        <ul className="grid gap-space-3">
          {board.notices.map((notice) => (
            <NoticeListItem
              href={`/admin/notices/${notice.id}`}
              key={notice.id}
              manager
              notice={notice}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
