// Render P46 nomination, ballot and dispute controls for listed owners.
'use client';

import { useId } from 'react';
import {
  addPollElectionSupportersAction,
  choosePollElectionPostAction,
  respondPollElectionSupporterAction,
  submitPollElectionBallotAction,
  submitPollElectionNominationAction,
  withdrawPollElectionNominationAction,
} from '@/app/(resident)/polls/actions';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

export function PollElectionNominationForm({
  election,
  action = submitPollElectionNominationAction,
  refresh = true,
}: {
  election: PollElectionDetail;
  action?: ModuleFormAction;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={action}
      refresh={refresh}
      idempotent
      submitLabel={t('Nominate yourself')}
      input={(data) => ({
        electionId: election.id,
        postIds: data.getAll('postIds'),
      })}
    >
      <fieldset className="grid gap-space-2">
        <legend className="font-semibold">
          {t('Choose one or more posts')}
        </legend>
        {election.posts.map((post) => (
          <CheckboxInput
            id={`nominate-${post.id}`}
            key={post.id}
            name="postIds"
            value={post.id}
            label={`${post.name} · ${post.seats} ${t('seat(s)')}`}
          />
        ))}
      </fieldset>
      <p className="text-caption text-ink-muted">
        {t(
          'Only an active owner of a listed unit can submit a self-nomination.',
        )}
      </p>
    </ModuleActionForm>
  );
}

export function PollElectionNominationList({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  const own = election.nominations.filter(
    (nomination) => nomination.status !== 'accepted',
  );
  if (!own.length) return <p>{t('You have no pending nominations.')}</p>;
  return (
    <ul className="grid gap-space-3">
      {own.map((nomination) => (
        <li
          key={nomination.id}
          className="rounded-md border border-rule p-space-3"
        >
          <p>
            {nomination.candidate_name} · {t(nomination.status)}
          </p>
          {election.stage === 'nominations_open' ? (
            <ModuleActionForm
              action={withdrawPollElectionNominationAction}
              submitLabel={t('Withdraw nomination')}
              input={() => nomination.id}
            >
              <p>{t('Withdraw before nominations close.')}</p>
            </ModuleActionForm>
          ) : null}
          {nomination.supporters.map((supporter) =>
            supporter.supporter_user_id === nomination.candidate_user_id ? (
              <ModuleActionForm
                key={supporter.id}
                action={respondPollElectionSupporterAction}
                submitLabel={t('Confirm support')}
                input={() => ({ supporterId: supporter.id, confirm: true })}
              >
                <p>{t('Confirm support for this nomination.')}</p>
              </ModuleActionForm>
            ) : null,
          )}
        </li>
      ))}
    </ul>
  );
}

export function PollElectionSupportersForm({
  nominationId,
}: {
  nominationId: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={addPollElectionSupportersAction}
      submitLabel={t('Request proposer and seconder')}
      input={(data) => ({
        nominationId,
        proposerUserId: data.get('proposerUserId'),
        seconderUserId: data.get('seconderUserId'),
      })}
    >
      <TextAreaInput
        id={`${id}-proposer`}
        name="proposerUserId"
        label={t('Proposer user ID')}
        required
      />
      <TextAreaInput
        id={`${id}-seconder`}
        name="seconderUserId"
        label={t('Seconder user ID')}
        required
      />
    </ModuleActionForm>
  );
}

export function PollElectionBallotForm({
  election,
  action = submitPollElectionBallotAction,
  refresh = true,
}: {
  election: PollElectionDetail;
  action?: ModuleFormAction;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={action}
      refresh={refresh}
      submitLabel={t('Submit secret ballot')}
      confirmMessage={t('Submit your unit’s choices? You cannot vote again.')}
      input={(data) => ({
        electionId: election.id,
        unitId: election.my_unit_id,
        choices: election.posts
          .filter((post) => post.balloted)
          .flatMap((post) => {
            const values = data.getAll(`post-${post.id}`);
            return values.map((value) => ({
              postId: post.id,
              candidateId: value === 'nota' ? null : value,
            }));
          }),
      })}
    >
      {election.posts
        .filter((post) => post.balloted)
        .map((post) => (
          <fieldset key={post.id} className="grid gap-space-2">
            <legend className="font-semibold">
              {post.name} · {t('Choose up to {count}', { count: post.seats })}
            </legend>
            {post.accepted_candidates.map((candidate) => (
              <CheckboxInput
                key={candidate.candidate_user_id}
                id={`candidate-${post.id}-${candidate.candidate_user_id}`}
                name={`post-${post.id}`}
                value={candidate.candidate_user_id}
                label={candidate.candidate_name}
              />
            ))}
            <CheckboxInput
              id={`nota-${post.id}`}
              name={`post-${post.id}`}
              value="nota"
              label={t('None of the above')}
            />
          </fieldset>
        ))}
      <p className="text-caption text-ink-muted">
        {t(
          'Your unit and vote are recorded separately; Homeish never stores how this unit voted.',
        )}
      </p>
    </ModuleActionForm>
  );
}

export function PollElectionPostChoiceForm({
  election,
  candidateUserId,
}: {
  election: PollElectionDetail;
  candidateUserId: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={choosePollElectionPostAction}
      submitLabel={t('Choose post')}
      input={(data) => ({
        electionId: election.id,
        candidateUserId,
        chosenPostId: data.get('chosenPostId'),
      })}
    >
      <SelectInput
        id="chosen-post"
        name="chosenPostId"
        label={t('Post to keep')}
        options={election.posts.map((post) => ({
          value: post.id,
          label: post.name,
        }))}
      />
    </ModuleActionForm>
  );
}
