// Manage a P46 official election without changing everyday P22 polls.
import { Card } from '@/components/ui/data-display';
import { PollRouteState } from '@/components/poll/shared';
import { PollElectionEditorForm } from '@/components/poll/election-admin-forms';
import {
  PollElectionCancelForm,
  PollElectionOfficerForm,
  PollElectionStageForm,
} from '@/components/poll/election-admin-actions';
import {
  PollElectionExpenseForm,
  PollElectionHelpersForm,
  PollElectionScheduleForm,
  PollElectionSourceForm,
} from '@/components/poll/election-admin-sources';
import { PollElectionVotersCard } from '@/components/poll/election-admin-detail';
import { getPollElection } from '@/core/poll/election-operations';
import { loadPollPage } from '@/core/poll/page-access';
import { formatLocalizedCurrency } from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Official election | Homeish',
  robots: { index: false, follow: false },
};

const stages = [
  'planning',
  'nominations_open',
  'scrutiny',
  'candidates_published',
  'voting',
  'counted',
  'declared',
  'closed',
];

export default async function PollElectionAdminPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const locale = await getRequestLocale();
  const { electionId } = await params;
  const result = await loadPollPage(['admin', 'committee'], () =>
    getPollElection(electionId),
  );
  if (result.state) {
    return (
      <PollRouteState
        kind={result.state}
        returnHref="/admin/polls/elections"
        retryHref={`/admin/polls/elections/${electionId}`}
      />
    );
  }
  const election = result.data;
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <p className="text-caption text-ink-muted">
          {t('Official election')} · {t(election.legal_type)}
        </p>
        <h1 className="text-title font-semibold">{election.title}</h1>
        <p>
          {t('Stage')}: {t(election.stage)}
        </p>
        <a
          className="text-brand underline"
          href={`/api/polls/elections/${election.id}/summary?format=pdf`}
        >
          {t('Download election summary PDF')}
        </a>
        <ol className="grid gap-space-1 medium:grid-cols-4">
          {stages.map((stage) => (
            <li
              key={stage}
              className={
                stages.indexOf(stage) <= stages.indexOf(election.stage)
                  ? 'font-semibold'
                  : 'text-ink-muted'
              }
            >
              {t(stage)}
            </li>
          ))}
        </ol>
      </header>

      {election.can_manage && election.stage === 'planning' ? (
        <Card title={t('Election details')}>
          <PollElectionEditorForm election={election} />
        </Card>
      ) : null}
      {election.can_manage &&
      !election.officer?.accepted &&
      !['voting', 'counted', 'closed', 'cancelled', 'declared'].includes(
        election.stage,
      ) ? (
        <div className="grid gap-space-5 medium:grid-cols-2">
          <Card title={t('Next stage')}>
            <PollElectionStageForm election={election} />
          </Card>
          <Card title={t('Cancel election')}>
            <PollElectionCancelForm election={election} />
          </Card>
        </div>
      ) : null}
      <div className="grid gap-space-5 medium:grid-cols-2">
        <Card title={t('Returning officer')}>
          {election.can_manage ? (
            <PollElectionOfficerForm election={election} />
          ) : election.officer ? (
            <p>
              {election.officer.name} ·{' '}
              {election.officer.accepted
                ? t('Confirmed')
                : t('Confirmation pending')}
            </p>
          ) : (
            <p>{t('No returning officer assigned.')}</p>
          )}
        </Card>
        <Card title={t('Assistants and observers')}>
          {election.can_manage ? (
            <PollElectionHelpersForm election={election} />
          ) : null}
          <ul className="mt-space-3 grid gap-space-1">
            {election.helpers.map((helper) => (
              <li key={helper.id}>
                {helper.name} · {helper.role}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title={t('Owner voter list')}>
        {election.can_manage ? (
          <PollElectionVotersCard election={election} />
        ) : (
          <p>{t('{count} listed voters', { count: election.voter_count })}</p>
        )}
      </Card>
      <Card title={t('Advisory schedule — not legal deadlines')}>
        {election.can_manage ? (
          <PollElectionScheduleForm election={election} />
        ) : (
          <ul className="grid gap-space-2">
            {election.activities.map((activity) => (
              <li key={activity.id}>
                {activity.title} · {t(activity.status)}
                {activity.planned_on ? ` · ${activity.planned_on}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-space-5 medium:grid-cols-2">
        <Card title={t('Election sources')}>
          {election.can_manage ? (
            <PollElectionSourceForm election={election} />
          ) : null}
        </Card>
        <Card title={t('Election cost')}>
          <p className="mb-space-3 font-semibold">
            {formatLocalizedCurrency(election.total_cost_paise, locale)}
          </p>
          {election.can_manage ? (
            <PollElectionExpenseForm election={election} />
          ) : null}
          <ul className="mt-space-3 grid gap-space-2">
            {election.expense_links.map((link) => (
              <li key={link.id}>
                {link.spent_on} ·{' '}
                {formatLocalizedCurrency(link.amount_paise, locale)}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title={t('Disputes')}>
        <p>{t('{count} disputes', { count: election.dispute_count })}</p>
      </Card>
      {election.outside_results.length ? (
        <Card title={t('Recorded result — held outside the app')}>
          <ul className="grid gap-space-2">
            {election.outside_results.map((result) => (
              <li key={result.id}>
                {result.winner_name}
                {result.votes_count === null
                  ? ''
                  : ` · ${result.votes_count} ${t('votes')}`}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
