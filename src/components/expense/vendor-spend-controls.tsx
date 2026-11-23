// Manage confirmed payee-to-vendor mappings from the P42 report.
'use client';

import { useId } from 'react';
import {
  saveExpensePayeeMappingAction,
  removeExpensePayeeMappingAction,
} from '@/app/(admin)/admin/expenses/actions';
import { useUiTranslator } from '@/components/ui/language';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import type { ExpenseVendorSpend } from '@/core/expense/validation';

export function ExpensePayeeMappingForm({
  payee,
  vendors,
  suggestedVendorId,
  action = saveExpensePayeeMappingAction,
}: {
  payee: string;
  vendors: ExpenseVendorSpend['vendors'];
  suggestedVendorId?: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Confirm mapping')}
      input={(data) => ({
        payee,
        vendorId: data.get('vendorId'),
      })}
    >
      <SelectInput
        id={`${id}-vendor`}
        label={t('Map "{payee}" to', { payee })}
        name="vendorId"
        required
        defaultValue={suggestedVendorId ?? ''}
        options={vendors.map((vendor) => ({
          value: vendor.id,
          label: vendor.name,
        }))}
      />
    </ModuleActionForm>
  );
}

export function ExpensePayeeMappingRemoveForm({
  mapping,
  action = removeExpensePayeeMappingAction,
}: {
  mapping: ExpenseVendorSpend['mappings'][number];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Remove mapping')}
      confirmMessage={t(
        'Remove this payee mapping? Past report history stays unchanged.',
      )}
      input={(data) => ({
        mappingId: mapping.id,
        reason: data.get('reason'),
      })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Reason')}
        name="reason"
        required
        maxLength={500}
      />
    </ModuleActionForm>
  );
}
