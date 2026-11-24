// Show the administrator and committee poll workspace.
import Link from 'next/link';
import { PollRouteState } from '@/components/poll/shared';
import { PollAdminListView } from '@/components/poll/admin';
import { getPollAdminList } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { FeatureTabs } from '@/components/home/feature-tabs';
import { getFeatureTabs } from '@/core/home/feature-tabs';

export const metadata = {
  title: 'Polls | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminPollsPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const result = await loadPollPage(['admin', 'committee'], getPollAdminList);
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/admin"
        retryHref="/admin/polls"
      />
    );
  }
  const featureTabs = await getFeatureTabs('meetings-notices');
  return (
    <>
      <FeatureTabs items={featureTabs} />
      {result.data.canManage ? (
        <nav
          aria-label={t('Poll management')}
          className="mb-space-4 flex gap-space-3"
        >
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href="/admin/polls/representatives"
          >
            {t('Voting representatives')}
          </Link>
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href="/admin/polls/settings"
          >
            {t('Poll settings')}
          </Link>
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href="/admin/polls/elections"
          >
            {t('Official elections')}
          </Link>
        </nav>
      ) : null}
      <PollAdminListView workspace={result.data} />
    </>
  );
}
