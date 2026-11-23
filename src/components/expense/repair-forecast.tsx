// Render P40.9 repair forecast forms and archive controls.
'use client';
import { useId } from 'react';
import {
  archiveExpenseRepairForecastItemAction,
  saveExpenseRepairForecastItemAction,
  setExpenseRepairForecastFundAction,
} from '@/app/(admin)/admin/expenses/actions';
import { rupeesFromPaise } from '@/core/billing/validation';
import type {
  ExpenseRepairForecast,
  ExpenseRepairForecastItem,
} from '@/core/expense/repair-forecast-validation';
import { EXPENSE_REPAIR_FORECAST_CATEGORIES } from '@/core/expense/repair-forecast-validation';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';

export const EXPENSE_REPAIR_FORECAST_CATEGORY_LABELS = {
  structure: 'Structure',
  waterproofing: 'Waterproofing',
  painting: 'Painting',
  lifts: 'Lifts',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  fire_safety: 'Fire safety',
  other: 'Other',
} as const;

export function RepairForecastItemForm({
  action = saveExpenseRepairForecastItemAction,
  item,
}: {
  action?: ModuleFormAction;
  item?: ExpenseRepairForecastItem;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={item ? t('Save forecast item') : t('Add forecast item')}
      input={(data) => ({
        itemId: item?.id ?? null,
        name: data.get('name'),
        category: data.get('category'),
        lastDoneYear: data.get('lastDoneYear'),
        cycleYears: data.get('cycleYears'),
        manualNextDueYear: data.get('manualNextDueYear'),
        currentCostRupees: data.get('currentCostRupees'),
        inflationPercent: data.get('inflationPercent'),
        notes: data.get('notes'),
        expectedUpdatedAt: item?.updated_at ?? null,
      })}
    >
      <TextInput
        defaultValue={item?.name ?? ''}
        id={`${id}-name`}
        label={t('Repair item')}
        maxLength={120}
        name="name"
        required
      />
      <SelectInput
        defaultValue={item?.category ?? 'structure'}
        id={`${id}-category`}
        label={t('Category')}
        name="category"
        options={EXPENSE_REPAIR_FORECAST_CATEGORIES.map((category) => ({
          label: t(EXPENSE_REPAIR_FORECAST_CATEGORY_LABELS[category]),
          value: category,
        }))}
        required
      />
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          defaultValue={item?.last_done_year?.toString() ?? ''}
          helpText={t(
            'Use this when you know the last completed year. Leave it blank to enter the next due year directly.',
          )}
          id={`${id}-last-done`}
          inputMode="numeric"
          label={t('Last done year')}
          maxLength={4}
          name="lastDoneYear"
        />
        <TextInput
          defaultValue={item?.manual_next_due_year?.toString() ?? ''}
          helpText={t('Use this only when the last completed year is unknown.')}
          id={`${id}-next-due`}
          inputMode="numeric"
          label={t('Next due year')}
          maxLength={4}
          name="manualNextDueYear"
        />
      </div>
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          defaultValue={item?.cycle_years?.toString() ?? '5'}
          id={`${id}-cycle`}
          inputMode="numeric"
          label={t('Repeat every (years)')}
          maxLength={2}
          name="cycleYears"
          required
        />
        <AmountInput
          defaultValue={
            item ? rupeesFromPaise(item.current_cost_paise) : '0.00'
          }
          id={`${id}-cost`}
          label={t("Today's cost")}
          name="currentCostRupees"
          required
        />
      </div>
      <TextInput
        defaultValue={item ? String(item.inflation_bp / 100) : '0'}
        helpText={t('This item uses its own rate from 0 to 20%.')}
        id={`${id}-inflation`}
        inputMode="decimal"
        label={t('Annual inflation %')}
        maxLength={5}
        name="inflationPercent"
        required
      />
      <TextAreaInput
        defaultValue={item?.notes ?? ''}
        id={`${id}-notes`}
        label={t('Notes')}
        maxLength={500}
        name="notes"
        rows={3}
      />
    </ModuleActionForm>
  );
}

export function RepairForecastArchiveForm({
  action = archiveExpenseRepairForecastItemAction,
  item,
}: {
  action?: ModuleFormAction;
  item: ExpenseRepairForecastItem;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const restoring = item.archived_at !== null;
  return (
    <ModuleActionForm
      action={action}
      confirmMessage={
        restoring
          ? undefined
          : 'Archive this forecast item? Its history stays saved.'
      }
      idempotent
      submitLabel={restoring ? t('Restore item') : t('Archive item')}
      input={(data) => ({
        itemId: item.id,
        archive: !restoring,
        reason: restoring ? null : data.get('reason'),
        expectedUpdatedAt: item.updated_at,
      })}
    >
      {!restoring ? (
        <TextAreaInput
          id={`${id}-reason`}
          label={t('Archive reason')}
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

export function RepairForecastFundForm({
  action = setExpenseRepairForecastFundAction,
  forecast,
}: {
  action?: ModuleFormAction;
  forecast: ExpenseRepairForecast;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Use fund for gap')}
      input={(data) => ({
        gapFundId: data.get('gapFundId') || null,
        expectedUpdatedAt: forecast.settings_updated_at,
      })}
    >
      <SelectInput
        defaultValue={forecast.gap_fund_id ?? ''}
        id={`${id}-fund`}
        label={t('Fund for the gap')}
        name="gapFundId"
        options={[
          { value: '', label: t('No fund selected') },
          ...forecast.funds.map((fund) => ({
            value: fund.id,
            label: fund.name,
          })),
        ]}
      />
    </ModuleActionForm>
  );
}
