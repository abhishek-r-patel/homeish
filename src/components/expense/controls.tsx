// Render expense, income, approval, reversal, setup and month-close forms.
'use client';
import { useUiTranslator } from '@/components/ui/language';
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
  recordTransferAction,
  reopenExpenseMonthAction,
  reverseEntryAction,
  reverseTransferAction,
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
import { formatLocalizedCurrency } from '@/core/i18n/format';
import type { MessageValues } from '@/core/i18n/messages';

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

function accountOptions(
  accounts: readonly ExpenseAccount[],
  t: (source: string, values?: MessageValues) => string,
  includeDeposit = true,
) {
  return accounts
    .filter(
      (account) =>
        account.active &&
        (includeDeposit || account.account_type !== 'deposit'),
    )
    .map((account) => ({
      value: account.id,
      label: `${account.name} (${t(
        account.account_type === 'cash'
          ? 'Cash'
          : account.account_type === 'deposit'
            ? 'Deposit'
            : 'Bank',
      )})`,
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
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Record expense')}
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
        label={t('Expense date')}
        name="spentOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <TextInput
        id={`${id}-payee`}
        label={t('Paid to')}
        name="payee"
        required
        maxLength={120}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount')}
        name="amountRupees"
        required
        helpText={t(
          'Expenses above {amount} need committee approval before they post.',
          { amount: formatLocalizedCurrency(thresholdPaise, locale ?? 'en') },
        )}
      />
      <SelectInput
        id={`${id}-category`}
        label={t('Category')}
        name="categoryId"
        required
        options={categories
          .filter((category) => category.active)
          .map((category) => ({ value: category.id, label: category.name }))}
      />
      <SelectInput
        id={`${id}-account`}
        label={t('Paid from')}
        name="accountId"
        required
        options={accountOptions(accounts, t, false)}
        helpText={t('Cash payments must come from a cash account.')}
      />
      <SelectInput
        id={`${id}-mode`}
        label={t('Payment mode')}
        name="paymentMode"
        required
        options={PAYMENT_MODES.map((option) => ({
          ...option,
          label: t(option.label),
        }))}
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Bill, cheque or UTR reference')}
        name="reference"
        maxLength={120}
      />
      <TextAreaInput
        id={`${id}-description`}
        label={t('Notes')}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Record income')}
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
        label={t('Received on')}
        name="receivedOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <SelectInput
        id={`${id}-kind`}
        label={t('Income type')}
        name="incomeKind"
        required
        options={INCOME_KINDS.map((option) => ({
          ...option,
          label: t(option.label),
        }))}
      />
      <TextInput
        id={`${id}-payer`}
        label={t('Received from')}
        name="payer"
        required
        maxLength={120}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount')}
        name="amountRupees"
        required
      />
      <SelectInput
        id={`${id}-account`}
        label={t('Deposited to')}
        name="accountId"
        required
        options={accountOptions(accounts, t)}
        helpText={t('Deposit accounts accept interest income only.')}
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Reference')}
        name="reference"
        maxLength={120}
      />
      <TextAreaInput
        id={`${id}-description`}
        label={t('Notes')}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={approve ? t('Approve and post') : t('Reject expense')}
      confirmMessage={
        approve
          ? t('Approve this expense and post it to the books?')
          : t('Reject this expense? It will not be posted.')
      }
      input={(data) => ({
        expenseId,
        approve,
        note: data.get('note') ?? '',
      })}
    >
      <TextAreaInput
        id={`${id}-note`}
        label={approve ? t('Approval note') : t('Reason for rejecting')}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Record reversal')}
      confirmMessage={t(
        'Record a reversing entry? The original entry stays in the books.',
      )}
      input={(data) => ({
        entryId,
        reverseOn: data.get('reverseOn'),
        reason: data.get('reason'),
      })}
    >
      <TextInput
        id={`${id}-date`}
        label={t('Reversal date')}
        name="reverseOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Reason')}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  const openingLocked = account?.has_entries ?? false;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={account ? t('Save account') : t('Add account')}
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
        label={t('Account name')}
        name="name"
        required
        maxLength={120}
        defaultValue={account?.name ?? ''}
      />
      {account ? (
        <p>
          {t('Type: {type}', {
            type: t(
              account.account_type === 'cash'
                ? 'Cash'
                : account.account_type === 'deposit'
                  ? 'Fixed-deposit account'
                  : 'Bank account',
            ),
          })}
        </p>
      ) : (
        <SelectInput
          id={`${id}-type`}
          label={t('Account type')}
          name="accountType"
          required
          options={[
            { value: 'bank', label: t('Bank account') },
            { value: 'cash', label: t('Cash') },
            { value: 'deposit', label: t('Fixed-deposit account') },
          ]}
        />
      )}
      <AmountInput
        id={`${id}-opening`}
        label={t('Opening balance')}
        name="openingBalanceRupees"
        required
        readOnly={openingLocked}
        defaultValue={
          account ? signedRupees(account.opening_balance_paise) : '0'
        }
        helpText={
          openingLocked
            ? t('The opening balance is fixed once the account has entries.')
            : t('Use a minus sign for an overdrawn opening balance.')
        }
      />
      <TextInput
        id={`${id}-opening-on`}
        label={t('Opening date')}
        name="openingOn"
        type="date"
        required
        readOnly={openingLocked}
        max={today}
        defaultValue={account?.opening_on ?? today}
      />
      <CheckboxInput
        id={`${id}-active`}
        label={t('Active')}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={category ? t('Save category') : t('Add category')}
      input={(data) => ({
        categoryId: category?.id ?? null,
        expectedUpdatedAt: category?.updated_at ?? null,
        name: data.get('name'),
        active: data.get('active') === 'on',
      })}
    >
      <TextInput
        id={`${id}-name`}
        label={t('Category name')}
        name="name"
        required
        maxLength={120}
        defaultValue={category?.name ?? ''}
      />
      <CheckboxInput
        id={`${id}-active`}
        label={t('Active')}
        name="active"
        defaultChecked={category?.active ?? true}
      />
    </ModuleActionForm>
  );
}

export function ExpenseTransferForm({
  accounts,
  today,
  action = recordTransferAction,
}: {
  accounts: readonly ExpenseAccount[];
  today: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Record transfer')}
      input={(data) => ({
        fromAccountId: data.get('fromAccountId'),
        toAccountId: data.get('toAccountId'),
        transferOn: data.get('transferOn'),
        amountRupees: data.get('amountRupees'),
        reference: data.get('reference') ?? '',
        note: data.get('note') ?? '',
      })}
    >
      <TextInput
        id={`${id}-date`}
        label={t('Transfer date')}
        name="transferOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <SelectInput
        id={`${id}-from`}
        label={t('From account')}
        name="fromAccountId"
        required
        options={accountOptions(accounts, t)}
      />
      <SelectInput
        id={`${id}-to`}
        label={t('To account')}
        name="toAccountId"
        required
        options={accountOptions(accounts, t)}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount')}
        name="amountRupees"
        required
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Reference')}
        name="reference"
        maxLength={120}
      />
      <TextAreaInput
        id={`${id}-note`}
        label={t('Note')}
        name="note"
        maxLength={2000}
      />
    </ModuleActionForm>
  );
}

export function ExpenseTransferReverseForm({
  transferPairId,
  today,
  action = reverseTransferAction,
}: {
  transferPairId: string;
  today: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Reverse both transfer entries')}
      input={(data) => ({
        transferPairId,
        reverseOn: data.get('reverseOn'),
        reason: data.get('reason'),
      })}
    >
      <TextInput
        id={`${id}-date`}
        label={t('Reversal date')}
        name="reverseOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Reason')}
        name="reason"
        required
        maxLength={1000}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  const { settings } = workspace;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save account settings')}
      input={(data) => ({
        thresholdRupees: data.get('thresholdRupees'),
        billingIncomeAccountId: data.get('billingIncomeAccountId') || null,
        expectedUpdatedAt: settings.updated_at,
      })}
    >
      <AmountInput
        id={`${id}-threshold`}
        label={t('Approval threshold')}
        name="thresholdRupees"
        required
        defaultValue={rupeesFromPaise(settings.approval_threshold_paise)}
        helpText={t(
          'Expenses above this amount need approval from a committee member who did not record them.',
        )}
      />
      <SelectInput
        id={`${id}-billing`}
        label={t('Account for billing collections')}
        name="billingIncomeAccountId"
        defaultValue={settings.billing_income_account_id ?? ''}
        options={[
          { value: '', label: t('Do not post billing collections') },
          ...workspace.accounts
            .filter((account) => account.active)
            .map((account) => ({ value: account.id, label: account.name })),
        ]}
        helpText={
          workspace.billing_enabled
            ? t('Confirmed billing payments from now on post here as income.')
            : t('Billing is not enabled for this society.')
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
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Close month')}
      confirmMessage={t(
        'Close this month? No entries can be added or reversed in it until an administrator reopens it.',
      )}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Reopen month')}
      input={(data) => ({ month, reason: data.get('reason') })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Reason for reopening')}
        name="reason"
        required
        maxLength={1000}
      />
    </ModuleActionForm>
  );
}
