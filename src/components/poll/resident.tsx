// Show resident polls, own-unit ballots, results and representative choices.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { CheckboxInput, RadioInput } from '@/components/ui/choice-controls';
import { Card, ListItem } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import {
  pollPrivateBallotInputSchema,
  pollPublicBallotInputSchema,
  pollRepresentativeSetInputSchema,
  type PollMemberList,
  type PollMemberVote,
  type PollRepresentatives,
  type PollResults,
} from '@/core/poll/validation';
import { PollResultsView, PollStatus, formatPollDateTime } from './shared';

export function ResidentPollListView({ polls }: { polls: PollMemberList }) {
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">Polls</h1>
        <p className="text-body text-ink-muted">
          See society polls and elections for units you live in. Only the unit’s
          voting representative can submit a ballot.
        </p>
        <Link
          className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
          href="/polls/representatives"
        >
          Choose your unit’s voting representative
        </Link>
      </div>
      {polls.votes.length === 0 ? (
        <EmptyState
          title="No polls yet"
          description="Polls for your units will appear here when your society schedules or opens them."
        />
      ) : (
        <ul className="grid gap-space-2">
          {polls.votes.map((vote) => {
            const representativeUnits = vote.units.filter(
              (unit) => unit.isRepresentative,
            ).length;
            return (
              <li key={vote.id}>
                <ListItem
                  href={`/polls/${vote.id}`}
                  title={<span className="break-words">{vote.title}</span>}
                  secondary={`${vote.votingType === 'public' ? 'Public poll' : 'Private election'} · closes ${formatPollDateTime(vote.closesAt)} (IST)`}
                  status={`poll.${vote.status}`}
                  trailing={`${representativeUnits} voting unit${representativeUnits === 1 ? '' : 's'}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ballotActionInput(form: FormData, name: string) {
  return form.getAll(name).map((value) => String(value));
}

function UnitPublicBallot({
  vote,
  options,
  unit,
  action,
}: {
  vote: PollMemberVote['vote'];
  options: NonNullable<PollMemberVote['options']>;
  unit: PollMemberVote['units'][number];
  action: ModuleFormAction;
}) {
  const id = useId();
  const selectedOptionIds = unit.myOptionIds ?? [];
  return (
    <Card
      title={`Vote for unit ${unit.unitLabel}`}
      description="Your unit’s ballot can be changed until the poll closes."
    >
      <ModuleActionForm
        action={action}
        submitLabel={unit.submitted ? 'Update ballot' : 'Submit ballot'}
        input={(form) =>
          pollPublicBallotInputSchema.parse({
            voteId: vote.id,
            unitId: unit.unitId,
            optionIds: ballotActionInput(form, 'optionId'),
          })
        }
      >
        <fieldset className="grid gap-space-2 border-0 p-0">
          <legend className="text-body-strong">
            {vote.selectionMode === 'single'
              ? 'Choose one option'
              : 'Choose one or more options'}
          </legend>
          {vote.selectionMode === 'single'
            ? options.map((option, index) => (
                <RadioInput
                  key={option.id}
                  id={`${id}-option-${index}`}
                  name="optionId"
                  value={option.id}
                  defaultChecked={selectedOptionIds.includes(option.id)}
                  label={option.label}
                  required={index === 0}
                />
              ))
            : options.map((option, index) => (
                <CheckboxInput
                  key={option.id}
                  id={`${id}-option-${index}`}
                  name="optionId"
                  value={option.id}
                  defaultChecked={selectedOptionIds.includes(option.id)}
                  label={option.label}
                />
              ))}
        </fieldset>
      </ModuleActionForm>
    </Card>
  );
}

export function ResidentPollDetailView({
  detail,
  results,
  now,
  publicAction,
  privateAction,
}: {
  detail: PollMemberVote;
  results: PollResults | null;
  now: string;
  publicAction: ModuleFormAction;
  privateAction: ModuleFormAction;
}) {
  const { vote } = detail;
  const representatives = detail.units.filter((unit) => unit.isRepresentative);
  const deadlinePassed =
    vote.status === 'active' &&
    vote.closesAt !== null &&
    Date.parse(now) >= Date.parse(vote.closesAt);
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link
        className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        href="/polls"
      >
        Back to Polls
      </Link>
      <div className="grid gap-space-2">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">{vote.title}</h1>
          <PollStatus status={vote.status} />
        </div>
        <p className="text-body text-ink-muted">
          {vote.votingType === 'public' ? 'Public poll' : 'Private election'} ·
          Opens {formatPollDateTime(vote.opensAt)} · Closes{' '}
          {formatPollDateTime(vote.closesAt)} (IST)
        </p>
        {vote.status === 'scheduled' ? (
          <p className="text-caption text-ink-muted">
            This poll is scheduled. Ballot options will appear when voting
            opens.
          </p>
        ) : null}
        {vote.instructions ? (
          <p className="break-words whitespace-pre-line text-body">
            {vote.instructions}
          </p>
        ) : null}
        {vote.status === 'cancelled' && vote.cancellationReason ? (
          <p className="text-body text-ink-muted">
            This poll was cancelled: {vote.cancellationReason}
          </p>
        ) : null}
        {vote.completionReason ? (
          <p className="text-body text-ink-muted">
            Voting was completed early: {vote.completionReason}
          </p>
        ) : null}
      </div>
      {vote.status === 'active' &&
      !deadlinePassed &&
      representatives.length > 0 ? (
        vote.votingType === 'public' ? (
          representatives.map((unit) => (
            <UnitPublicBallot
              key={unit.unitId}
              vote={vote}
              options={detail.options ?? []}
              unit={unit}
              action={publicAction}
            />
          ))
        ) : (
          representatives.map((unit) =>
            unit.submitted ? (
              <Card
                key={unit.unitId}
                title={`Ballot received for unit ${unit.unitLabel}`}
              >
                <p className="text-body text-ink-muted">
                  Your private ballot was received. Your choices are not
                  displayed here.
                </p>
              </Card>
            ) : (
              <PrivateBallotForUnit
                key={unit.unitId}
                detail={detail}
                unit={unit}
                action={privateAction}
              />
            ),
          )
        )
      ) : vote.status === 'active' && !deadlinePassed ? (
        <Card title="Ballot not available">
          <p className="text-body text-ink-muted">
            You can see this poll, but only its unit representative can vote.
          </p>
        </Card>
      ) : null}
      {deadlinePassed ? (
        <Card title="Voting has closed">
          <p className="text-body text-ink-muted">
            The poll is being updated. Refresh shortly to see its final status.
          </p>
        </Card>
      ) : null}
      {results ? (
        <Card title="Poll results">
          <PollResultsView results={results} />
        </Card>
      ) : null}
    </section>
  );
}

function PrivateBallotForUnit({
  detail,
  unit,
  action,
}: {
  detail: PollMemberVote;
  unit: PollMemberVote['units'][number];
  action: ModuleFormAction;
}) {
  return (
    <PrivateBallot
      vote={detail.vote}
      offices={detail.offices ?? []}
      unit={unit}
      action={action}
    />
  );
}

function PrivateBallot({
  vote,
  offices,
  unit,
  action,
}: {
  vote: PollMemberVote['vote'];
  offices: NonNullable<PollMemberVote['offices']>;
  unit: PollMemberVote['units'][number];
  action: ModuleFormAction;
}) {
  const id = useId();
  const [review, setReview] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  if (review) {
    return (
      <Card title={`Review private ballot for unit ${unit.unitLabel}`}>
        <p className="text-body text-ink-muted">
          Check each choice. After you confirm, you cannot submit another
          private ballot.
        </p>
        <ul className="grid gap-space-1">
          {offices.map((office) => (
            <li className="text-body" key={office.id}>
              {office.name}:{' '}
              {office.candidates.find(
                (candidate) => candidate.id === choices[office.id],
              )?.name ?? 'None of the above'}
            </li>
          ))}
        </ul>
        <ModuleActionForm
          action={action}
          submitLabel="Confirm and submit ballot"
          confirmMessage="Submit this private ballot? You cannot change it after submission."
          input={(form) => {
            const officeIds = ballotActionInput(form, 'officeId');
            const candidateIds = ballotActionInput(form, 'candidateId');
            return pollPrivateBallotInputSchema.parse({
              voteId: vote.id,
              unitId: unit.unitId,
              choices: officeIds.map((officeId, index) => ({
                officeId,
                candidateId: candidateIds[index] || null,
              })),
            });
          }}
        >
          {offices.map((office) => (
            <div key={office.id}>
              <input type="hidden" name="officeId" value={office.id} />
              <input
                type="hidden"
                name="candidateId"
                value={
                  choices[office.id] === 'nota'
                    ? ''
                    : (choices[office.id] ?? '')
                }
              />
            </div>
          ))}
          <p className="text-caption text-ink-muted">
            After submission, this page will only confirm that your ballot was
            received.
          </p>
        </ModuleActionForm>
        <button
          className="min-h-12 rounded-md px-space-3 text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => setReview(false)}
          type="button"
        >
          Return to ballot
        </button>
      </Card>
    );
  }
  return (
    <Card
      title={`Private ballot for unit ${unit.unitLabel}`}
      description="Your choices are not linked to your unit in the stored results. You can submit once."
    >
      <p className="mb-space-3 text-body text-ink-muted">
        You are voting for unit {unit.unitLabel}. Choose one candidate or None
        of the above for each office, then review your ballot.
      </p>
      {offices.map((office, officeIndex) => (
        <fieldset
          className="mb-space-4 grid gap-space-2 border-0 p-0"
          key={office.id}
        >
          <legend className="text-body-strong">{office.name}</legend>
          {office.candidates.map((candidate, candidateIndex) => (
            <RadioInput
              key={candidate.id}
              id={`${id}-${officeIndex}-${candidateIndex}`}
              name={office.id}
              value={candidate.id}
              checked={choices[office.id] === candidate.id}
              onChange={() =>
                setChoices((current) => ({
                  ...current,
                  [office.id]: candidate.id,
                }))
              }
              label={candidate.name}
            />
          ))}
          <RadioInput
            id={`${id}-${officeIndex}-nota`}
            name={office.id}
            value="nota"
            checked={choices[office.id] === 'nota'}
            onChange={() =>
              setChoices((current) => ({ ...current, [office.id]: 'nota' }))
            }
            label="None of the above"
          />
        </fieldset>
      ))}
      <button
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-brand px-space-4 text-body-strong text-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
        disabled={
          offices.length === 0 ||
          offices.some((office) => choices[office.id] === undefined)
        }
        onClick={() => setReview(true)}
        type="button"
      >
        Review ballot
      </button>
    </Card>
  );
}

export function PollRepresentativesView({
  representatives,
  action,
}: {
  representatives: PollRepresentatives & { canSetRepresentative: boolean };
  action: ModuleFormAction;
}) {
  const id = useId();
  return (
    <section className="grid gap-space-4">
      <Link
        className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        href="/polls"
      >
        Back to Polls
      </Link>
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">Voting representatives</h1>
        <p className="text-body text-ink-muted">
          Each unit gets one vote. An active owner can choose the representative
          for their own unit. Administrators can manage all units.
        </p>
      </div>
      {representatives.units.length === 0 ? (
        <EmptyState
          title="No units to show"
          description="Eligible units and occupants will appear here."
        />
      ) : (
        <ul className="grid gap-space-3">
          {representatives.units.map((unit, index) => (
            <li key={unit.unitId}>
              <Card
                title={`${unit.blockName ? `${unit.blockName} · ` : ''}${unit.unitLabel}`}
              >
                <div className="grid gap-space-2">
                  <p className="text-body text-ink-muted">
                    Current default or designated voter:{' '}
                    {unit.effective
                      ? `${unit.effective.name} (${unit.effective.relationship})`
                      : 'No eligible representative'}
                  </p>
                  {unit.designated ? (
                    <p className="text-caption text-ink-muted">
                      Designated: {unit.designated.name} (
                      {unit.designated.relationship})
                    </p>
                  ) : null}
                  {representatives.canSetRepresentative ? (
                    <ModuleActionForm
                      action={action}
                      submitLabel="Save representative"
                      input={(form) =>
                        pollRepresentativeSetInputSchema.parse({
                          unitId: unit.unitId,
                          membershipId:
                            String(form.get(`membership-${index}`) ?? '') ||
                            null,
                          expectedVersion: unit.version,
                        })
                      }
                    >
                      <SelectInput
                        id={`${id}-membership-${index}`}
                        name={`membership-${index}`}
                        label="Choose the voting representative"
                        defaultValue={unit.designated?.membershipId ?? ''}
                        options={[
                          { value: '', label: 'Use the unit default' },
                          ...unit.options.map((option) => ({
                            value: option.membershipId,
                            label: `${option.name} (${option.relationship}${option.isPrimary ? ', primary occupant' : ''})`,
                          })),
                        ]}
                      />
                    </ModuleActionForm>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
