// Show the manager's refresh-safe notice publish or schedule result.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ResultScreen } from '@/components/ui/result-screen';
import {
  noticeAudienceLabel,
  noticeDateTime,
} from '@/components/notices/notice-list-item';
import { getNoticeDetail } from '@/core/notices/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Notice complete | Homeish',
  robots: { index: false, follow: false },
};

export default async function NoticeDonePage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  if (!z.uuid().safeParse(noticeId).success) notFound();
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const { notice } = await getNoticeDetail(noticeId);
  if (!['published', 'scheduled'].includes(notice.status)) notFound();

  const scheduled =
    notice.status === 'scheduled' && notice.scheduled_for !== null;
  const title = scheduled ? t('Notice scheduled') : t('Notice published');
  const outcome = scheduled
    ? t('“{title}” will go out on {date}.', {
        title: notice.title,
        date: noticeDateTime(notice.scheduled_for!, locale),
      })
    : t('“{title}” is now available to the selected audience.', {
        title: notice.title,
      });

  return (
    <ResultScreen
      actions={[
        {
          href: `/admin/notices/${notice.id}`,
          label: t('View notice'),
          primary: true,
        },
        { href: '/admin/notices/new', label: t('Post another') },
        { href: '/admin/notices', label: t('Back to Notices') },
      ]}
      outcome={outcome}
      summary={[
        {
          label: t('Audience'),
          value: noticeAudienceLabel(notice, locale),
        },
        {
          label: t('Reach'),
          value:
            notice.audience_count === undefined
              ? t('Unavailable')
              : t('{count} residents', { count: notice.audience_count }),
        },
        {
          label: scheduled ? t('Posting time') : t('Published'),
          value: noticeDateTime(
            (scheduled ? notice.scheduled_for : notice.published_at)!,
            locale,
          ),
        },
      ]}
      title={title}
    />
  );
}
