// Render P50.3 read-only what-if amount, deduction and unit-split inputs.
'use client';
import { useId, useState } from 'react';
import { saveMajorWorksScenarioAction } from '@/app/(admin)/admin/major-works/actions';
import { rupeesFromPaise } from '@/core/billing/validation';
import type { MajorWorksScenarios } from '@/core/major-works/validation';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';

export function MajorWorksScenarioForm({
  action = saveMajorWorksScenarioAction,
  data,
  projectId,
  refresh = true,
  scenario,
}: {
  action?: ModuleFormAction;
  data: MajorWorksScenarios;
  projectId: string;
  refresh?: boolean;
  scenario?: MajorWorksScenarios['scenarios'][number];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [basis, setBasis] = useState(scenario?.amount_basis ?? 'estimate');
  const [deduction, setDeduction] = useState(
    scenario?.deduction_type ?? 'none',
  );
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitLabel={scenario ? t('Save scenario') : t('Add scenario')}
      input={(form) => ({
        scenarioId: scenario?.id ?? null,
        projectId,
        name: form.get('name'),
        amountBasis: basis,
        typedAmountRupees: basis === 'typed' ? form.get('typedAmount') : '',
        deductionType: deduction,
        deductionRupees:
          deduction === 'typed' ? form.get('deductionAmount') : '',
        fundId: deduction === 'fund' ? form.get('fundId') || null : null,
        split: form.get('split'),
        expectedUpdatedAt: scenario?.updated_at ?? null,
      })}
    >
      <TextInput
        defaultValue={scenario?.name ?? ''}
        id={`${id}-name`}
        label={t('Scenario name')}
        maxLength={80}
        name="name"
        required
      />
      <SelectInput
        id={`${id}-basis`}
        label={t('Amount basis')}
        name="amountBasis"
        onChange={(event) =>
          setBasis(event.currentTarget.value as 'typed' | 'estimate' | 'budget')
        }
        options={[
          { value: 'estimate', label: t('Project estimate') },
          { value: 'budget', label: t('Current project budget') },
          { value: 'typed', label: t('Typed amount') },
        ]}
        value={basis}
      />
      {basis === 'typed' ? (
        <AmountInput
          defaultValue={
            scenario?.typed_amount_paise !== null &&
            scenario?.typed_amount_paise !== undefined
              ? rupeesFromPaise(scenario.typed_amount_paise)
              : ''
          }
          id={`${id}-amount`}
          label={t('Amount to raise')}
          name="typedAmount"
          required
        />
      ) : null}
      <SelectInput
        id={`${id}-deduction`}
        label={t('Deduction')}
        name="deductionType"
        onChange={(event) =>
          setDeduction(event.currentTarget.value as 'none' | 'typed' | 'fund')
        }
        options={[
          { value: 'none', label: t('No deduction') },
          { value: 'typed', label: t('Typed deduction') },
          {
            value: 'fund',
            label: t('Current fund balance'),
            disabled: data.funds.length === 0,
          },
        ]}
        value={deduction}
      />
      {deduction === 'typed' ? (
        <AmountInput
          defaultValue={
            scenario?.deduction_paise !== null &&
            scenario?.deduction_paise !== undefined
              ? rupeesFromPaise(scenario.deduction_paise)
              : '0.00'
          }
          id={`${id}-deduction-amount`}
          label={t('Deduction amount')}
          name="deductionAmount"
          required
        />
      ) : null}
      {deduction === 'fund' ? (
        <SelectInput
          defaultValue={scenario?.fund_id ?? ''}
          id={`${id}-fund`}
          label={t('Fund balance to use')}
          name="fundId"
          options={data.funds.map((fund) => ({
            value: fund.id,
            label: `${fund.name} (${rupeesFromPaise(fund.balance_paise)})`,
          }))}
          placeholder={t('Choose fund')}
          required
        />
      ) : null}
      <SelectInput
        defaultValue={scenario?.split ?? 'area'}
        id={`${id}-split`}
        label={t('Unit split')}
        name="split"
        options={[
          { value: 'area', label: t('By unit area') },
          { value: 'equal', label: t('Equal per unit') },
        ]}
      />
    </ModuleActionForm>
  );
}
