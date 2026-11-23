// Render P46 election stage, cancellation and returning-officer actions.
'use client';

import { useId } from 'react';
import {
  advancePollElectionAction,
  assignPollElectionOfficerAction,
  cancelPollElectionAction,
  revokePollElectionOfficerAction,
} from '@/app/(admin)/admin/polls/elections/actions';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

export function PollElectionStageForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={advancePollElectionAction}
      submitLabel={t('Advance stage')}
      confirmMessage={t('Advance the official election to its next stage?')}
      input={() => ({
        electionId: election.id,
        expectedRevision: election.revision,
      })}
    >
      <p>
        {t('Current stage')}: {t(election.stage.replaceAll('_', ' '))}
      </p>
      <TextAreaInput
        id={`${id}-cancel`}
        label={t('Cancellation reason (use only in the separate cancel form)')}
        name="unusedReason"
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

export function PollElectionCancelForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={cancelPollElectionAction}
      submitLabel={t('Cancel election')}
      confirmMessage={t('Cancel this official election?')}
      input={(data) => ({
        electionId: election.id,
        expectedRevision: election.revision,
        reason: data.get('reason'),
      })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t('Reason')}
        required
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

export function PollElectionOfficerForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  if (election.officer) {
    return (
      <ModuleActionForm
        action={revokePollElectionOfficerAction}
        submitLabel={t('Revoke returning officer')}
        confirmMessage={t('Revoke this returning officer’s access?')}
        input={(data) => ({
          officerId: election.officer!.id,
          reason: data.get('reason'),
        })}
      >
        <p>{election.officer.name}</p>
        <TextAreaInput
          id={`${id}-reason`}
          name="reason"
          label={t('Reason')}
          required
          maxLength={500}
        />
      </ModuleActionForm>
    );
  }
  return (
    <ModuleActionForm
      action={assignPollElectionOfficerAction}
      idempotent
      submitLabel={t('Assign returning officer')}
      input={(data) => ({
        electionId: election.id,
        profileId: data.get('profileId') || null,
        invitedEmail: data.get('invitedEmail') || null,
      })}
    >
      <SelectInput
        id={`${id}-member`}
        name="profileId"
        label={t('Society member (or leave blank for outside email)')}
        options={[
          { value: '', label: t('Outside person') },
          ...election.member_options.map((member) => ({
            value: member.user_id,
            label: member.name,
          })),
        ]}
      />
      <TextInput
        id={`${id}-email`}
        name="invitedEmail"
        type="email"
        label={t('Outside returning officer email')}
      />
    </ModuleActionForm>
  );
}
