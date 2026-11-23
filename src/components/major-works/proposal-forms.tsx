// Render P50.4 redevelopment proposal, stage and private evidence forms.
'use client';
import { useId, useState } from 'react';
import {
  addMajorWorksProposalFileAction,
  archiveMajorWorksProposalAction,
  saveMajorWorksProposalAction,
  setMajorWorksProposalStageAction,
} from '@/app/(admin)/admin/major-works/actions';
import { rupeesFromPaise } from '@/core/billing/validation';
import type { MajorWorksProposals } from '@/core/major-works/validation';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import { MajorWorksAuditFileUpload } from './audit-file-upload';

export type MajorWorksProposal = MajorWorksProposals['proposals'][number];

const STAGE_LABELS = {
  received: 'Received',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  selected: 'Selected',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
} as const;

export function MajorWorksProposalForm({
  action = saveMajorWorksProposalAction,
  proposal,
  refresh = true,
}: {
  action?: ModuleFormAction;
  proposal?: MajorWorksProposal;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitLabel={
        proposal
          ? t('Save redevelopment proposal')
          : t('Add redevelopment proposal')
      }
      input={(form) => ({
        proposalId: proposal?.id ?? null,
        developerName: form.get('developerName'),
        receivedOn: form.get('receivedOn'),
        decisionDueOn: form.get('decisionDueOn'),
        extraAreaPercent: form.get('extraAreaPercent'),
        monthlyRentRupees: form.get('monthlyRentRupees'),
        corpusRupees: form.get('corpusRupees'),
        timelineMonths: form.get('timelineMonths'),
        bankGuaranteeRupees: form.get('bankGuaranteeRupees'),
        otherTerms: form.get('otherTerms'),
        expectedUpdatedAt: proposal?.updated_at ?? null,
      })}
    >
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          defaultValue={proposal?.developer_name ?? ''}
          id={`${id}-developer`}
          label={t('Developer name')}
          maxLength={120}
          name="developerName"
          required
        />
        <TextInput
          defaultValue={proposal?.received_on ?? ''}
          id={`${id}-received`}
          label={t('Received date')}
          name="receivedOn"
          required
          type="date"
        />
        <TextInput
          defaultValue={proposal?.decision_due_on ?? ''}
          id={`${id}-due`}
          label={t('Decision due date')}
          name="decisionDueOn"
          type="date"
        />
        <TextInput
          defaultValue={
            proposal?.extra_area_bp !== null &&
            proposal?.extra_area_bp !== undefined
              ? String(proposal.extra_area_bp / 100)
              : ''
          }
          id={`${id}-area`}
          inputMode="decimal"
          label={t('Extra area %')}
          maxLength={6}
          name="extraAreaPercent"
        />
        <AmountInput
          defaultValue={
            proposal?.monthly_rent_paise !== null &&
            proposal?.monthly_rent_paise !== undefined
              ? rupeesFromPaise(proposal.monthly_rent_paise)
              : ''
          }
          id={`${id}-rent`}
          label={t('Monthly rent per unit')}
          name="monthlyRentRupees"
        />
        <AmountInput
          defaultValue={
            proposal?.corpus_paise !== null &&
            proposal?.corpus_paise !== undefined
              ? rupeesFromPaise(proposal.corpus_paise)
              : ''
          }
          id={`${id}-corpus`}
          label={t('Corpus per unit')}
          name="corpusRupees"
        />
        <TextInput
          defaultValue={proposal?.timeline_months?.toString() ?? ''}
          id={`${id}-timeline`}
          inputMode="numeric"
          label={t('Timeline (months)')}
          maxLength={3}
          name="timelineMonths"
        />
        <AmountInput
          defaultValue={
            proposal?.bank_guarantee_paise !== null &&
            proposal?.bank_guarantee_paise !== undefined
              ? rupeesFromPaise(proposal.bank_guarantee_paise)
              : ''
          }
          id={`${id}-guarantee`}
          label={t('Bank guarantee')}
          name="bankGuaranteeRupees"
        />
      </div>
      <TextAreaInput
        defaultValue={proposal?.other_terms ?? ''}
        id={`${id}-terms`}
        label={t('Other terms')}
        maxLength={1000}
        name="otherTerms"
        rows={4}
      />
    </ModuleActionForm>
  );
}

export function MajorWorksProposalStageForm({
  action = setMajorWorksProposalStageAction,
  proposal,
  refresh = true,
}: {
  action?: ModuleFormAction;
  proposal: MajorWorksProposal;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const stages: MajorWorksProposal['stage'][] =
    proposal.stage === 'received'
      ? ['under_review', 'rejected', 'withdrawn']
      : proposal.stage === 'under_review'
        ? ['shortlisted', 'rejected', 'withdrawn']
        : proposal.stage === 'shortlisted'
          ? ['selected', 'rejected', 'withdrawn']
          : [];
  const [stage, setStage] = useState<MajorWorksProposal['stage'] | ''>('');
  if (!stages.length) return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitLabel={t('Change proposal stage')}
      input={(form) => ({
        proposalId: proposal.id,
        stage: form.get('stage'),
        reason: form.get('reason') || '',
        expectedUpdatedAt: proposal.updated_at,
      })}
    >
      <SelectInput
        id={`${id}-stage`}
        label={t('Next stage')}
        name="stage"
        onChange={(event) =>
          setStage(event.currentTarget.value as MajorWorksProposal['stage'])
        }
        options={stages.map((value) => ({
          value,
          label: t(STAGE_LABELS[value]),
        }))}
        placeholder={t('Choose stage')}
        required
      />
      {stage === 'rejected' || stage === 'withdrawn' ? (
        <TextAreaInput
          id={`${id}-reason`}
          label={t('Reason')}
          maxLength={500}
          minLength={5}
          name="reason"
          required
          rows={2}
        />
      ) : null}
    </ModuleActionForm>
  );
}

export function MajorWorksProposalFileForm({
  action = addMajorWorksProposalFileAction,
  proposal,
  refresh = true,
}: {
  action?: ModuleFormAction;
  proposal: MajorWorksProposal;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitLabel={t('Add proposal evidence')}
      input={(form) => ({
        proposalId: proposal.id,
        path: form.get('proposalPath'),
      })}
    >
      <MajorWorksAuditFileUpload
        fieldName="proposalPath"
        kind="proposal"
        label="Private proposal evidence (optional: JPEG, PNG or PDF up to 10 MB)"
      />
    </ModuleActionForm>
  );
}

export function MajorWorksProposalArchiveForm({
  action = archiveMajorWorksProposalAction,
  proposal,
  refresh = true,
}: {
  action?: ModuleFormAction;
  proposal: MajorWorksProposal;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  if (
    proposal.archived_at ||
    !['selected', 'rejected', 'withdrawn'].includes(proposal.stage)
  ) {
    return null;
  }
  return (
    <ModuleActionForm
      action={action}
      confirmMessage="Archive this proposal? Its consent records and private evidence are retained for eight years."
      idempotent
      refresh={refresh}
      submitLabel={t('Archive proposal')}
      input={() => ({
        proposalId: proposal.id,
        expectedUpdatedAt: proposal.updated_at,
      })}
    >
      <p className="text-caption text-ink-muted">
        {t(
          'Related consents, milestones and files are purged after eight years; the proposal and stage history stay.',
        )}
      </p>
    </ModuleActionForm>
  );
}

export { STAGE_LABELS };
