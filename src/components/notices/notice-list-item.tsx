// Summarize a notice in resident and manager lists.
import Link from 'next/link';
import { StatusChip } from '@/components/ui/data-display';
import type { Notice } from '@/core/notices/validation';
import { formatLocalizedDateTime } from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';

export function noticeDateTime(value: string, locale: Locale = 'en') {
  return formatLocalizedDateTime(new Date(value), locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export function noticeAudienceLabel(notice: Notice, locale: Locale = 'en') {
  const t = (source: string) => translateMessage(locale, source);
  if (notice.audience === 'owners') return t('Owners');
  if (notice.audience === 'blocks') {
    return (
      notice.blocks.map(({ name }) => name).join(', ') || t('Chosen blocks')
    );
  }
  return t('All residents');
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
  locale = 'en',
}: {
  href: string;
  manager?: boolean;
  notice: Notice;
  locale?: Locale;
}) {
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
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
          {notice.author_name ?? t('Society office')} ·{' '}
          {noticeDateTime(notice.created_at, locale)}
          {manager ? ` · ${noticeAudienceLabel(notice, locale)}` : ''}
          {manager && notice.read_count !== null
            ? ` · ${t('Read by {count}', { count: notice.read_count })}`
            : ''}
          {notice.attachment_path ? ` · ${t('Attachment')}` : ''}
        </span>
      </Link>
    </li>
  );
}
