// Let a listed resident nominate, vote, raise a dispute and read declared results.
import { Card } from '@/components/ui/data-display';
import { PollRouteState } from '@/components/poll/shared';
import {
  PollElectionBallotForm,
  PollElectionNominationForm,
  PollElectionNominationList,
  PollElectionPostChoiceForm,
} from '@/components/poll/election-resident';
import { PollElectionDisputeForm } from '@/components/poll/election-dispute';
import { getPollMemberElection } from '@/core/poll/election-operations';
import { loadPollPage } from '@/core/poll/page-access';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Official election | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentPollElectionPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const { electionId } = await params;
  const result = await loadPollPage(['resident'], () =>
    getPollMemberElection(electionId),
  );
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/polls/elections"
        retryHref={`/polls/elections/${electionId}`}
      />
    );
  }
  const election = result.data;
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const ownNominations = election.nominations.filter(
    (nomination) => nomination.candidate_user_id === election.actor_id,
  );
  const winningElsewhere = election.results.flatMap((post) =>
    post.winners
      .filter((winner) => winner.candidate_user_id === election.actor_id)
      .map(() => ({ postId: post.post_id, name: post.post_name })),
  );
  return (
    <section className="grid gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <p className="text-caption text-ink-muted">
          {t('Official election')} · {t(election.legal_type)}
        </p>
        <h1 className="text-title font-semibold">{election.title}</h1>
        <p>
          {t('Stage')}: {t(election.stage)}
        </p>
      </header>

      {election.my_unit_id && election.stage === 'nominations_open' ? (
        <Card title={t('Nominate yourself')}>
          <PollElectionNominationForm election={election} />
        </Card>
      ) : null}
      {ownNominations.length ? (
        <Card title={t('Your nominations')}>
          <PollElectionNominationList election={election} />
        </Card>
      ) : null}
      {election.my_unit_id && election.stage === 'voting' ? (
        <Card
          title={
            election.my_unit_has_voted
              ? t('Your unit has voted')
              : t('Secret ballot')
          }
        >
          {election.my_unit_has_voted ? (
            <p>
              {t('Your unit’s ballot is submitted. Choices are not shown.')}
            </p>
          ) : (
            <PollElectionBallotForm election={election} />
          )}
        </Card>
      ) : null}
      {winningElsewhere.length > 1 && election.stage === 'declared' ? (
        <Card title={t('Choose which post to keep')}>
          <p>{t('You were elected to more than one post.')}</p>
          <PollElectionPostChoiceForm
            election={election}
            candidateUserId={election.actor_id}
          />
        </Card>
      ) : null}
      {['declared', 'closed'].includes(election.stage) ? (
        <Card title={t('Declared results')}>
          {election.results.map((post) => (
            <div key={post.post_id} className="mb-space-4">
              <h2 className="font-semibold">{post.post_name}</h2>
              <ul className="grid gap-space-1">
                {post.tallies?.map((tally) => (
                  <li
                    key={`${post.post_id}-${tally.candidate_user_id ?? 'nota'}`}
                  >
                    {tally.candidate_name} · {tally.tally}
                  </li>
                ))}
              </ul>
              {post.winners.length ? (
                <p className="mt-space-2">
                  {t('Winner')}:{' '}
                  {post.winners
                    .map((winner) => winner.candidate_name)
                    .join(', ')}
                </p>
              ) : null}
            </div>
          ))}
          <p>
            {t('Turnout')}: {election.participation_count} /{' '}
            {election.voter_count}
          </p>
          {election.outside_results.length ? (
            <div className="mt-space-3">
              <h2 className="font-semibold">
                {t('Recorded result — held outside the app')}
              </h2>
              <ul className="grid gap-space-1">
                {election.outside_results.map((result) => (
                  <li key={result.id}>
                    {result.winner_name}
                    {result.votes_count === null
                      ? ''
                      : ` · ${result.votes_count} ${t('votes')}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}
      {election.my_unit_id &&
      ['declared', 'closed'].includes(election.stage) ? (
        <Card title={t('Disputes')}>
          <p>
            {t('The dispute window lasts {days} day(s).', {
              days: election.dispute_window_days,
            })}
          </p>
          {election.disputes.map((dispute) => (
            <div key={dispute.id} className="grid gap-space-1">
              <p>
                {t(dispute.status)} · {dispute.resolution_note ?? ''}
              </p>
              {dispute.file_url ? (
                <a className="text-brand underline" href={dispute.file_url}>
                  {t('Open private evidence')}
                </a>
              ) : null}
            </div>
          ))}
          <PollElectionDisputeForm election={election} />
        </Card>
      ) : null}
    </section>
  );
}
