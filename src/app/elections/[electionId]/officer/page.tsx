// Limit an outside returning officer to one assigned P46 election workspace.
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/data-display';
import {
  PollOfficerConfirmation,
  PollOfficerCountControls,
  PollOfficerScrutiny,
} from '@/components/poll/election-officer';
import {
  PollOfficerDisputes,
  PollOfficerResultForms,
} from '@/components/poll/election-officer-results';
import {
  getPollOfficerAssignments,
  getPollOfficerElection,
} from '@/core/poll/election-officer-operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Returning officer | Homeish',
  robots: { index: false, follow: false },
};

export default async function PollOfficerPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const { electionId } = await params;
  const assignments = await getPollOfficerAssignments();
  const assignment = assignments.find(
    (candidate) => candidate.election_id === electionId,
  );
  if (!assignment) notFound();
  const election = await getPollOfficerElection({
    societyId: assignment.society_id,
    electionId,
  });
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <p className="text-caption text-ink-muted">
          {t('Returning officer workspace')}
        </p>
        <h1 className="text-title font-semibold">{election.title}</h1>
        <p>
          {t('Official election')} · {t(election.legal_type)} ·{' '}
          {t(election.stage)}
        </p>
        <a
          className="text-brand underline"
          href={`/api/polls/elections/${election.id}/summary?format=pdf`}
        >
          {t('Download election summary PDF')}
        </a>
        {assignment.access_ends_at ? (
          <p className="text-caption text-ink-muted">
            {t('Access ends at {date}', { date: assignment.access_ends_at })}
          </p>
        ) : null}
      </header>
      {assignment.requires_confirmation ? (
        <Card title={t('Confirm no conflict')}>
          <PollOfficerConfirmation
            election={election}
            societyId={assignment.society_id}
          />
        </Card>
      ) : (
        <>
          {election.stage === 'scrutiny' ? (
            <Card title={t('Nomination scrutiny')}>
              <PollOfficerScrutiny
                election={election}
                societyId={assignment.society_id}
              />
            </Card>
          ) : null}
          <Card title={t('Voting and declaration')}>
            <PollOfficerCountControls
              election={election}
              societyId={assignment.society_id}
            />
          </Card>
          {election.stage === 'counted' ? (
            <Card title={t('Tie and multiple-win decisions')}>
              <PollOfficerResultForms
                election={election}
                societyId={assignment.society_id}
              />
            </Card>
          ) : null}
          <Card title={t('Disputes')}>
            <PollOfficerDisputes
              election={election}
              societyId={assignment.society_id}
            />
          </Card>
          <Card title={t('Election summary')}>
            <p>
              {t('Listed voters')}: {election.voter_count}
            </p>
            <p>
              {t('Units that voted')}: {election.participation_count}
            </p>
            <ul className="mt-space-3 grid gap-space-2">
              {election.results.map((post) => (
                <li key={post.post_id}>
                  {post.post_name}:{' '}
                  {post.winners
                    .map((winner) => winner.candidate_name)
                    .join(', ') || t('Not declared')}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </section>
  );
}
