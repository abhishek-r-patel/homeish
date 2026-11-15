// Render expense, income, approval, reversal, setup and month-close forms.
'use client';
import { useId } from 'react';
import { TextInput } from '@/components/ui/text-input';
import { SelectInput } from '@/components/ui/select-input';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { NoticeAttachmentUpload } from '@/components/notices/attachment-upload';
import {
  closeExpenseMonthAction,
  decideExpenseAction,
  recordExpenseAction,
  recordIncomeAction,
  reopenExpenseMonthAction,
  reverseEntryAction,
  saveExpenseAccountAction,
  saveExpenseCategoryAction,
  saveExpenseSettingsAction,
} from '@/app/(admin)/admin/expenses/actions';
import type {
  ExpenseAccount,
  ExpenseCategory,
  ExpenseWorkspace,
} from '@/core/expense/validation';
import { rupeesFromPaise } from '@/core/billing/validation';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
];
const INCOME_KINDS = [
  { value: 'donation', label: 'Donation' },
  { value: 'interest', label: 'Interest' },
  { value: 'other', label: 'Other income' },
];

function accountOptions(accounts: readonly ExpenseAccount[]) {
  return accounts
    .filter((account) => account.active)
    .map((account) => ({
      value: account.id,
      label: `${account.name} (${account.account_type === 'cash' ? 'Cash' : 'Bank'})`,
    }));
}

function signedRupees(paise: number) {
  return paise < 0 ? `-${rupeesFromPaise(-paise)}` : rupeesFromPaise(paise);
}

export function ExpenseRecordForm({
  accounts,
  categories,
  today,
  thresholdPaise,
  action = recordExpenseAction,
}: {
  accounts: readonly ExpenseAccount[];
  categories: readonly ExpenseCategory[];
  today: string;
  thresholdPaise: number;
  action?: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel="Record expense"
      input={(data) => ({
        accountId: data.get('accountId'),
        categoryId: data.get('categoryId'),
        spentOn: data.get('spentOn'),
        payee: data.get('payee'),
        amountRupees: data.get('amountRupees'),
        paymentMode: data.get('paymentMode'),
        reference: data.get('reference') ?? '',
        description: data.get('description') ?? '',
        receiptPath: data.get('attachmentPath') || null,
      })}
    >
      <TextInput
        id={`${id}-date`}
        label="Expense date"
        name="spentOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <TextInput
        id={`${id}-payee`}
        label="Paid to"
        name="payee"
        required
        maxLength={120}
      />
      <AmountInput
        id={`${id}-amount`}
        label="Amount"
        name="amountRupees"
        required
        helpText={`Expenses above ₹${rupeesFromPaise(thresholdPaise)} need committee approval before they post.`}
      />
      <SelectInput
        id={`${id}-category`}
        label="Category"
        name="categoryId"
        required
        options={categories
          .filter((category) => category.active)
          .map((category) => ({ value: category.id, label: category.name }))}
      />
      <SelectInput
        id={`${id}-account`}
        label="Paid from"
        name="accountId"
        required
        options={accountOptions(accounts)}
        helpText="Cash payments must come from a cash account."
      />
      <SelectInput
        id={`${id}-mode`}
        label="Payment mode"
        name="paymentMode"
        required
        options={PAYMENT_MODES}
      />
      <TextInput
        id={`${id}-reference`}
        label="Bill, cheque or UTR reference"
        name="reference"
        maxLength={120}
      />
      <TextAreaInput
        id={`${id}-description`}
        label="Notes"
        name="description"
        maxLength={2000}
      />
      <NoticeAttachmentUpload
        id={`${id}-receipt`}
        bucket="expense-files"
        initialPath={null}
      />
    </ModuleActionForm>
  );
}

export function ExpenseIncomeForm({
  accounts,
  today,
  action = recordIncomeAction,
}: {
  accounts: readonly ExpenseAccount[];
  today: string;
  action?: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel="Record income"
      input={(data) => ({
        accountId: data.get('accountId'),
        receivedOn: data.get('receivedOn'),
        incomeKind: data.get('incomeKind'),
        payer: data.get('payer'),
        amountRupees: data.get('amountRupees'),
        reference: data.get('reference') ?? '',
        description: data.get('description') ?? '',
      })}
    >
      <TextInput
        id={`${id}-date`}
        label="Received on"
        name="receivedOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <SelectInput
        id={`${id}-kind`}
        label="Income type"
        name="incomeKind"
        required
        options={INCOME_KINDS}
      />
      <TextInput
        id={`${id}-payer`}
        label="Received from"
        name="payer"
        required
        maxLength={120}
      />
      <AmountInput
        id={`${id}-amount`}
        label="Amount"
        name="amountRupees"
        required
      />
      <SelectInput
        id={`${id}-account`}
        label="Deposited to"
        name="accountId"
        required
        options={accountOptions(accounts)}
      />
      <TextInput
        id={`${id}-reference`}
        label="Reference"
        name="reference"
        maxLength={120}
      />
      <TextAreaInput
        id={`${id}-description`}
        label="Notes"
        name="description"
        maxLength={2000}
      />
    </ModuleActionForm>
  );
}

export function ExpenseDecisionForm({
  expenseId,
  approve,
  action = decideExpenseAction,
}: {
  expenseId: string;
  approve: boolean;
  action?: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={approve ? 'Approve and post' : 'Reject expense'}
      confirmMessage={
        approve
          ? 'Approve this expense and post it to the books?'
          : 'Reject this expense? It will not be posted.'
      }
      input={(data) => ({
        expenseId,
        approve,
        note: data.get('note') ?? '',
      })}
    >
      <TextAreaInput
        id={`${id}-note`}
        label={approve ? 'Approval note' : 'Reason for rejecting'}
        name="note"
        required={!approve}
        maxLength={1000}
      />
    </ModuleActionForm>
  );
}

export function ExpenseReverseForm({
  entryId,
  today,
  action = reverseEntryAction,
}: {
  entryId: string;
  today: string;
  action?: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel="Record reversal"
      confirmMessage="Record a reversing entry? The original entry stays in the books."
      input={(data) => ({
        entryId,
        reverseOn: data.get('reverseOn'),
        reason: data.get('reason'),
      })}
    >
      <TextInput
        id={`${id}-date`}
        label="Reversal date"
        name="reverseOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <TextAreaInput
        id={`${id}-reason`}
        label="Reason"
        name="reason"
        required
        maxLength={1000}
      />
    </ModuleActionForm>
  );
}

export function ExpenseAccountForm({
  account,
  today,
  action = saveExpenseAccountAction,
}: {
  account?: ExpenseAccount;
  today: string;
  action?: ModuleFormAction;
}) {
  const id = useId();
  const openingLocked = account?.has_entries ?? false;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={account ? 'Save account' : 'Add account'}
      input={(data) => ({
        accountId: account?.id ?? null,
        expectedUpdatedAt: account?.updated_at ?? null,
        name: data.get('name'),
        accountType: account?.account_type ?? data.get('accountType'),
        openingBalanceRupees: data.get('openingBalanceRupees'),
        openingOn: data.get('openingOn'),
        active: data.get('active') === 'on',
      })}
    >
      <TextInput
        id={`${id}-name`}
        label="Account name"
        name="name"
        required
        maxLength={120}
        defaultValue={account?.name ?? ''}
      />
      {account ? (
        <p>Type: {account.account_type === 'cash' ? 'Cash' : 'Bank account'}</p>
      ) : (
        <SelectInput
          id={`${id}-type`}
          label="Account type"
          name="accountType"
          required
          options={[
            { value: 'bank', label: 'Bank account' },
            { value: 'cash', label: 'Cash' },
          ]}
        />
      )}
      <AmountInput
        id={`${id}-opening`}
        label="Opening balance"
        name="openingBalanceRupees"
        required
        readOnly={openingLocked}
        defaultValue={
          account ? signedRupees(account.opening_balance_paise) : '0'
        }
        helpText={
          openingLocked
            ? 'The opening balance is fixed once the account has entries.'
            : 'Use a minus sign for an overdrawn opening balance.'
        }
      />
      <TextInput
        id={`${id}-opening-on`}
        label="Opening date"
        name="openingOn"
        type="date"
        required
        readOnly={openingLocked}
        max={today}
        defaultValue={account?.opening_on ?? today}
      />
      <CheckboxInput
        id={`${id}-active`}
        label="Active"
        name="active"
        defaultChecked={account?.active ?? true}
      />
    </ModuleActionForm>
  );
}

export function ExpenseCategoryForm({
  category,
  action = saveExpenseCategoryAction,
}: {
  category?: ExpenseCategory;
  action?: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={category ? 'Save category' : 'Add category'}
      input={(data) => ({
        categoryId: category?.id ?? null,
        expectedUpdatedAt: category?.updated_at ?? null,
        name: data.get('name'),
        active: data.get('active') === 'on',
      })}
    >
      <TextInput
        id={`${id}-name`}
        label="Category name"
        name="name"
        required
        maxLength={120}
        defaultValue={category?.name ?? ''}
      />
      <CheckboxInput
        id={`${id}-active`}
        label="Active"
        name="active"
        defaultChecked={category?.active ?? true}
      />
    </ModuleActionForm>
  );
}

export function ExpenseSettingsForm({
  workspace,
  action = saveExpenseSettingsAction,
}: {
  workspace: Pick<
    ExpenseWorkspace,
    'settings' | 'accounts' | 'billing_enabled'
  >;
  action?: ModuleFormAction;
}) {
  const id = useId();
  const { settings } = workspace;
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Save account settings"
      input={(data) => ({
        thresholdRupees: data.get('thresholdRupees'),
        billingIncomeAccountId: data.get('billingIncomeAccountId') || null,
        expectedUpdatedAt: settings.updated_at,
      })}
    >
      <AmountInput
        id={`${id}-threshold`}
        label="Approval threshold"
        name="thresholdRupees"
        required
        defaultValue={rupeesFromPaise(settings.approval_threshold_paise)}
        helpText="Expenses above this amount need approval from a committee member who did not record them."
      />
      <SelectInput
        id={`${id}-billing`}
        label="Account for billing collections"
        name="billingIncomeAccountId"
        defaultValue={settings.billing_income_account_id ?? ''}
        options={[
          { value: '', label: 'Do not post billing collections' },
          ...workspace.accounts
            .filter((account) => account.active)
            .map((account) => ({ value: account.id, label: account.name })),
        ]}
        helpText={
          workspace.billing_enabled
            ? 'Confirmed billing payments from now on post here as income.'
            : 'Billing is not enabled for this society.'
        }
      />
    </ModuleActionForm>
  );
}

export function ExpenseMonthCloseForm({
  month,
  action = closeExpenseMonthAction,
}: {
  month: string;
  action?: ModuleFormAction;
}) {
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Close month"
      confirmMessage="Close this month? No entries can be added or reversed in it until an administrator reopens it."
      input={() => ({ month })}
    >
      {null}
    </ModuleActionForm>
  );
}

export function ExpenseMonthReopenForm({
  month,
  action = reopenExpenseMonthAction,
}: {
  month: string;
  action?: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Reopen month"
      input={(data) => ({ month, reason: data.get('reason') })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        label="Reason for reopening"
        name="reason"
        required
        maxLength={1000}
      />
    </ModuleActionForm>
  );
}
