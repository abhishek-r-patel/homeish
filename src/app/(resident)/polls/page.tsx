// Show the resident's frozen-electorate poll list.
import { PollRouteState } from '@/components/poll/shared';
import { ResidentPollListView } from '@/components/poll/resident';
import { getPollMemberList } from '@/core/poll/operations';
import { loadPollPage } from '@/core/poll/page-access';
import Link from 'next/link';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Polls | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentPollsPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const result = await loadPollPage(['resident'], getPollMemberList);
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/home"
        retryHref="/polls"
      />
    );
  }
  return (
    <>
      <nav aria-label={t('Polls')} className="mb-space-4">
        <Link className="text-brand underline" href="/polls/elections">
          {t('Official elections')}
        </Link>
      </nav>
      <ResidentPollListView polls={result.data} />
    </>
  );
}
