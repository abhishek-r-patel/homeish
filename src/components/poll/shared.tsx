// Share Polls & Voting status labels, result projections and route states.
'use client';
import Link from 'next/link';
import { useUiTranslator } from '@/components/ui/language';
import {
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';
import { StatusChip } from '@/components/ui/data-display';
import { EmptyState, ErrorPanel } from '@/components/ui/feedback';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import { projectPollResults } from '@/core/poll/results';
import type {
  PollParticipation,
  PollResults,
  PollStatus,
} from '@/core/poll/validation';

export type PollRouteStateKind = 'disabled' | 'denied' | 'error' | 'not-found';

export function formatPollDateTime(
  value: string | null,
  locale: Locale | null = null,
) {
  if (!value) return translateMessage(locale ?? 'en', 'Not set');
  return formatLocalizedDateTime(new Date(value), locale ?? 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export function PollStatus({ status }: { status: PollStatus }) {
  return <StatusChip status={`poll.${status}`} />;
}

export function PollRouteState({
  kind,
  returnHref,
  retryHref,
  message,
  referenceId,
}: {
  kind: PollRouteStateKind;
  returnHref: string;
  retryHref?: string;
  message?: string;
  referenceId?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (kind === 'disabled') {
    return (
      <ModuleDisabledPage embedded moduleKey="poll" returnHref={returnHref} />
    );
  }
  if (kind === 'denied') {
    return (
      <EmptyState
        title={t('You do not have access to this page')}
        description={t('Return to your Homeish home page.')}
        action={
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href={returnHref}
          >
            {t('Back to Home')}
          </Link>
        }
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        title={t('We cannot find this poll')}
        description={t(
          'It may have been removed or may no longer be visible to you.',
        )}
        action={
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href={returnHref}
          >
            {t('Back to Polls')}
          </Link>
        }
      />
    );
  }
  return (
    <ErrorPanel
      title={t('Something went wrong')}
      message={
        message
          ? translateFeedback(message)
          : t('We could not load this poll. Refresh the page and try again.')
      }
      referenceId={referenceId}
      action={
        <div className="flex flex-wrap gap-space-3">
          {retryHref ? (
            <Link
              className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
              href={retryHref}
            >
              {t('Retry')}
            </Link>
          ) : null}
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href={returnHref}
          >
            {t('Back')}
          </Link>
        </div>
      }
    />
  );
}

export function PollResultsView({ results }: { results: PollResults }) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const percentage = (value: number | null) =>
    value === null
      ? t('Not available')
      : `${formatLocalizedNumber(value, locale ?? 'en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const turnout = (
    submitted: number,
    eligible: number,
    percent: number | null,
  ) =>
    t('{submitted} of {eligible} units voted · turnout {percent}', {
      submitted: number(submitted),
      eligible: number(eligible),
      percent: percentage(percent),
    });
  const projection = projectPollResults(results);
  if (projection.votingType === 'public') {
    return (
      <section
        className="grid min-w-0 gap-space-3"
        aria-labelledby="poll-results-title"
      >
        <h2 className="text-subheading" id="poll-results-title">
          {t(results.status === 'active' ? 'Live public results' : 'Results')}
        </h2>
        <p className="text-body text-ink-muted">
          {turnout(
            projection.submitted,
            projection.eligible,
            projection.turnoutPercent,
          )}
        </p>
        {projection.options.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No option totals are available.')}
          </p>
        ) : (
          <ul className="grid gap-space-2">
            {projection.options.map((option) => (
              <li
                className="grid min-w-0 gap-space-1 rounded-md border border-rule p-space-3"
                key={option.id}
              >
                <span className="text-body-strong break-words">
                  {option.label}
                </span>
                <span className="text-caption text-ink-muted">
                  {t(
                    '{count} selections · {submitted} of submitted · {eligible} of eligible',
                    {
                      count: number(option.count),
                      submitted: percentage(option.submittedPercent),
                      eligible: percentage(option.eligiblePercent),
                    },
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {projection.outcome.kind === 'winner' ? (
          <p className="text-body-strong">
            {t('Current leader: {name}', { name: projection.outcome.label })}
          </p>
        ) : projection.outcome.kind === 'tie' ? (
          <p className="text-body-strong">
            {t('Current tie: {names}', {
              names: projection.outcome.labels.join(', '),
            })}
          </p>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No votes have been submitted yet.')}
          </p>
        )}
        {results.status === 'completed' && projection.responses ? (
          <div className="grid gap-space-2">
            <h3 className="text-body-strong">{t('Named responses')}</h3>
            {projection.responses.length === 0 ? (
              <p className="text-body text-ink-muted">
                {t('No named responses remain.')}
              </p>
            ) : (
              <ul className="grid gap-space-2">
                {projection.responses.map((response, index) => {
                  const labels = new Map(
                    (results.options ?? []).map(({ id, label }) => [id, label]),
                  );
                  return (
                    <li
                      className="break-words text-body"
                      key={`${response.unitLabel}-${index}`}
                    >
                      {response.unitLabel} · {response.representativeName} ·{' '}
                      {response.optionIds
                        .map((id) => labels.get(id))
                        .filter((label): label is string => label !== undefined)
                        .join(', ')}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  if (results.status === 'active') {
    return (
      <section
        className="grid gap-space-2"
        aria-labelledby="poll-results-title"
      >
        <h2 className="text-subheading" id="poll-results-title">
          {t('Private election turnout')}
        </h2>
        <p className="text-body text-ink-muted">
          {turnout(
            projection.submitted,
            projection.eligible,
            projection.turnoutPercent,
          )}
        </p>
        <p className="text-caption text-ink-muted">
          {t(
            'Candidate totals and voter names stay hidden until voting is complete.',
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-space-3" aria-labelledby="poll-results-title">
      <h2 className="text-subheading" id="poll-results-title">
        {t('Election results')}
      </h2>
      <p className="text-body text-ink-muted">
        {turnout(
          projection.submitted,
          projection.eligible,
          projection.turnoutPercent,
        )}
      </p>
      {projection.offices.map((office) => (
        <div className="grid gap-space-2" key={office.id}>
          <h3 className="text-body-strong">{office.name}</h3>
          <ul className="grid gap-space-1">
            {office.candidates.map((candidate) => (
              <li className="text-body" key={candidate.id}>
                {t(
                  '{name}: {count} · {submitted} of submitted · {eligible} of eligible',
                  {
                    name: candidate.name,
                    count: number(candidate.count),
                    submitted: percentage(candidate.submittedPercent),
                    eligible: percentage(candidate.eligiblePercent),
                  },
                )}
              </li>
            ))}
            <li className="text-body">
              {t(
                '{name}: {count} · {submitted} of submitted · {eligible} of eligible',
                {
                  name: t('None of the above'),
                  count: number(office.notaCount),
                  submitted: percentage(office.notaSubmittedPercent),
                  eligible: percentage(office.notaEligiblePercent),
                },
              )}
            </li>
          </ul>
          {office.outcome.kind === 'winner' ? (
            <p className="text-body-strong">
              {t('Winner: {name}', { name: office.outcome.name })}
            </p>
          ) : office.outcome.kind === 'tie' ? (
            <p className="text-body-strong">
              {t('Tie: {names}', { names: office.outcome.names.join(', ') })}
            </p>
          ) : (
            <p className="text-body text-ink-muted">
              {t(
                'No candidate received a vote. None of the above does not win.',
              )}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

export function PollParticipationView({
  participation,
  committeeView,
  status,
}: {
  participation: PollParticipation;
  committeeView: boolean;
  status: PollStatus;
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <section
      className="grid gap-space-3"
      aria-labelledby="poll-participation-title"
    >
      <h2 className="text-subheading" id="poll-participation-title">
        {t(
          committeeView && participation.units === null
            ? 'Turnout'
            : 'Voting units',
        )}
      </h2>
      <p className="text-body text-ink-muted">
        {t('{submitted} of {eligible} units have voted.', {
          submitted: formatLocalizedNumber(
            participation.submitted,
            locale ?? 'en',
          ),
          eligible: formatLocalizedNumber(
            participation.eligible,
            locale ?? 'en',
          ),
        })}
      </p>
      {participation.units ? (
        <ul className="grid gap-space-2">
          {participation.units.map((unit) => (
            <li
              className="flex flex-wrap items-center justify-between gap-space-2 border-b border-rule pb-space-2"
              key={unit.unitId}
            >
              <span className="min-w-0 break-words">
                {unit.unitLabel} · {unit.representativeName}
              </span>
              <span className="text-caption text-ink-muted">
                {t(unit.submitted ? 'Voted' : 'Not voted')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-ink-muted">
          {t(
            status === 'active'
              ? 'Individual participation is hidden until voting is complete.'
              : status === 'completed'
                ? 'Individual participation records are no longer retained. Aggregate results remain available.'
                : 'Individual participation is not available for this cancelled poll.',
          )}
        </p>
      )}
    </section>
  );
}
