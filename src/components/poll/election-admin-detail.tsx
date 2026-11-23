// Manage the P46 owner voter list before nominations lock.
'use client';

import { useId } from 'react';
import {
  initPollElectionVotersAction,
  removePollElectionVoterAction,
  restorePollElectionVoterAction,
  setPollElectionVoterAction,
} from '@/app/(admin)/admin/polls/elections/actions';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

export function PollElectionVotersCard({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  if (!election.voters.length) {
    return (
      <ModuleActionForm
        action={initPollElectionVotersAction}
        idempotent
        submitLabel={t('Create owner voter list')}
        input={() => ({ electionId: election.id })}
      >
        <p>{t('The default is the earliest active owner for each unit.')}</p>
      </ModuleActionForm>
    );
  }
  return (
    <ul className="grid gap-space-3">
      {election.voters.map((voter) => (
        <li
          key={voter.unit_id}
          className="rounded-md border border-rule p-space-3"
        >
          <p className="font-semibold">
            {voter.unit_label} · {voter.voter_name}
          </p>
          <p className="text-caption text-ink-muted">
            {voter.source === 'earliest_owner'
              ? t('Earliest owner')
              : t('Named by admin')}
            {voter.removed ? ` · ${t('Removed')}` : ''}
          </p>
          {election.stage === 'planning' ? (
            <>
              <PollElectionVoterSetForm election={election} voter={voter} />
              {voter.removed ? (
                <ModuleActionForm
                  action={restorePollElectionVoterAction}
                  submitLabel={t('Restore unit')}
                  input={() => ({
                    electionId: election.id,
                    unitId: voter.unit_id,
                  })}
                >
                  <p>
                    {t('Restore this unit to the locked candidate voter list.')}
                  </p>
                </ModuleActionForm>
              ) : (
                <PollElectionVoterRemoveForm
                  electionId={election.id}
                  unitId={voter.unit_id}
                />
              )}
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PollElectionVoterSetForm({
  election,
  voter,
}: {
  election: PollElectionDetail;
  voter: PollElectionDetail['voters'][number];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={setPollElectionVoterAction}
      submitLabel={t('Change voter')}
      input={(data) => ({
        electionId: election.id,
        unitId: voter.unit_id,
        membershipId: data.get('membershipId'),
        expectedRevision: voter.revision,
      })}
    >
      <SelectInput
        id={`${id}-member`}
        name="membershipId"
        label={t('Owner voter')}
        defaultValue={voter.membership_id}
        options={voter.owner_options.map((owner) => ({
          value: owner.membership_id,
          label: owner.name,
        }))}
      />
    </ModuleActionForm>
  );
}

function PollElectionVoterRemoveForm({
  electionId,
  unitId,
}: {
  electionId: string;
  unitId: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={removePollElectionVoterAction}
      submitLabel={t('Remove unit')}
      input={(data) => ({
        electionId,
        unitId,
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
