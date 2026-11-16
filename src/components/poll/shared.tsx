// Share Polls & Voting status labels, result projections and route states.
import Link from 'next/link';
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

export function formatPollDateTime(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
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
  if (kind === 'disabled') {
    return (
      <ModuleDisabledPage embedded moduleKey="poll" returnHref={returnHref} />
    );
  }
  if (kind === 'denied') {
    return (
      <EmptyState
        title="You do not have access to this page"
        description="Return to your Homeish home page."
        action={
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href={returnHref}
          >
            Back to Home
          </Link>
        }
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        title="We cannot find this poll"
        description="It may have been removed or may no longer be visible to you."
        action={
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href={returnHref}
          >
            Back to Polls
          </Link>
        }
      />
    );
  }
  return (
    <ErrorPanel
      title="Something went wrong"
      message={
        message ??
        'We could not load this poll. Refresh the page and try again.'
      }
      referenceId={referenceId}
      action={
        <div className="flex flex-wrap gap-space-3">
          {retryHref ? (
            <Link
              className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
              href={retryHref}
            >
              Retry
            </Link>
          ) : null}
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href={returnHref}
          >
            Back
          </Link>
        </div>
      }
    />
  );
}

function percentage(value: number | null) {
  return value === null ? 'Not available' : `${value.toFixed(1)}%`;
}

export function PollResultsView({ results }: { results: PollResults }) {
  const projection = projectPollResults(results);
  if (projection.votingType === 'public') {
    return (
      <section
        className="grid min-w-0 gap-space-3"
        aria-labelledby="poll-results-title"
      >
        <h2 className="text-subheading" id="poll-results-title">
          {results.status === 'active' ? 'Live public results' : 'Results'}
        </h2>
        <p className="text-body text-ink-muted">
          {projection.submitted} of {projection.eligible} units voted · turnout{' '}
          {percentage(projection.turnoutPercent)}
        </p>
        {projection.options.length === 0 ? (
          <p className="text-body text-ink-muted">
            No option totals are available.
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
                  {option.count} selections ·{' '}
                  {percentage(option.submittedPercent)} of submitted ·{' '}
                  {percentage(option.eligiblePercent)} of eligible
                </span>
              </li>
            ))}
          </ul>
        )}
        {projection.outcome.kind === 'winner' ? (
          <p className="text-body-strong">
            Current leader: {projection.outcome.label}
          </p>
        ) : projection.outcome.kind === 'tie' ? (
          <p className="text-body-strong">
            Current tie: {projection.outcome.labels.join(', ')}
          </p>
        ) : (
          <p className="text-body text-ink-muted">
            No votes have been submitted yet.
          </p>
        )}
        {results.status === 'completed' && projection.responses ? (
          <div className="grid gap-space-2">
            <h3 className="text-body-strong">Named responses</h3>
            {projection.responses.length === 0 ? (
              <p className="text-body text-ink-muted">
                No named responses remain.
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
          Private election turnout
        </h2>
        <p className="text-body text-ink-muted">
          {projection.submitted} of {projection.eligible} units voted · turnout{' '}
          {percentage(projection.turnoutPercent)}
        </p>
        <p className="text-caption text-ink-muted">
          Candidate totals and voter names stay hidden until voting is complete.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-space-3" aria-labelledby="poll-results-title">
      <h2 className="text-subheading" id="poll-results-title">
        Election results
      </h2>
      <p className="text-body text-ink-muted">
        {projection.submitted} of {projection.eligible} units voted · turnout{' '}
        {percentage(projection.turnoutPercent)}
      </p>
      {projection.offices.map((office) => (
        <div className="grid gap-space-2" key={office.id}>
          <h3 className="text-body-strong">{office.name}</h3>
          <ul className="grid gap-space-1">
            {office.candidates.map((candidate) => (
              <li className="text-body" key={candidate.id}>
                {candidate.name}: {candidate.count} ·{' '}
                {percentage(candidate.submittedPercent)} of submitted ·{' '}
                {percentage(candidate.eligiblePercent)} of eligible
              </li>
            ))}
            <li className="text-body">
              None of the above: {office.notaCount} ·{' '}
              {percentage(office.notaSubmittedPercent)} of submitted ·{' '}
              {percentage(office.notaEligiblePercent)} of eligible
            </li>
          </ul>
          {office.outcome.kind === 'winner' ? (
            <p className="text-body-strong">Winner: {office.outcome.name}</p>
          ) : office.outcome.kind === 'tie' ? (
            <p className="text-body-strong">
              Tie: {office.outcome.names.join(', ')}
            </p>
          ) : (
            <p className="text-body text-ink-muted">
              No candidate received a vote. None of the above does not win.
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
  return (
    <section
      className="grid gap-space-3"
      aria-labelledby="poll-participation-title"
    >
      <h2 className="text-subheading" id="poll-participation-title">
        {committeeView && participation.units === null
          ? 'Turnout'
          : 'Voting units'}
      </h2>
      <p className="text-body text-ink-muted">
        {participation.submitted} of {participation.eligible} units have voted.
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
                {unit.submitted ? 'Voted' : 'Not voted'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-ink-muted">
          {status === 'active'
            ? 'Individual participation is hidden until voting is complete.'
            : status === 'completed'
              ? 'Individual participation records are no longer retained. Aggregate results remain available.'
              : 'Individual participation is not available for this cancelled poll.'}
        </p>
      )}
    </section>
  );
}
