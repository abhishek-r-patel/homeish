// List P46 official elections and expose the society-level controls to admins.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { PollRouteState } from '@/components/poll/shared';
import {
  PollElectionSettingsForm,
  PollOfficialVotingForm,
} from '@/components/poll/election-admin-forms';
import { PollElectionOutsideForm } from '@/components/poll/election-outside-result';
import { getPollElectionList } from '@/core/poll/election-operations';
import {
  getPollElectionDocumentOptions,
  getPollElectionSettings,
} from '@/core/poll/election-setup-operations';
import { loadPollPage } from '@/core/poll/page-access';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Official elections | Homeish',
  robots: { index: false, follow: false },
};

export default async function PollElectionsPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const result = await loadPollPage(
    ['admin', 'committee'],
    getPollElectionList,
  );
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/admin/polls"
        retryHref="/admin/polls/elections"
      />
    );
  }
  const settings = result.data.can_manage
    ? await getPollElectionSettings()
    : null;
  const documents = result.data.can_manage
    ? await getPollElectionDocumentOptions()
    : [];
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-baseline justify-between gap-space-3">
        <h1 className="text-title font-semibold">{t('Official elections')}</h1>
        {result.data.can_manage ? (
          <Link
            className="text-brand underline"
            href="/admin/polls/elections/new"
          >
            {t('Start election')}
          </Link>
        ) : null}
      </div>
      <p className="text-caption text-ink-muted">
        {t(
          'Official elections are separate from everyday polls. Homeish counts and records the result; it does not verify the society’s law, bye-laws or authority.',
        )}
      </p>
      {settings ? (
        <>
          <Card title={t('Official voting')}>
            <PollOfficialVotingForm settings={settings} />
          </Card>
          <Card title={t('Election defaults')}>
            <PollElectionSettingsForm settings={settings} />
          </Card>
          {documents.length ? (
            <Card title={t('Recorded result — held outside the app')}>
              <PollElectionOutsideForm documents={documents} />
            </Card>
          ) : null}
        </>
      ) : null}
      <Card title={t('Elections')}>
        {result.data.elections.length ? (
          <ul className="grid gap-space-3">
            {result.data.elections.map((election) => (
              <li
                key={election.id}
                className="rounded-md border border-rule p-space-3"
              >
                <Link
                  className="grid gap-space-1 text-brand underline"
                  href={`/admin/polls/elections/${election.id}`}
                >
                  <span className="font-semibold">{election.title}</span>
                  <span className="text-caption text-ink-muted">
                    {t('Official election')} · {t(election.legal_type)} ·{' '}
                    {t(election.stage)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No official elections have been started.')}</p>
        )}
      </Card>
    </section>
  );
}
