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
  noticeDay,
} from '@/components/notices/notice-list-item';
import { NoticePlanForm } from '@/components/notices/plan-form';
import { getNoticeDetail } from '@/core/notices/operations';
import type {
  NoticePlanningStatus,
  NoticePriority,
} from '@/core/notices/validation';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

const PLANNING_STATUS_LABELS: Record<NoticePlanningStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  posted: 'Posted',
  removed: 'Removed',
};

const PRIORITY_LABELS: Record<NoticePriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const metadata = {
  title: 'Notice | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminNoticeDetailPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const { noticeId } = await params;
  if (!z.uuid().safeParse(noticeId).success) notFound();
  const { notice, attachmentUrl } = await getNoticeDetail(noticeId);

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-body text-brand underline" href="/admin/notices">
          {t('Back to notices')}
        </Link>
        <h1 className="break-words text-title font-semibold">{notice.title}</h1>
        <NoticeStatusChips notice={notice} />
        <p className="text-body text-ink-muted">
          {notice.author_name ?? t('Society office')} ·{' '}
          {notice.published_at
            ? `${t('Published')} ${noticeDateTime(notice.published_at, locale)}`
            : notice.status === 'scheduled' && notice.scheduled_for
              ? t('Posts on {date}', {
                  date: noticeDay(notice.scheduled_for, locale),
                })
              : `${t('Created')} ${noticeDateTime(notice.created_at, locale)}`}
          {notice.edited_at
            ? ` · ${t('Edited')} ${noticeDateTime(notice.edited_at, locale)}`
            : ''}
        </p>
      </header>
      <Card className="min-w-0" title={t('Reach')}>
        <dl className="grid gap-space-2 text-body">
          <div className="flex flex-wrap gap-space-2">
            <dt className="text-body-strong">{t('Planning status:')}</dt>
            <dd>{t(PLANNING_STATUS_LABELS[notice.planning_status])}</dd>
          </div>
          <div className="flex flex-wrap gap-space-2">
            <dt className="text-body-strong">{t('Audience:')}</dt>
            <dd>{noticeAudienceLabel(notice, locale)}</dd>
          </div>
          <div className="flex flex-wrap gap-space-2">
            <dt className="text-body-strong">{t('Read by:')}</dt>
            <dd>
              {notice.audience_count !== undefined
                ? t('{read} of {total} residents', {
                    read: notice.read_count ?? 0,
                    total: notice.audience_count,
                  })
                : (notice.read_count ?? 0)}
            </dd>
          </div>
          <div className="flex flex-wrap gap-space-2">
            <dt className="text-body-strong">{t('Expires:')}</dt>
            <dd>
              {notice.expires_at
                ? noticeDateTime(notice.expires_at, locale)
                : t('Never')}
            </dd>
          </div>
        </dl>
      </Card>
      <Card className="min-w-0" title={t('Notice')}>
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
        </div>
      </Card>
      {notice.can_manage ? (
        <>
          <Card className="min-w-0" title={t('Planning')}>
            <NoticePlanForm noticeId={notice.id} plan={notice.plan} />
          </Card>
          <NoticeManageControls
            noticeId={notice.id}
            pinned={notice.pinned}
            status={notice.status}
            updatedAt={notice.updated_at}
          />
        </>
      ) : (
        <>
          {notice.plan ? (
            <Card className="min-w-0" title={t('Planning')}>
              <dl className="grid gap-space-2 text-body">
                {(
                  [
                    ['Prepared by:', notice.plan.prepared_by],
                    ['Notice board location:', notice.plan.display_location],
                    [
                      'Priority:',
                      notice.plan.priority
                        ? t(PRIORITY_LABELS[notice.plan.priority])
                        : null,
                    ],
                    ['Next action:', notice.plan.next_action],
                    [
                      'Next action date:',
                      notice.plan.next_action_on
                        ? noticeDay(notice.plan.next_action_on, locale)
                        : null,
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div className="flex flex-wrap gap-space-2" key={label}>
                    <dt className="text-body-strong">{t(label)}</dt>
                    <dd>{value ?? t('Not set')}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
          <p className="text-body text-ink-muted">
            {t('Only the author or an administrator can change this notice.')}
          </p>
        </>
      )}
    </section>
  );
}
