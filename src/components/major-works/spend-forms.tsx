// Render P50.1 Accounts spend-tag controls.
'use client';
import { useId } from 'react';
import {
  addMajorWorksSpendTagAction,
  removeMajorWorksSpendTagAction,
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
import { useUiTranslator } from '@/components/ui/language';

export function MajorWorksSpendTagForm({
  action = addMajorWorksSpendTagAction,
  project,
  entries,
}: {
  action?: ModuleFormAction;
  project: MajorWorksProject;
  entries: MajorWorksAdminList['expense_entries'];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  if (!entries.length) return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Tag Accounts expense')}
      input={(data) => ({
        projectId: project.id,
        entryId: data.get('entryId'),
        amountRupees: data.get('amountRupees'),
      })}
    >
      <SelectInput
        id={`${id}-entry`}
        label={t('Accounts expense')}
        name="entryId"
        options={entries.map((entry) => ({
          value: entry.id,
          label: `${entry.entry_date} - ${entry.counterparty} - ${rupeesFromPaise(entry.remaining_paise)} ${t('available')}`,
        }))}
        placeholder={t('Choose expense')}
        required
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount to tag')}
        name="amountRupees"
        required
      />
    </ModuleActionForm>
  );
}

export function MajorWorksSpendTagRemoveForm({
  action = removeMajorWorksSpendTagAction,
  tag,
}: {
  action?: ModuleFormAction;
  tag: MajorWorksProject['spend_tags'][number];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  if (tag.removed_at) return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Remove tag')}
      input={(data) => ({
        tagId: tag.id,
        reason: data.get('reason'),
      })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Removal reason')}
        maxLength={500}
        minLength={5}
        name="reason"
        required
        rows={2}
      />
    </ModuleActionForm>
  );
}
