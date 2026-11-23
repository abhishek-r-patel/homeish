// Render P46 tie, multiple-win and dispute controls for the returning officer.
'use client';

import {
  decidePollOfficerPostAction,
  resolvePollOfficerTieAction,
  updatePollOfficerDisputeAction,
} from '@/app/elections/[electionId]/officer/actions';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

export function PollOfficerResultForms({
  election,
  societyId,
}: {
  election: PollElectionDetail;
  societyId: string;
}) {
  const { translate: t } = useUiTranslator();
  const candidates = election.posts.flatMap((post) =>
    post.accepted_candidates.map((candidate) => ({
      value: `${post.id}:${candidate.candidate_user_id}`,
      label: `${post.name} · ${candidate.candidate_name}`,
    })),
  );
  return (
    <div className="grid gap-space-3">
      <ModuleActionForm
        action={resolvePollOfficerTieAction}
        submitLabel={t('Resolve tie')}
        input={(data) => {
          const [postId, candidateUserId] = String(data.get('candidate')).split(
            ':',
          );
          return {
            electionId: election.id,
            postId,
            candidateUserId,
            method: data.get('method'),
            reason: data.get('reason'),
          };
        }}
      >
        <input type="hidden" name="societyId" value={societyId} />
        <input type="hidden" name="electionId" value={election.id} />
        <SelectInput
          id="tie-candidate"
          name="candidate"
          label={t('Selected candidate')}
          options={candidates}
        />
        <TextInput
          id="tie-method"
          name="method"
          label={t('Method')}
          required
          maxLength={200}
        />
        <TextAreaInput
          id="tie-reason"
          name="reason"
          label={t('Reason')}
          required
          maxLength={1000}
        />
      </ModuleActionForm>
      <ModuleActionForm
        action={decidePollOfficerPostAction}
        submitLabel={t('Decide post for multiple winner')}
        input={(data) => {
          const [chosenPostId, candidateUserId] = String(
            data.get('candidatePost'),
          ).split(':');
          return {
            electionId: election.id,
            chosenPostId,
            candidateUserId,
            reason: data.get('postReason'),
          };
        }}
      >
        <input type="hidden" name="societyId" value={societyId} />
        <input type="hidden" name="electionId" value={election.id} />
        <SelectInput
          id="post-choice"
          name="candidatePost"
          label={t('Candidate and post')}
          options={candidates}
        />
        <TextAreaInput
          id="post-reason"
          name="postReason"
          label={t('Reason')}
          required
          maxLength={1000}
        />
      </ModuleActionForm>
    </div>
  );
}

export function PollOfficerDisputes({
  election,
  societyId,
}: {
  election: PollElectionDetail;
  societyId: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ul className="grid gap-space-3">
      {election.disputes.map((dispute) => (
        <li
          key={dispute.id}
          className="rounded-md border border-rule p-space-3"
        >
          <p className="whitespace-pre-wrap">{dispute.text}</p>
          {dispute.file_url ? (
            <a className="text-brand underline" href={dispute.file_url}>
              {t('Open private evidence')}
            </a>
          ) : null}
          <p className="text-caption text-ink-muted">{t(dispute.status)}</p>
          <ModuleActionForm
            action={updatePollOfficerDisputeAction}
            submitLabel={t('Update dispute')}
            input={(data) => ({
              disputeId: dispute.id,
              status: data.get('status'),
              resolutionNote: data.get('resolutionNote') ?? '',
            })}
          >
            <input type="hidden" name="societyId" value={societyId} />
            <input type="hidden" name="electionId" value={election.id} />
            <SelectInput
              id={`dispute-${dispute.id}`}
              name="status"
              label={t('Status')}
              defaultValue={
                dispute.status === 'open' ? 'under_review' : dispute.status
              }
              options={[
                { value: 'under_review', label: t('Under review') },
                { value: 'resolved', label: t('Resolved') },
                { value: 'rejected', label: t('Rejected') },
              ]}
            />
            <TextAreaInput
              id={`resolution-${dispute.id}`}
              name="resolutionNote"
              label={t('Resolution note')}
              maxLength={1000}
            />
          </ModuleActionForm>
        </li>
      ))}
    </ul>
  );
}
