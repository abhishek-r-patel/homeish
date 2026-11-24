// Approve, discard and change approved P42.5 budgets.
'use client';

import { useId, useState } from 'react';
import {
  approveExpenseBudgetAction,
  discardExpenseBudgetAction,
  recordExpenseBudgetChangeAction,
  saveExpenseBudgetSettingsAction,
  voidExpenseBudgetChangeAction,
} from '@/app/(admin)/admin/expenses/actions';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  EXPENSE_BUDGET_MONTHS,
  type ExpenseBudget,
} from '@/core/expense/budget-validation';

function approvalLink(value: string) {
  const [kind, id] = value.split(':');
  return {
    approvalMeetingId: kind === 'meeting' ? id : null,
    approvalDocumentId: kind === 'document' ? id : null,
  };
}

function headKey(head: {
  category_id: string | null;
  income_type: string | null;
}) {
  return head.category_id
    ? `category:${head.category_id}`
    : `income:${head.income_type}`;
}

function headIds(value: string) {
  const [kind, id] = value.split(':');
  return {
    categoryId: kind === 'category' ? id : null,
    incomeType: kind === 'income' ? id : null,
  };
}

function ApprovalFields({
  id,
  today,
  choices,
}: {
  id: string;
  today: string;
  choices: ExpenseBudget['approval_choices'];
}) {
  const { translate: t } = useUiTranslator();
  return (
    <>
      <SelectInput
        id={`${id}-body`}
        name="approvedBody"
        label={t('Approved by')}
        required
        defaultValue="committee"
        options={[
          { value: 'committee', label: t('Committee') },
          { value: 'general_body', label: t('General body') },
        ]}
      />
      <TextInput
        id={`${id}-date`}
        name="approvedOn"
        label={t('Approval date')}
        type="date"
        max={today}
        required
        defaultValue={today}
      />
      <SelectInput
        id={`${id}-source`}
        name="approvalSource"
        label={t('Meeting or document (optional)')}
        options={[
          { value: '', label: t('No linked approval record') },
          ...choices.meetings.map((meeting) => ({
            value: `meeting:${meeting.id}`,
            label: `${t('Meeting')}: ${meeting.label}`,
          })),
          ...choices.documents.map((document) => ({
            value: `document:${document.id}`,
            label: `${t('Document')}: ${document.label}`,
          })),
        ]}
      />
      <TextAreaInput
        id={`${id}-note`}
        name="approvalNote"
        label={t('Approval note (optional)')}
        maxLength={500}
      />
    </>
  );
}

export function ExpenseBudgetApprovalForm({
  workspace,
  action = approveExpenseBudgetAction,
}: {
  workspace: ExpenseBudget;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const budget = workspace.budget;
  if (!budget || budget.status !== 'draft') return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      confirmMessage={t(
        'Approve this budget? The original figures will be locked and later corrections must be recorded as changes.',
      )}
      submitLabel={t('Approve budget')}
      input={(data) => ({
        budgetId: budget.id,
        approvedBody: data.get('approvedBody'),
        approvedOn: data.get('approvedOn'),
        ...approvalLink(String(data.get('approvalSource') ?? '')),
        approvalNote: data.get('approvalNote') ?? '',
        expectedVersion: budget.version,
      })}
    >
      <p className="text-caption text-ink-muted">
        {t(
          'Homeish records the approval details. It does not verify the approval or approve spending.',
        )}
      </p>
      <ApprovalFields
        id={id}
        today={workspace.today}
        choices={workspace.approval_choices}
      />
    </ModuleActionForm>
  );
}

export function ExpenseBudgetDiscardForm({
  workspace,
  action = discardExpenseBudgetAction,
}: {
  workspace: ExpenseBudget;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const budget = workspace.budget;
  if (!budget || budget.status !== 'draft') return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Discard draft')}
      confirmMessage={t(
        'Discard this draft? The record and reason stay in history.',
      )}
      input={(data) => ({
        budgetId: budget.id,
        reason: data.get('reason'),
        expectedVersion: budget.version,
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

export function ExpenseBudgetChangeForm({
  workspace,
  action = recordExpenseBudgetChangeAction,
}: {
  workspace: ExpenseBudget;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [kind, setKind] = useState('increase');
  const budget = workspace.budget;
  if (!budget || budget.status !== 'approved') return null;
  const heads = workspace.current_plan.map((head) => ({
    value: headKey(head),
    label: head.name,
  }));
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Record change')}
      input={(data) => {
        const source = headIds(String(data.get('head')));
        const destination = headIds(String(data.get('toHead') ?? ''));
        return {
          budgetId: budget.id,
          changeKind: data.get('changeKind'),
          ...source,
          toCategoryId: destination.categoryId,
          toIncomeType: destination.incomeType,
          amountRupees: data.get('amountRupees'),
          effectiveMonth: data.get('effectiveMonth'),
          reason: data.get('reason'),
          approvedBody: data.get('approvedBody'),
          approvedOn: data.get('approvedOn'),
          ...approvalLink(String(data.get('approvalSource') ?? '')),
          approvalNote: data.get('approvalNote') ?? '',
          expectedVersion: budget.version,
        };
      }}
    >
      <SelectInput
        id={`${id}-kind`}
        name="changeKind"
        label={t('Change')}
        value={kind}
        onChange={(event) => setKind(event.currentTarget.value)}
        options={[
          { value: 'increase', label: t('Increase') },
          { value: 'decrease', label: t('Decrease') },
          { value: 'move', label: t('Move between heads') },
        ]}
      />
      <SelectInput
        id={`${id}-head`}
        name="head"
        label={t('Budget head')}
        required
        options={heads}
      />
      {kind === 'move' ? (
        <SelectInput
          id={`${id}-to-head`}
          name="toHead"
          label={t('Move to')}
          required
          options={heads}
        />
      ) : null}
      <AmountInput
        id={`${id}-amount`}
        name="amountRupees"
        label={t('Amount')}
        required
      />
      <SelectInput
        id={`${id}-month`}
        name="effectiveMonth"
        label={t('Starts in')}
        required
        defaultValue="1"
        options={EXPENSE_BUDGET_MONTHS.map((month, index) => ({
          value: String(index + 1),
          label: t(month),
        }))}
      />
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t('Reason')}
        required
        maxLength={500}
      />
      <ApprovalFields
        id={id}
        today={workspace.today}
        choices={workspace.approval_choices}
      />
    </ModuleActionForm>
  );
}

export function ExpenseBudgetChangeVoidForm({
  workspace,
  changeId,
  action = voidExpenseBudgetChangeAction,
}: {
  workspace: ExpenseBudget;
  changeId: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const budget = workspace.budget;
  if (!budget || budget.status !== 'approved') return null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Cancel change')}
      confirmMessage={t(
        'Cancel this change? It stays in history. Both halves of a move are cancelled together.',
      )}
      input={(data) => ({
        changeId,
        reason: data.get('reason'),
        expectedVersion: budget.version,
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

export function ExpenseBudgetSettingsForm({
  workspace,
  action = saveExpenseBudgetSettingsAction,
}: {
  workspace: ExpenseBudget & {
    settingsAccess?: Readonly<Record<string, boolean>>;
  };
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const settingsAccess = workspace.settingsAccess ?? {
    budget_forecast_method: true,
    budget_resident_summary: true,
  };
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save budget settings')}
      input={(data) => ({
        forecastMethod: data.get('forecastMethod'),
        watchPercent: workspace.settings.budget_watch_percent,
        residentSummary: data.get('residentSummary') === 'on',
        expectedUpdatedAt: workspace.settings.updated_at,
      })}
    >
      {settingsAccess.budget_forecast_method ? (
        <SelectInput
          id={`${id}-forecast`}
          name="forecastMethod"
          label={t('Cash-flow forecast')}
          defaultValue={workspace.settings.budget_forecast_method}
          options={[
            { value: 'budget', label: t('Budget') },
            { value: 'average_3_months', label: t('Average of last 3 months') },
            { value: 'none', label: t('No forecast') },
          ]}
        />
      ) : (
        <input
          name="forecastMethod"
          type="hidden"
          value={workspace.settings.budget_forecast_method}
        />
      )}
      {settingsAccess.budget_resident_summary ? (
        <label className="flex min-h-12 items-center gap-space-3">
          <input
            type="checkbox"
            name="residentSummary"
            defaultChecked={workspace.settings.budget_resident_summary}
          />
          {t('Share budget summary with residents')}
        </label>
      ) : workspace.settings.budget_resident_summary ? (
        <input name="residentSummary" type="hidden" value="on" />
      ) : null}
    </ModuleActionForm>
  );
}
