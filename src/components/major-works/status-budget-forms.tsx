// Render P50.1 project status and budget controls.
'use client';
import { useId, useState } from 'react';
import {
  setMajorWorksProjectBudgetAction,
  setMajorWorksProjectStatusAction,
} from '@/app/(admin)/admin/major-works/actions';
import { rupeesFromPaise } from '@/core/billing/validation';
import type {
  MajorWorksAdminList,
  MajorWorksProject,
} from '@/core/major-works/validation';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import { STATUS_LABELS } from './project-forms';

export function MajorWorksStatusForm({
  action = setMajorWorksProjectStatusAction,
  project,
  meetingResolutions,
}: {
  action?: ModuleFormAction;
  project: MajorWorksProject;
  meetingResolutions: MajorWorksAdminList['meeting_resolutions'];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const choices: MajorWorksProject['status'][] =
    project.status === 'planned'
      ? ['quoting', 'cancelled']
      : project.status === 'quoting'
        ? ['approved', 'on_hold', 'cancelled']
        : project.status === 'approved'
          ? ['in_progress', 'on_hold', 'cancelled']
          : project.status === 'in_progress'
            ? ['completed', 'on_hold', 'cancelled']
            : project.status === 'on_hold' && project.resume_status
              ? [project.resume_status, 'cancelled']
              : [];
  const [status, setStatus] = useState<MajorWorksProject['status'] | ''>('');
  if (!choices.length) return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Change project status')}
      input={(data) => ({
        projectId: project.id,
        status: data.get('status'),
        reason: data.get('reason') || '',
        approvalBody: data.get('approvalBody') || null,
        approvalDate: data.get('approvalDate') || null,
        meetingResolutionId: data.get('meetingResolutionId') || null,
        expectedUpdatedAt: project.updated_at,
      })}
    >
      <SelectInput
        id={`${id}-status`}
        label={t('Next status')}
        name="status"
        onChange={(event) =>
          setStatus(event.currentTarget.value as MajorWorksProject['status'])
        }
        options={choices.map((choice) => ({
          label: t(STATUS_LABELS[choice]),
          value: choice,
        }))}
        placeholder={t('Choose status')}
        required
      />
      {status === 'on_hold' || status === 'cancelled' ? (
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
      {status === 'approved' ? (
        <>
          <div className="grid gap-space-3 medium:grid-cols-2">
            <SelectInput
              id={`${id}-body`}
              label={t('Approved by')}
              name="approvalBody"
              options={[
                { value: 'committee', label: t('Committee') },
                { value: 'general_body', label: t('General body') },
                { value: 'other', label: t('Other') },
              ]}
              placeholder={t('Choose approving body')}
              required
            />
            <TextInput
              id={`${id}-date`}
              label={t('Approval date')}
              name="approvalDate"
              required
              type="date"
            />
          </div>
          {meetingResolutions.length ? (
            <SelectInput
              id={`${id}-resolution`}
              label={t('Passed meeting resolution')}
              name="meetingResolutionId"
              options={[
                { value: '', label: t('No Homeish resolution link') },
                ...meetingResolutions.map((resolution) => ({
                  value: resolution.id,
                  label: `${resolution.title} (${resolution.passed_on})`,
                })),
              ]}
            />
          ) : null}
        </>
      ) : null}
    </ModuleActionForm>
  );
}

export function MajorWorksBudgetForm({
  action = setMajorWorksProjectBudgetAction,
  project,
  sanctionedWorks,
}: {
  action?: ModuleFormAction;
  project: MajorWorksProject;
  sanctionedWorks: MajorWorksAdminList['sanctioned_works'];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [source, setSource] = useState(project.budget_source);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Save project budget')}
      input={(data) => ({
        projectId: project.id,
        source,
        typedBudgetRupees: data.get('typedBudgetRupees'),
        fundWorkId: data.get('fundWorkId') || null,
        expectedUpdatedAt: project.updated_at,
      })}
    >
      <SelectInput
        id={`${id}-source`}
        label={t('Budget source')}
        name="source"
        onChange={(event) =>
          setSource(event.currentTarget.value as 'typed' | 'sanctioned_work')
        }
        options={[
          { value: 'typed', label: t('Typed budget') },
          {
            value: 'sanctioned_work',
            label: t('Linked sanctioned work'),
            disabled: sanctionedWorks.length === 0,
          },
        ]}
        value={source}
      />
      <AmountInput
        defaultValue={rupeesFromPaise(project.typed_budget_paise)}
        id={`${id}-amount`}
        label={t('Typed budget')}
        name="typedBudgetRupees"
        required
      />
      {source === 'sanctioned_work' ? (
        <SelectInput
          defaultValue={project.fund_work_id ?? ''}
          id={`${id}-work`}
          label={t('Sanctioned work')}
          name="fundWorkId"
          options={sanctionedWorks.map((work) => ({
            value: work.id,
            label: `${work.title} (${rupeesFromPaise(work.amount_paise)})`,
          }))}
          placeholder={t('Choose sanctioned work')}
          required
        />
      ) : null}
    </ModuleActionForm>
  );
}
