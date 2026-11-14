// Summarize a notice in resident and manager lists.
import Link from 'next/link';
import { StatusChip } from '@/components/ui/data-display';
import type { Notice } from '@/core/notices/validation';

export function noticeDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function noticeAudienceLabel(notice: Notice) {
  if (notice.audience === 'owners') return 'Owners';
  if (notice.audience === 'blocks') {
    return notice.blocks.map(({ name }) => name).join(', ') || 'Chosen blocks';
  }
  return 'All residents';
}

export function NoticeStatusChips({
  notice,
  showUnread = false,
}: {
  notice: Notice;
  showUnread?: boolean;
}) {
  return (
    <span className="flex flex-wrap gap-space-1">
      {notice.status === 'withdrawn' ? (
        <StatusChip status="notice.withdrawn" />
      ) : null}
      {notice.status === 'published' && notice.is_expired ? (
        <StatusChip status="notice.expired" />
      ) : null}
      {notice.pinned ? <StatusChip status="notice.pinned" /> : null}
      {notice.edited_at ? <StatusChip status="notice.edited" /> : null}
      {showUnread && !notice.has_read ? (
        <StatusChip status="notice.unread" />
      ) : null}
    </span>
  );
}

export function NoticeListItem({
  href,
  manager = false,
  notice,
}: {
  href: string;
  manager?: boolean;
  notice: Notice;
}) {
  return (
    <li
      className={`min-w-0 rounded-md border bg-surface p-space-4 ${notice.pinned ? 'border-brand' : 'border-rule'}`}
    >
      <Link
        className="grid gap-space-2 focus-visible:outline-2 focus-visible:outline-focus"
        href={href}
      >
        <span className="flex flex-wrap items-center justify-between gap-space-2">
          <span className="min-w-0 break-words text-subheading font-semibold">
            {notice.title}
          </span>
          <NoticeStatusChips notice={notice} showUnread={!manager} />
        </span>
        <span className="line-clamp-2 whitespace-pre-line text-body text-ink-muted">
          {notice.body}
        </span>
        <span className="text-caption text-ink-muted">
          {notice.author_name ?? 'Society office'} ·{' '}
          {noticeDateTime(notice.created_at)}
          {manager ? ` · ${noticeAudienceLabel(notice)}` : ''}
          {manager && notice.read_count !== null
            ? ` · Read by ${notice.read_count}`
            : ''}
          {notice.attachment_path ? ' · Attachment' : ''}
        </span>
      </Link>
    </li>
  );
}
