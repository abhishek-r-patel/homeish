// Administration and committee workspace for publishing and tracking notices.
import Link from 'next/link';
import { EmptyState } from '@/components/ui/feedback';
import { NoticeListItem } from '@/components/notices/notice-list-item';
import { getNoticeBoard } from '@/core/notices/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Notices | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const params = await searchParams;
  const view =
    params.tab === 'archive'
      ? 'archive'
      : params.tab === 'planned'
        ? 'planned'
        : 'current';
  const board = await getNoticeBoard(view);
  const tabs = [
    ['current', 'Current', '/admin/notices'],
    ['planned', 'Planned', '/admin/notices?tab=planned'],
    ['archive', 'Archive', '/admin/notices?tab=archive'],
  ] as const;

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="flex flex-wrap items-end justify-between gap-space-3">
        <div className="grid gap-space-2">
          <h1 className="text-title font-semibold">{t('Notice board')}</h1>
          <p className="text-body text-ink-muted">
            {t(
              'Publish announcements to residents and see how many have read them.',
            )}
          </p>
        </div>
        <Link
          className="inline-flex min-h-12 items-center rounded-md bg-brand px-space-4 font-semibold text-on-brand focus-visible:outline-2 focus-visible:outline-focus"
          href="/admin/notices/new"
        >
          {t('New notice')}
        </Link>
      </header>
      <nav aria-label={t('Notice board sections')}>
        <ul className="flex gap-space-4 border-b border-rule">
          {tabs.map(([key, label, href]) => (
            <li key={key}>
              <Link
                aria-current={view === key ? 'page' : undefined}
                className="inline-flex min-h-12 items-center text-body-strong underline-offset-4 hover:underline"
                href={href}
              >
                {t(label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {board.notices.length === 0 ? (
        <EmptyState
          description={
            view === 'archive'
              ? t('Expired and withdrawn notices will appear here.')
              : view === 'planned'
                ? t('Drafts and scheduled notices will appear here.')
                : t('Publish a notice to keep residents informed.')
          }
          title={
            view === 'archive'
              ? t('No archived notices')
              : view === 'planned'
                ? t('No planned notices')
                : t('No notices yet')
          }
        />
      ) : (
        <ul className="grid gap-space-3">
          {board.notices.map((notice) => (
            <NoticeListItem
              locale={locale}
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
