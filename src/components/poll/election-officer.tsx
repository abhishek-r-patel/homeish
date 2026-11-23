// Render the election-only P46 returning-officer workspace controls.
'use client';

import { useId } from 'react';
import {
  advancePollOfficerElectionAction,
  cancelPollOfficerElectionAction,
  confirmPollOfficerAction,
  countPollOfficerElectionAction,
  decidePollOfficerNominationAction,
  declarePollOfficerElectionAction,
  extendPollOfficerVotingAction,
} from '@/app/elections/[electionId]/officer/actions';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

function hiddenAssignment(election: PollElectionDetail, societyId: string) {
  return {
    electionId: election.id,
    societyId,
  };
}

export function PollOfficerConfirmation({
  election,
  societyId,
}: {
  election: PollElectionDetail;
  societyId: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={confirmPollOfficerAction}
      submitLabel={t('Confirm no conflict')}
      input={() => ({
        ...hiddenAssignment(election, societyId),
        confirmation: 'I am not a candidate and have no conflict of interest',
      })}
    >
      <p>{t('I am not a candidate and have no conflict of interest')}</p>
      <input type="hidden" name="societyId" value={societyId} />
      <input type="hidden" name="electionId" value={election.id} />
    </ModuleActionForm>
  );
}

export function PollOfficerScrutiny({
  election,
  societyId,
}: {
  election: PollElectionDetail;
  societyId: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ul className="grid gap-space-3">
      {election.nominations
        .filter((nomination) => nomination.status === 'pending')
        .map((nomination) => (
          <li
            key={nomination.id}
            className="rounded-md border border-rule p-space-3"
          >
            <p className="font-semibold">{nomination.candidate_name}</p>
            <OfficerDecisionForm
              action={decidePollOfficerNominationAction}
              societyId={societyId}
              electionId={election.id}
              payload={{
                nominationId: nomination.id,
                accept: true,
                reason: '',
              }}
              label={t('Accept nomination')}
            />
            <OfficerDecisionForm
              action={decidePollOfficerNominationAction}
              societyId={societyId}
              electionId={election.id}
              payload={{ nominationId: nomination.id, accept: false }}
              reasonRequired
              label={t('Reject nomination')}
            />
          </li>
        ))}
    </ul>
  );
}

function OfficerDecisionForm({
  action,
  societyId,
  electionId,
  payload,
  label,
  reasonRequired = false,
}: {
  action: ModuleFormAction;
  societyId: string;
  electionId: string;
  payload: Record<string, unknown>;
  label: string;
  reasonRequired?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={label}
      input={(data) => ({ ...payload, reason: data.get('reason') ?? '' })}
    >
      <input type="hidden" name="societyId" value={societyId} />
      <input type="hidden" name="electionId" value={electionId} />
      <TextAreaInput
        id={id}
        name="reason"
        label={t('Reason')}
        required={reasonRequired}
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

export function PollOfficerCountControls({
  election,
  societyId,
}: {
  election: PollElectionDetail;
  societyId: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <div className="grid gap-space-3">
      {[
        'nominations_open',
        'scrutiny',
        'candidates_published',
        'declared',
      ].includes(election.stage) ? (
        <ModuleActionForm
          action={advancePollOfficerElectionAction}
          submitLabel={t('Advance election stage')}
          input={() => ({
            electionId: election.id,
            expectedRevision: election.revision,
          })}
        >
          <input type="hidden" name="societyId" value={societyId} />
          <input type="hidden" name="electionId" value={election.id} />
        </ModuleActionForm>
      ) : null}
      {election.stage === 'voting' ? (
        <ModuleActionForm
          action={extendPollOfficerVotingAction}
          submitLabel={t('Extend voting')}
          input={(data) => ({
            electionId: election.id,
            closesAt: new Date(String(data.get('closesAt'))).toISOString(),
            reason: data.get('reason'),
          })}
        >
          <input type="hidden" name="societyId" value={societyId} />
          <input type="hidden" name="electionId" value={election.id} />
          <TextInput
            id={`${id}-closes`}
            name="closesAt"
            label={t('New closing time')}
            type="datetime-local"
            required
          />
          <TextAreaInput
            id={`${id}-extend-reason`}
            name="reason"
            label={t('Reason')}
            required
            maxLength={500}
          />
        </ModuleActionForm>
      ) : null}
      {election.stage === 'voting' ? (
        <ModuleActionForm
          action={cancelPollOfficerElectionAction}
          submitLabel={t('Cancel voting')}
          input={(data) => ({
            electionId: election.id,
            expectedRevision: election.revision,
            reason: data.get('cancelReason'),
          })}
        >
          <input type="hidden" name="societyId" value={societyId} />
          <input type="hidden" name="electionId" value={election.id} />
          <TextAreaInput
            id={`${id}-cancel`}
            name="cancelReason"
            label={t('Reason')}
            required
            maxLength={500}
          />
        </ModuleActionForm>
      ) : null}
      {election.stage === 'voting' ? (
        <OfficerSimpleForm
          action={countPollOfficerElectionAction}
          societyId={societyId}
          electionId={election.id}
          label={t('Count election')}
        />
      ) : null}
      {election.stage === 'counted' ? (
        <OfficerSimpleForm
          action={declarePollOfficerElectionAction}
          societyId={societyId}
          electionId={election.id}
          label={t('Declare final result')}
          confirm={t('Declare this result? The declaration cannot be edited.')}
        />
      ) : null}
    </div>
  );
}

function OfficerSimpleForm({
  action,
  societyId,
  electionId,
  label,
  confirm,
}: {
  action: ModuleFormAction;
  societyId: string;
  electionId: string;
  label: string;
  confirm?: string;
}) {
  return (
    <ModuleActionForm
      action={action}
      submitLabel={label}
      confirmMessage={confirm}
      input={() => ({ electionId })}
    >
      <input type="hidden" name="societyId" value={societyId} />
      <input type="hidden" name="electionId" value={electionId} />
    </ModuleActionForm>
  );
}
