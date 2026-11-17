// Show resident polls, own-unit ballots, results and representative choices.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
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
  const { locale, translate: t } = useUiTranslator();
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">{t('Polls')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'See society polls and elections for units you live in. Only the unit’s voting representative can submit a ballot.',
          )}
        </p>
        <Link
          className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
          href="/polls/representatives"
        >
          {t('Choose your unit’s voting representative')}
        </Link>
      </div>
      {polls.votes.length === 0 ? (
        <EmptyState
          title={t('No polls yet')}
          description={t(
            'Polls for your units will appear here when your society schedules or opens them.',
          )}
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
                  secondary={t('{type} · closes {date} (IST)', {
                    type: t(
                      vote.votingType === 'public'
                        ? 'Public poll'
                        : 'Private election',
                    ),
                    date: formatPollDateTime(vote.closesAt, locale),
                  })}
                  status={`poll.${vote.status}`}
                  trailing={t(
                    representativeUnits === 1
                      ? '{count} voting unit'
                      : '{count} voting units',
                    {
                      count: formatLocalizedNumber(
                        representativeUnits,
                        locale ?? 'en',
                      ),
                    },
                  )}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  const selectedOptionIds = unit.myOptionIds ?? [];
  return (
    <Card
      title={t('Vote for unit {unit}', { unit: unit.unitLabel })}
      description={t(
        'Your unit’s ballot can be changed until the poll closes.',
      )}
    >
      <ModuleActionForm
        action={action}
        submitLabel={t(unit.submitted ? 'Update ballot' : 'Submit ballot')}
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
            {t(
              vote.selectionMode === 'single'
                ? 'Choose one option'
                : 'Choose one or more options',
            )}
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
  const { locale, translate: t } = useUiTranslator();
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
        {t('Back to Polls')}
      </Link>
      <div className="grid gap-space-2">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">{vote.title}</h1>
          <PollStatus status={vote.status} />
        </div>
        <p className="text-body text-ink-muted">
          {t('{type} · Opens {opens} · Closes {closes} (IST)', {
            type: t(
              vote.votingType === 'public' ? 'Public poll' : 'Private election',
            ),
            opens: formatPollDateTime(vote.opensAt, locale),
            closes: formatPollDateTime(vote.closesAt, locale),
          })}
        </p>
        {vote.status === 'scheduled' ? (
          <p className="text-caption text-ink-muted">
            {t(
              'This poll is scheduled. Ballot options will appear when voting opens.',
            )}
          </p>
        ) : null}
        {vote.instructions ? (
          <p className="break-words whitespace-pre-line text-body">
            {vote.instructions}
          </p>
        ) : null}
        {vote.status === 'cancelled' && vote.cancellationReason ? (
          <p className="text-body text-ink-muted">
            {t('This poll was cancelled: {reason}', {
              reason: vote.cancellationReason,
            })}
          </p>
        ) : null}
        {vote.completionReason ? (
          <p className="text-body text-ink-muted">
            {t('Voting was completed early: {reason}', {
              reason: vote.completionReason,
            })}
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
                title={t('Ballot received for unit {unit}', {
                  unit: unit.unitLabel,
                })}
              >
                <p className="text-body text-ink-muted">
                  {t(
                    'Your private ballot was received. Your choices are not displayed here.',
                  )}
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
        <Card title={t('Ballot not available')}>
          <p className="text-body text-ink-muted">
            {t(
              'You can see this poll, but only its unit representative can vote.',
            )}
          </p>
        </Card>
      ) : null}
      {deadlinePassed ? (
        <Card title={t('Voting has closed')}>
          <p className="text-body text-ink-muted">
            {t(
              'The poll is being updated. Refresh shortly to see its final status.',
            )}
          </p>
        </Card>
      ) : null}
      {results ? (
        <Card title={t('Poll results')}>
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [review, setReview] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  if (review) {
    return (
      <Card
        title={t('Review private ballot for unit {unit}', {
          unit: unit.unitLabel,
        })}
      >
        <p className="text-body text-ink-muted">
          {t(
            'Check each choice. After you confirm, you cannot submit another private ballot.',
          )}
        </p>
        <ul className="grid gap-space-1">
          {offices.map((office) => (
            <li className="text-body" key={office.id}>
              {office.name}:{' '}
              {office.candidates.find(
                (candidate) => candidate.id === choices[office.id],
              )?.name ?? t('None of the above')}
            </li>
          ))}
        </ul>
        <ModuleActionForm
          action={action}
          submitLabel={t('Confirm and submit ballot')}
          confirmMessage={t(
            'Submit this private ballot? You cannot change it after submission.',
          )}
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
            {t(
              'After submission, this page will only confirm that your ballot was received.',
            )}
          </p>
        </ModuleActionForm>
        <button
          className="min-h-12 rounded-md px-space-3 text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => setReview(false)}
          type="button"
        >
          {t('Return to ballot')}
        </button>
      </Card>
    );
  }
  return (
    <Card
      title={t('Private ballot for unit {unit}', { unit: unit.unitLabel })}
      description={t(
        'Your choices are not linked to your unit in the stored results. You can submit once.',
      )}
    >
      <p className="mb-space-3 text-body text-ink-muted">
        {t(
          'You are voting for unit {unit}. Choose one candidate or None of the above for each office, then review your ballot.',
          { unit: unit.unitLabel },
        )}
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
            label={t('None of the above')}
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
        {t('Review ballot')}
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
  const { locale, translate: t } = useUiTranslator();
  const relationship = (value: string) => {
    if (locale !== 'hi') return value;
    if (value === 'owner') return t('Owner');
    if (value === 'tenant') return t('Tenant');
    if (value === 'family') return t('Family member');
    throw new Error(`Unknown voting relationship: ${value}`);
  };
  const id = useId();
  return (
    <section className="grid gap-space-4">
      <Link
        className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        href="/polls"
      >
        {t('Back to Polls')}
      </Link>
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">
          {t('Voting representatives')}
        </h1>
        <p className="text-body text-ink-muted">
          {t(
            'Each unit gets one vote. An active owner can choose the representative for their own unit. Administrators can manage all units.',
          )}
        </p>
      </div>
      {representatives.units.length === 0 ? (
        <EmptyState
          title={t('No units to show')}
          description={t('Eligible units and occupants will appear here.')}
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
                    {t('Current default or designated voter: {voter}', {
                      voter: unit.effective
                        ? `${unit.effective.name} (${relationship(unit.effective.relationship)})`
                        : t('No eligible representative'),
                    })}
                  </p>
                  {unit.designated ? (
                    <p className="text-caption text-ink-muted">
                      {t('Designated: {name} ({relationship})', {
                        name: unit.designated.name,
                        relationship: relationship(
                          unit.designated.relationship,
                        ),
                      })}
                    </p>
                  ) : null}
                  {representatives.canSetRepresentative ? (
                    <ModuleActionForm
                      action={action}
                      submitLabel={t('Save representative')}
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
                        label={t('Choose the voting representative')}
                        defaultValue={unit.designated?.membershipId ?? ''}
                        options={[
                          { value: '', label: t('Use the unit default') },
                          ...unit.options.map((option) => ({
                            value: option.membershipId,
                            label: t(
                              option.isPrimary
                                ? '{name} ({relationship}, primary occupant)'
                                : '{name} ({relationship})',
                              {
                                name: option.name,
                                relationship: relationship(option.relationship),
                              },
                            ),
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
