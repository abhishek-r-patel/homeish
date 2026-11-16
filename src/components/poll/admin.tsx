// Render the poll-management workspace, lifecycle controls and tenant voting setting.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { z } from 'zod';
import { Card, ListItem } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import {
  DatePicker,
  TimePicker,
  type TimeParts,
} from '@/components/ui/date-time-inputs';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import {
  pollDeadlineExtendInputSchema,
  pollReasonInputSchema,
  pollScheduleInputSchema,
  pollSettingsInputSchema,
  pollVoteInputSchema,
  pollWriteResultSchema,
  type PollAdminList,
  type PollAdminVote,
  type PollParticipation,
  type PollResults,
} from '@/core/poll/validation';
import {
  PollParticipationView,
  PollResultsView,
  PollStatus,
  formatPollDateTime,
} from './shared';

const READINESS_MESSAGES: Readonly<Record<string, string>> = {
  title_missing: 'Add a poll title.',
  closes_at_missing: 'Choose a closing time.',
  closes_at_too_soon: 'The vote must stay open for at least five minutes.',
  closes_at_too_far: 'The closing time must be within one year.',
  opens_at_invalid: 'Choose a valid opening time before closing.',
  options_too_few: 'Add at least two different options.',
  option_limit_invalid: 'Set a valid selection limit.',
  offices_missing: 'Add at least one office.',
  office_without_candidates: 'Every office needs at least one candidate.',
  instructions_missing: 'Add instructions for this private election.',
  electorate_empty: 'No eligible voting units were found.',
};

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '');
}

function timeParts(value: string | null): { date: string; time: TimeParts } {
  if (!value) {
    return {
      date: '',
      time: { hour: '12', minute: '00', period: 'AM' },
    };
  }
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).formatToParts(new Date(value));
  const dateValues = Object.fromEntries(
    dateParts.map(({ type, value: part }) => [type, part]),
  );
  const clockParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).formatToParts(new Date(value));
  const clockValues = Object.fromEntries(
    clockParts.map(({ type, value: part }) => [type, part]),
  );
  const period = clockValues.dayPeriod?.toUpperCase();
  return {
    date: `${dateValues.year}-${dateValues.month}-${dateValues.day}`,
    time: {
      hour: clockValues.hour ?? '12',
      minute: clockValues.minute ?? '00',
      period: period === 'PM' ? 'PM' : 'AM',
    },
  };
}

function combineIstDateTime(date: string, time: TimeParts) {
  if (!date) return null;
  const hour12 = Number(time.hour);
  const hour24 = (hour12 % 12) + (time.period === 'PM' ? 12 : 0);
  const hour = String(hour24).padStart(2, '0');
  return new Date(`${date}T${hour}:${time.minute}:00+05:30`).toISOString();
}

export function PollDateTimePicker({
  id,
  label,
  value,
  fieldName,
  required = false,
}: {
  id: string;
  label: string;
  value: string | null;
  fieldName: string;
  required?: boolean;
}) {
  const initial = timeParts(value);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const combined = combineIstDateTime(date, time);
  return (
    <div className="grid gap-space-2">
      <DatePicker
        id={`${id}-date`}
        label={`${label} date`}
        value={date}
        onChange={setDate}
        required={required}
      />
      <TimePicker
        id={`${id}-time`}
        label={`${label} time`}
        value={time}
        onChange={setTime}
        required={required}
        timeZone="Asia/Kolkata (IST)"
      />
      <input type="hidden" name={fieldName} value={combined ?? ''} />
    </div>
  );
}

export function PollAdminListView({ workspace }: { workspace: PollAdminList }) {
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h1 className="text-title font-semibold">Polls</h1>
          <p className="text-body text-ink-muted">
            Manage society polls and elections. Committee members can review but
            not edit.
          </p>
        </div>
        {workspace.canManage ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-brand px-space-4 text-body-strong text-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href="/admin/polls/new"
          >
            New poll or election
          </Link>
        ) : null}
      </div>
      {workspace.votes.length === 0 ? (
        <EmptyState
          title="No polls yet"
          description={
            workspace.canManage
              ? 'Create a public poll or private election for your society.'
              : 'Your society has not created a poll or election yet.'
          }
          action={
            workspace.canManage ? (
              <Link
                className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
                href="/admin/polls/new"
              >
                Create a poll
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-space-2">
          {workspace.votes.map((vote) => (
            <li key={vote.id}>
              <ListItem
                href={`/admin/polls/${vote.id}`}
                title={
                  <span className="break-words">
                    {vote.title || 'Untitled draft'}
                  </span>
                }
                secondary={`${vote.votingType === 'public' ? 'Public poll' : 'Private election'} · closes ${formatPollDateTime(vote.closesAt)} (IST)`}
                status={`poll.${vote.status}`}
                trailing={
                  vote.eligible === null
                    ? undefined
                    : `${vote.submitted ?? 0} of ${vote.eligible} voted`
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReasonAction({
  action,
  voteId,
  label,
  confirmMessage,
}: {
  action: ModuleFormAction;
  voteId: string;
  label: string;
  confirmMessage: string;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={label}
      confirmMessage={confirmMessage}
      input={(form) =>
        pollReasonInputSchema.parse({
          voteId,
          reason: formText(form, 'reason'),
        })
      }
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label="Reason"
        maxLength={500}
        required
      />
    </ModuleActionForm>
  );
}

function PollLifecycle({
  detail,
  actions,
}: {
  detail: PollAdminVote;
  actions: PollAdminActions;
}) {
  const { vote } = detail;
  if (!detail.canManage) return null;
  if (vote.status === 'draft') {
    return (
      <Card title="Draft actions">
        <div className="grid gap-space-3">
          <Link
            className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            href={`/admin/polls/${vote.id}/edit`}
          >
            Edit draft
          </Link>
          <ModuleActionForm
            action={actions.activate}
            submitLabel="Open voting now"
            submitDisabled={!detail.readiness.ready}
            confirmMessage="Open this poll now? Its voter list will be frozen."
            input={() =>
              pollVoteInputSchema
                .extend({
                  expectedRevision: z.number().int().min(1),
                })
                .parse({
                  voteId: vote.id,
                  expectedRevision: vote.revision,
                })
            }
          >
            <p className="text-caption text-ink-muted">
              Opening freezes eligible units, representatives and tenant voting.
            </p>
          </ModuleActionForm>
          <ModuleActionForm
            action={actions.schedule}
            submitLabel="Schedule opening"
            submitDisabled={!detail.readiness.ready}
            input={(form) => ({
              ...pollScheduleInputSchema.parse({
                voteId: vote.id,
                expectedRevision: vote.revision,
                opensAt: formText(form, 'opensAt'),
              }),
            })}
          >
            <PollDateTimePicker
              id={`schedule-${vote.id}`}
              label="Open voting"
              value={vote.opensAt}
              fieldName="opensAt"
              required
            />
          </ModuleActionForm>
          <ModuleActionForm
            action={actions.deleteDraft}
            submitLabel="Delete draft"
            confirmMessage="Delete this draft and its setup? This cannot be undone."
            input={() =>
              pollVoteInputSchema
                .extend({
                  expectedRevision: z.number().int().min(1),
                })
                .parse({
                  voteId: vote.id,
                  expectedRevision: vote.revision,
                })
            }
          >
            <p className="text-caption text-ink-muted">
              Only a draft can be deleted.
            </p>
          </ModuleActionForm>
        </div>
      </Card>
    );
  }
  if (vote.status === 'scheduled') {
    return (
      <Card title="Scheduled poll actions">
        <div className="grid gap-space-3">
          <ReasonAction
            action={actions.withdraw}
            voteId={vote.id}
            label="Withdraw schedule"
            confirmMessage="Return this poll to draft? The frozen voter list will be cleared."
          />
          <ReasonAction
            action={actions.cancel}
            voteId={vote.id}
            label="Cancel poll"
            confirmMessage="Cancel this scheduled poll? Frozen representatives will be notified."
          />
        </div>
      </Card>
    );
  }
  if (vote.status === 'active') {
    return (
      <Card title="Open poll actions">
        <div className="grid gap-space-3">
          <ModuleActionForm
            action={actions.extendDeadline}
            submitLabel="Extend deadline"
            input={(form) =>
              pollDeadlineExtendInputSchema.parse({
                voteId: vote.id,
                closesAt: formText(form, 'closesAt'),
                reason: formText(form, 'reason'),
              })
            }
          >
            <PollDateTimePicker
              id={`deadline-${vote.id}`}
              label="New closing time"
              value={vote.closesAt}
              fieldName="closesAt"
              required
            />
            <TextAreaInput
              id={`deadline-reason-${vote.id}`}
              name="reason"
              label="Reason for extension"
              maxLength={500}
              required
            />
          </ModuleActionForm>
          <ReasonAction
            action={actions.completeEarly}
            voteId={vote.id}
            label="Complete voting early"
            confirmMessage="Complete voting now? No more ballots can be submitted."
          />
          <ReasonAction
            action={actions.cancel}
            voteId={vote.id}
            label="Cancel poll"
            confirmMessage="Cancel this poll? Frozen representatives will be notified."
          />
        </div>
      </Card>
    );
  }
  return null;
}

export type PollAdminActions = {
  activate: ModuleFormAction;
  schedule: ModuleFormAction;
  withdraw: ModuleFormAction;
  extendDeadline: ModuleFormAction;
  completeEarly: ModuleFormAction;
  cancel: ModuleFormAction;
  deleteDraft: ModuleFormAction;
};

export function PollAdminDetailView({
  detail,
  participation,
  results,
  actions,
}: {
  detail: PollAdminVote;
  participation: PollParticipation | null;
  results: PollResults | null;
  actions: PollAdminActions;
}) {
  const { vote } = detail;
  const committeeView = !detail.canManage;
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link
        className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        href="/admin/polls"
      >
        Back to Polls
      </Link>
      <div className="grid gap-space-2">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">
            {vote.title || 'Untitled draft'}
          </h1>
          <PollStatus status={vote.status} />
        </div>
        <p className="text-body text-ink-muted">
          {vote.votingType === 'public' ? 'Public poll' : 'Private election'} ·
          Opens {formatPollDateTime(vote.opensAt)} · Closes{' '}
          {formatPollDateTime(vote.closesAt)} (IST)
        </p>
        {vote.instructions ? (
          <p className="break-words whitespace-pre-line text-body">
            {vote.instructions}
          </p>
        ) : null}
        {vote.cancellationReason ? (
          <p className="text-body text-ink-muted">
            Cancellation reason: {vote.cancellationReason}
          </p>
        ) : null}
        {vote.completionReason ? (
          <p className="text-body text-ink-muted">
            Completion reason: {vote.completionReason}
          </p>
        ) : null}
      </div>

      {committeeView ? (
        <Card title="Committee view">
          <p className="text-body text-ink-muted">
            You can review this poll and its permitted results. Only
            administrators can change it.
          </p>
        </Card>
      ) : null}

      {vote.status === 'draft' ? (
        <Card title="Readiness">
          {detail.readiness.ready ? (
            <p className="text-body text-success">
              This poll is ready to open.
            </p>
          ) : (
            <ul className="list-disc space-y-space-1 pl-space-5 text-body">
              {detail.readiness.issues.map((issue) => (
                <li key={issue}>
                  {READINESS_MESSAGES[issue] ?? 'Check the poll setup.'}
                </li>
              ))}
            </ul>
          )}
          {detail.electoratePreview ? (
            <div className="mt-space-3 grid gap-space-2">
              <p className="text-body-strong">
                {detail.electoratePreview.eligibleUnits} eligible units
              </p>
              {detail.electoratePreview.unitsWithoutVoter.length ? (
                <p className="text-caption text-ink-muted">
                  Units without an eligible representative:{' '}
                  {detail.electoratePreview.unitsWithoutVoter
                    .map((unit) => unit.unitLabel)
                    .join(', ')}
                  {detail.electoratePreview.unitsWithoutVoter.length >= 200
                    ? ' (list capped)'
                    : ''}
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {vote.status !== 'draft' && vote.status !== 'cancelled' ? (
        <Card title="Frozen voting details">
          <p className="text-body">
            Tenant representatives:{' '}
            {vote.tenantVoting ? 'Allowed' : 'Not allowed'}
          </p>
          <p className="text-caption text-ink-muted">
            These voter and tenant-voting rules were fixed when the poll was
            scheduled or opened.
          </p>
        </Card>
      ) : null}

      {participation ? (
        <Card title="Participation">
          <PollParticipationView
            participation={participation}
            committeeView={committeeView}
            status={vote.status}
          />
        </Card>
      ) : null}
      {results ? (
        <Card title="Results">
          <PollResultsView results={results} />
        </Card>
      ) : null}
      {vote.status === 'completed' ? (
        <Card title="Export results">
          <p className="mb-space-3 text-body text-ink-muted">
            Completed poll reports do not include email addresses. Private
            election exports keep the voter roster separate from choices.
          </p>
          <div className="flex flex-wrap gap-space-3">
            <a
              className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
              href={`/api/polls/${vote.id}/export?format=pdf`}
            >
              Download PDF
            </a>
            <a
              className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
              href={`/api/polls/${vote.id}/export?format=csv`}
            >
              Download CSV
            </a>
          </div>
        </Card>
      ) : null}
      <PollLifecycle detail={detail} actions={actions} />
    </section>
  );
}

export function NewPollView({ action }: { action: ModuleFormAction }) {
  return (
    <section className="grid gap-space-4">
      <Link
        className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        href="/admin/polls"
      >
        Back to Polls
      </Link>
      <h1 className="text-title font-semibold">Create a poll or election</h1>
      <CreatePollDraftForm action={action} votingType="public" />
      <CreatePollDraftForm action={action} votingType="private" />
    </section>
  );
}

function CreatePollDraftForm({
  action,
  votingType,
}: {
  action: ModuleFormAction;
  votingType: 'public' | 'private';
}) {
  const router = useRouter();
  const label =
    votingType === 'public' ? 'New public poll' : 'New private election';
  const description =
    votingType === 'public'
      ? 'Ask residents to choose one or more options.'
      : 'Create offices and candidates for a private election.';
  return (
    <Card title={label} description={description}>
      <ModuleActionForm
        action={action}
        submitLabel={label}
        idempotent
        input={() => ({ votingType })}
        onSaved={(result) => {
          const parsed = pollWriteResultSchema.safeParse(result);
          if (parsed.success)
            router.push(`/admin/polls/${parsed.data.voteId}/edit`);
        }}
      >
        <p className="text-body text-ink-muted">{description}</p>
      </ModuleActionForm>
    </Card>
  );
}

export function PollSettingsView({
  settings,
  action,
}: {
  settings: { tenant_voting_default: boolean };
  action: ModuleFormAction;
}) {
  const id = useId();
  return (
    <section className="grid gap-space-4">
      <Link
        className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        href="/admin/polls"
      >
        Back to Polls
      </Link>
      <h1 className="text-title font-semibold">Poll settings</h1>
      <Card
        title="Tenant voting"
        description="This default applies when a vote is scheduled or opened. Each draft can override it until that point."
      >
        <ModuleActionForm
          action={action}
          submitLabel="Save settings"
          input={(form) =>
            pollSettingsInputSchema.parse({
              tenant_voting_default: form.get('tenantVotingDefault') === 'true',
            })
          }
        >
          <SelectInput
            id={`${id}-tenant-voting`}
            name="tenantVotingDefault"
            label="Allow eligible tenants to represent their unit by default"
            value={String(settings.tenant_voting_default)}
            options={[
              { value: 'false', label: 'No — owners only' },
              { value: 'true', label: 'Yes — owners and tenants' },
            ]}
          />
        </ModuleActionForm>
      </Card>
    </section>
  );
}
