// Resident notice detail; opening it records a read receipt.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Card } from '@/components/ui/data-display';
import { NoticeStatusChips } from '@/components/notices/notice-list-item';
import { getNoticeDetail, markNoticeRead } from '@/core/notices/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';
import { formatLocalizedDateTime } from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';

export const metadata = {
  title: 'Notice | Homeish',
  robots: { index: false, follow: false },
};

function dateTime(value: string, locale: Locale) {
  return formatLocalizedDateTime(new Date(value), locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export default async function ResidentNoticeDetailPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const { noticeId } = await params;
  if (!z.uuid().safeParse(noticeId).success) notFound();
  const { notice, attachmentUrl, canSeeAdminWorkspace } =
    await getNoticeDetail(noticeId);
  if (!notice.has_read && notice.status === 'published') {
    await markNoticeRead(notice.id);
  }

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-body text-brand underline" href="/notices">
          {t('Back to notices')}
        </Link>
        <h1 className="break-words text-title font-semibold">{notice.title}</h1>
        <NoticeStatusChips notice={notice} />
        <p className="text-body text-ink-muted">
          {notice.author_name ?? t('Society office')} ·{' '}
          {dateTime(notice.created_at, locale)}
          {notice.edited_at
            ? ` · ${t('Edited {date}', {
                date: dateTime(notice.edited_at, locale),
              })}`
            : ''}
        </p>
      </header>
      <Card className="min-w-0">
        <div className="grid gap-space-3">
          <p className="whitespace-pre-wrap break-words text-body">
            {notice.body}
          </p>
          {attachmentUrl ? (
            <a
              className="text-body text-brand underline"
              href={attachmentUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t('View attachment')}
            </a>
          ) : null}
          {notice.expires_at ? (
            <p className="text-caption text-ink-muted">
              {t('Shown until {date}', {
                date: dateTime(notice.expires_at, locale),
              })}
            </p>
          ) : null}
        </div>
      </Card>
      {canSeeAdminWorkspace ? (
        <Link
          className="text-body text-brand underline"
          href={`/admin/notices/${notice.id}`}
        >
          {t('Open in notice management')}
        </Link>
      ) : null}
    </section>
  );
}
