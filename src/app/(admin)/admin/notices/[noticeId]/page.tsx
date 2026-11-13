// Manager view of one notice with its reach, read count and controls.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Card } from '@/components/ui/data-display';
import { NoticeManageControls } from '@/components/notices/manage-controls';
import {
  NoticeStatusChips,
  noticeAudienceLabel,
  noticeDateTime,
} from '@/components/notices/notice-list-item';
import { getNoticeDetail } from '@/core/notices/operations';

export const metadata = {
  title: 'Notice | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminNoticeDetailPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  if (!z.uuid().safeParse(noticeId).success) notFound();
  const { notice, attachmentUrl } = await getNoticeDetail(noticeId);

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-body text-brand underline" href="/admin/notices">
          Back to notices
        </Link>
        <h1 className="break-words text-title font-semibold">{notice.title}</h1>
        <NoticeStatusChips notice={notice} />
        <p className="text-body text-ink-muted">
          {notice.author_name ?? 'Society office'} · Published{' '}
          {noticeDateTime(notice.created_at)}
          {notice.edited_at
            ? ` · Edited ${noticeDateTime(notice.edited_at)}`
            : ''}
        </p>
      </header>
      <Card className="min-w-0" title="Reach">
        <dl className="grid gap-space-2 text-body">
          <div className="flex flex-wrap gap-space-2">
            <dt className="text-body-strong">Audience:</dt>
            <dd>{noticeAudienceLabel(notice)}</dd>
          </div>
          <div className="flex flex-wrap gap-space-2">
            <dt className="text-body-strong">Read by:</dt>
            <dd>
              {notice.read_count ?? 0}
              {notice.audience_count !== undefined
                ? ` of ${notice.audience_count} residents`
                : ''}
            </dd>
          </div>
          <div className="flex flex-wrap gap-space-2">
            <dt className="text-body-strong">Expires:</dt>
            <dd>
              {notice.expires_at ? noticeDateTime(notice.expires_at) : 'Never'}
            </dd>
          </div>
        </dl>
      </Card>
      <Card className="min-w-0" title="Notice">
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
        </div>
      </Card>
      {notice.can_manage ? (
        <NoticeManageControls
          noticeId={notice.id}
          pinned={notice.pinned}
          withdrawn={notice.status === 'withdrawn'}
        />
      ) : (
        <p className="text-body text-ink-muted">
          Only the author or an administrator can change this notice.
        </p>
      )}
    </section>
  );
}
