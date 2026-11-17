// Resident notice board: pinned notices first, then the newest.
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

export default async function ResidentNoticesPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const board = await getNoticeBoard('current');

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="flex flex-wrap items-end justify-between gap-space-3">
        <div className="grid gap-space-2">
          <h1 className="text-title font-semibold">{t('Notice board')}</h1>
          <p className="text-body text-ink-muted">
            {t('Announcements from your society office and committee.')}
          </p>
        </div>
        {board.canCreate ? (
          <Link
            className="inline-flex min-h-12 items-center rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
            href="/admin/notices"
          >
            {t('Manage notices')}
          </Link>
        ) : null}
      </header>
      {board.notices.length === 0 ? (
        <EmptyState
          description={t('Notices from your society will appear here.')}
          title={t('No notices right now')}
        />
      ) : (
        <ul className="grid gap-space-3">
          {board.notices.map((notice) => (
            <NoticeListItem
              locale={locale}
              href={`/notices/${notice.id}`}
              key={notice.id}
              notice={notice}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
