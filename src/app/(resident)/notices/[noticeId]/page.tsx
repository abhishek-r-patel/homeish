// Resident notice detail; opening it records a read receipt.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Card } from '@/components/ui/data-display';
import {
  NoticeStatusChips,
  noticeDateTime,
} from '@/components/notices/notice-list-item';
import { getNoticeDetail, markNoticeRead } from '@/core/notices/operations';

export const metadata = {
  title: 'Notice | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentNoticeDetailPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
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
          Back to notices
        </Link>
        <h1 className="break-words text-title font-semibold">{notice.title}</h1>
        <NoticeStatusChips notice={notice} />
        <p className="text-body text-ink-muted">
          {notice.author_name ?? 'Society office'} ·{' '}
          {noticeDateTime(notice.created_at)}
          {notice.edited_at
            ? ` · Edited ${noticeDateTime(notice.edited_at)}`
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
              View attachment
            </a>
          ) : null}
          {notice.expires_at ? (
            <p className="text-caption text-ink-muted">
              Shown until {noticeDateTime(notice.expires_at)}
            </p>
          ) : null}
        </div>
      </Card>
      {canSeeAdminWorkspace ? (
        <Link
          className="text-body text-brand underline"
          href={`/admin/notices/${notice.id}`}
        >
          Open in notice management
        </Link>
      ) : null}
    </section>
  );
}
