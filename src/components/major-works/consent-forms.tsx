// Render P50.5 consent-method, owner-unit consent, poll and milestone controls.
'use client';
import { useId, useState } from 'react';
import {
  createMajorWorksConsentPollAction,
  recordMajorWorksConsentAction,
  saveMajorWorksMilestoneAction,
  setMajorWorksConsentMethodAction,
} from '@/app/(admin)/admin/major-works/actions';
import type {
  MajorWorksConsentView,
  MajorWorksMilestones,
} from '@/core/major-works/validation';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';
import { MajorWorksAuditFileUpload } from './audit-file-upload';

export function MajorWorksConsentMethodForm({
  action = setMajorWorksConsentMethodAction,
  data,
  refresh = true,
}: {
  action?: ModuleFormAction;
  data: MajorWorksConsentView;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [method, setMethod] = useState(data.method);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitDisabled={method === 'poll' && !confirmed}
      submitLabel={t('Save consent method')}
      input={() => ({ method, confirmed })}
    >
      <SelectInput
        id={`${id}-method`}
        label={t('Consent method')}
        name="method"
        onChange={(event) =>
          setMethod(event.currentTarget.value as 'poll' | 'admin_recorded')
        }
        options={[
          { value: 'poll', label: t('Poll answer counts as consent') },
          { value: 'admin_recorded', label: t('Admin-recorded consent only') },
        ]}
        value={method}
      />
      {method === 'poll' ? (
        <CheckboxInput
          checked={confirmed}
          id={`${id}-confirm`}
          label={t(
            'Our bye-laws and applicable rules allow this consent method, and I accept responsibility for it.',
          )}
          name="confirmed"
          onChange={(event) => setConfirmed(event.currentTarget.checked)}
          required
        />
      ) : null}
    </ModuleActionForm>
  );
}

export function MajorWorksConsentRecordForm({
  action = recordMajorWorksConsentAction,
  proposalId,
  record,
  refresh = true,
}: {
  action?: ModuleFormAction;
  proposalId: string;
  record: MajorWorksConsentView['records'][number];
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitLabel={t('Record unit consent')}
      input={(form) => ({
        proposalId,
        unitId: record.unit_id,
        status: form.get('status'),
        signedFormPath: form.get('consentPath') || '',
        expectedVersion: record.version,
      })}
    >
      <SelectInput
        defaultValue={record.status === 'pending' ? 'consents' : record.status}
        id={`${id}-status`}
        label={t('Unit {unit} consent', { unit: record.unit_number })}
        name="status"
        options={[
          { value: 'consents', label: t('Consents') },
          { value: 'does_not_consent', label: t('Does not consent') },
        ]}
        required
      />
      <MajorWorksAuditFileUpload
        fieldName="consentPath"
        kind="consent_form"
        label="Private signed form (optional: JPEG, PNG or PDF up to 10 MB)"
      />
    </ModuleActionForm>
  );
}

export function MajorWorksConsentPollForm({
  action = createMajorWorksConsentPollAction,
  data,
  proposalId,
  refresh = true,
}: {
  action?: ModuleFormAction;
  data: MajorWorksConsentView;
  proposalId: string;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [confirmed, setConfirmed] = useState(false);
  if (data.poll_id) return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitDisabled={!confirmed}
      submitLabel={t('Create draft consent poll')}
      input={() => ({ proposalId, confirmed })}
    >
      <CheckboxInput
        checked={confirmed}
        id={`${id}-confirm`}
        label={t(
          'Our bye-laws and applicable rules allow this consent poll, and I accept responsibility for it.',
        )}
        name="confirmed"
        onChange={(event) => setConfirmed(event.currentTarget.checked)}
        required
      />
    </ModuleActionForm>
  );
}

export function MajorWorksMilestoneForm({
  action = saveMajorWorksMilestoneAction,
  milestone,
  proposalId,
  refresh = true,
}: {
  action?: ModuleFormAction;
  milestone?: MajorWorksMilestones['milestones'][number];
  proposalId: string;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitLabel={milestone ? t('Save milestone') : t('Add milestone')}
      input={(form) => ({
        milestoneId: milestone?.id ?? null,
        proposalId,
        title: form.get('title'),
        plannedOn: form.get('plannedOn'),
        actualOn: form.get('actualOn'),
        status: form.get('status'),
        note: form.get('note'),
        position: form.get('position'),
        expectedUpdatedAt: milestone?.updated_at ?? null,
      })}
    >
      <TextInput
        defaultValue={milestone?.title ?? ''}
        id={`${id}-title`}
        label={t('Milestone title')}
        maxLength={120}
        name="title"
        required
      />
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          defaultValue={milestone?.planned_on ?? ''}
          id={`${id}-planned`}
          label={t('Planned date')}
          name="plannedOn"
          type="date"
        />
        <TextInput
          defaultValue={milestone?.actual_on ?? ''}
          id={`${id}-actual`}
          label={t('Actual date')}
          name="actualOn"
          type="date"
        />
        <SelectInput
          defaultValue={milestone?.status ?? 'todo'}
          id={`${id}-status`}
          label={t('Status')}
          name="status"
          options={[
            { value: 'todo', label: t('To do') },
            { value: 'done', label: t('Done') },
            { value: 'not_needed', label: t('Not needed') },
          ]}
          required
        />
        <TextInput
          defaultValue={String(milestone?.position ?? 1)}
          id={`${id}-position`}
          inputMode="numeric"
          label={t('Order')}
          maxLength={3}
          name="position"
          required
        />
      </div>
      <TextAreaInput
        defaultValue={milestone?.note ?? ''}
        id={`${id}-note`}
        label={t('Note')}
        maxLength={500}
        name="note"
        rows={3}
      />
    </ModuleActionForm>
  );
}
