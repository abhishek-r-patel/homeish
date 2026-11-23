// List P46 official elections available to active resident members.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { PollRouteState } from '@/components/poll/shared';
import { getPollMemberElectionList } from '@/core/poll/election-operations';
import { loadPollPage } from '@/core/poll/page-access';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Official elections | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentPollElectionsPage() {
  const locale = await getRequestLocale();
  const result = await loadPollPage(['resident'], getPollMemberElectionList);
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/polls"
        retryHref="/polls/elections"
      />
    );
  }
  const t = (source: string) => translateMessage(locale, source);
  return (
    <section className="grid gap-space-5">
      <h1 className="text-title font-semibold">{t('Official elections')}</h1>
      <Card title={t('Elections')}>
        {result.data.elections.length ? (
          <ul className="grid gap-space-3">
            {result.data.elections.map((election) => (
              <li
                key={election.id}
                className="rounded-md border border-rule p-space-3"
              >
                <Link
                  className="grid text-brand underline"
                  href={`/polls/elections/${election.id}`}
                >
                  <span className="font-semibold">{election.title}</span>
                  <span className="text-caption text-ink-muted">
                    {t(election.legal_type)} · {t(election.stage)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No official elections are available.')}</p>
        )}
      </Card>
    </section>
  );
}
