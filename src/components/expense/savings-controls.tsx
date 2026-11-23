// Manage P42 savings initiatives, status changes and permanent evidence.
'use client';

import { useId } from 'react';
import {
  addExpenseSavingsEvidenceAction,
  changeExpenseSavingsStatusAction,
  saveExpenseSavingsAction,
  voidExpenseSavingsEvidenceAction,
} from '@/app/(admin)/admin/expenses/actions';
import { NoticeAttachmentUpload } from '@/components/notices/attachment-upload';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { rupeesFromPaise } from '@/core/billing/validation';
import type {
  ExpenseSavings,
  ExpenseSavingsDetail,
} from '@/core/expense/validation';

const KINDS = [
  ['renegotiation', 'Renegotiation'],
  ['energy_saving', 'Energy saving'],
  ['reduced_consumption', 'Reduced consumption'],
  ['vendor_change', 'Vendor change'],
  ['process_change', 'Process change'],
  ['other', 'Other'],
] as const;
const STATUSES = [
  ['idea', 'Idea'],
  ['approved', 'Approved'],
  ['implementing', 'Implementing'],
  ['realised', 'Realised'],
  ['dropped', 'Dropped'],
] as const;

export function ExpenseSavingsForm({
  workspace,
  initiative,
  action = saveExpenseSavingsAction,
}: {
  workspace: ExpenseSavings;
  initiative?: ExpenseSavings['initiatives'][number];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={
        initiative ? t('Save initiative') : t('Add savings initiative')
      }
      input={(data) => ({
        initiativeId: initiative?.id ?? null,
        title: data.get('title'),
        description: data.get('description'),
        kind: data.get('kind'),
        ownerUserId: data.get('ownerUserId') || null,
        categoryId: data.get('categoryId') || null,
        vendorId: data.get('vendorId') || null,
        baselineAnnualRupees: data.get('baselineAnnualRupees'),
        expectedAnnualRupees: data.get('expectedAnnualRupees'),
        expectedVersion: initiative?.version ?? null,
      })}
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label={t('Initiative title')}
        maxLength={120}
        required
        defaultValue={initiative?.title}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Description')}
        maxLength={4000}
        required
        defaultValue={initiative?.description}
      />
      <SelectInput
        id={`${id}-kind`}
        name="kind"
        label={t('Saving type')}
        required
        defaultValue={initiative?.kind ?? 'renegotiation'}
        options={KINDS.map(([value, label]) => ({
          value,
          label: t(label),
        }))}
      />
      <SelectInput
        id={`${id}-owner`}
        name="ownerUserId"
        label={t('Owner')}
        defaultValue={initiative?.owner_user_id ?? ''}
        options={[
          { value: '', label: t('Not set') },
          ...workspace.staff.map((member) => ({
            value: member.user_id,
            label: member.full_name,
          })),
        ]}
      />
      <SelectInput
        id={`${id}-category`}
        name="categoryId"
        label={t('Expense category')}
        defaultValue={initiative?.category_id ?? ''}
        options={[
          { value: '', label: t('Not set') },
          ...workspace.categories.map((category) => ({
            value: category.id,
            label: category.name,
          })),
        ]}
      />
      {workspace.vendor_enabled ? (
        <SelectInput
          id={`${id}-vendor`}
          name="vendorId"
          label={t('Vendor')}
          defaultValue={initiative?.vendor_id ?? ''}
          options={[
            { value: '', label: t('Not set') },
            ...workspace.vendors.map((vendor) => ({
              value: vendor.id,
              label: vendor.name,
            })),
          ]}
        />
      ) : null}
      <AmountInput
        id={`${id}-baseline`}
        name="baselineAnnualRupees"
        label={t('Baseline annual cost')}
        required
        defaultValue={rupeesFromPaise(initiative?.baseline_annual_paise ?? 0)}
      />
      <AmountInput
        id={`${id}-expected`}
        name="expectedAnnualRupees"
        label={t('Expected annual saving')}
        required
        defaultValue={rupeesFromPaise(initiative?.expected_annual_paise ?? 0)}
      />
      <p className="text-caption text-ink-muted">
        {t(
          'These figures are estimates. They do not change expenses, budgets, contracts or Accounts entries.',
        )}
      </p>
    </ModuleActionForm>
  );
}

export function ExpenseSavingsStatusForm({
  initiative,
  action = changeExpenseSavingsStatusAction,
}: {
  initiative: ExpenseSavingsDetail;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Change status')}
      input={(data) => ({
        initiativeId: initiative.id,
        status: data.get('status'),
        reason: data.get('reason') ?? '',
        expectedVersion: initiative.version,
      })}
    >
      <SelectInput
        id={`${id}-status`}
        name="status"
        label={t('Status')}
        defaultValue={initiative.status}
        options={STATUSES.map(([value, label]) => ({
          value,
          label: t(label),
        }))}
      />
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t('Reason (required when dropping or restoring)')}
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

export function ExpenseSavingsEvidenceForm({
  initiative,
  workspace,
  today,
  action = addExpenseSavingsEvidenceAction,
}: {
  initiative: ExpenseSavingsDetail;
  workspace: ExpenseSavings;
  today: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Add evidence')}
      input={(data) => {
        const source = String(data.get('source') ?? '');
        const [kind, sourceId] = source ? source.split(':') : ['', ''];
        return {
          initiativeId: initiative.id,
          amountRupees: data.get('amountRupees'),
          evidencedOn: data.get('evidencedOn'),
          note: data.get('note'),
          entryId: kind === 'entry' ? sourceId : null,
          vendorBillId: kind === 'bill' ? sourceId : null,
          vendorContractId: kind === 'contract' ? sourceId : null,
          filePath: data.get('attachmentPath') || null,
        };
      }}
    >
      <AmountInput
        id={`${id}-amount`}
        name="amountRupees"
        label={t('Realised saving')}
        required
      />
      <TextInput
        id={`${id}-date`}
        name="evidencedOn"
        label={t('Evidence date')}
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <TextAreaInput
        id={`${id}-note`}
        name="note"
        label={t('Evidence note')}
        required
        maxLength={2000}
      />
      <SelectInput
        id={`${id}-source`}
        name="source"
        label={t('Source record (optional)')}
        options={[
          { value: '', label: t('No source link') },
          ...workspace.source_choices.entries.map((entry) => ({
            value: `entry:${entry.id}`,
            label: `${t('Accounts entry')} · ${entry.label}`,
          })),
          ...workspace.source_choices.vendor_bills.map((bill) => ({
            value: `bill:${bill.id}`,
            label: `${t('Vendor bill')} · ${bill.label}`,
          })),
          ...workspace.source_choices.vendor_contracts.map((contract) => ({
            value: `contract:${contract.id}`,
            label: `${t('Vendor contract')} · ${contract.label}`,
          })),
        ]}
      />
      <NoticeAttachmentUpload
        id={`${id}-file`}
        bucket="expense-files"
        expenseSavingsInitiativeId={initiative.id}
      />
    </ModuleActionForm>
  );
}

export function ExpenseSavingsEvidenceVoidForm({
  evidenceId,
  action = voidExpenseSavingsEvidenceAction,
}: {
  evidenceId: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Void evidence')}
      confirmMessage={t(
        'Void this evidence? It stays in history and stops counting toward realised savings.',
      )}
      input={(data) => ({
        evidenceId,
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
