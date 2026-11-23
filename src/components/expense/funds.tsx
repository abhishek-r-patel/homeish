// Render P40 fund setup, opening allocations and activation acknowledgement.
'use client';
import { useId, useState } from 'react';
import {
  activateExpenseFundsAction,
  confirmExpenseFundAllocationsAction,
  correctExpenseFundAllocationAction,
  correctExpenseFundOpeningAction,
  saveExpenseFundAction,
  saveExpenseFundTargetAction,
  saveExpenseStatementBalanceAction,
  saveExpenseFundMappingAction,
  saveExpenseFixedDepositAction,
  saveExpenseFundInterestAction,
  saveExpenseFundTransferRuleAction,
  recordExpenseFundTransferAction,
  reverseExpenseFundTransferAction,
  saveExpenseFundCorpusAction,
  linkExpenseFundReceiptAction,
  saveExpenseFundWorkAction,
  linkExpenseFundWorkAction,
} from '@/app/(admin)/admin/expenses/actions';
import type {
  ExpenseFund,
  ExpenseFundActivityEntry,
  ExpenseFixedDeposit,
  ExpenseFundInterestRecord,
  ExpenseFundTransferRule,
  ExpenseFundTransfer,
  ExpenseFundCorpusRecord,
  ExpenseFundWork,
  ExpenseFundReconciliation,
} from '@/core/expense/validation';
import type { ExpenseAccount } from '@/core/expense/validation';
import { EXPENSE_FUND_WARNING } from '@/core/expense/validation';
import {
  nonnegativeRupeesSchema,
  rupeesFromPaise,
} from '@/core/billing/validation';
import { formatLocalizedCurrency } from '@/core/i18n/format';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';
import { SelectInput } from '@/components/ui/select-input';

export function ExpenseFundForm({
  fund,
  action = saveExpenseFundAction,
}: {
  fund?: ExpenseFund;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={fund ? t('Save fund') : t('Add fund')}
      input={(data) => ({
        fundId: fund?.id ?? null,
        expectedUpdatedAt: fund?.updated_at ?? null,
        name: data.get('name'),
        active: data.get('active') === 'on',
      })}
    >
      <TextInput
        id={`${id}-name`}
        label={t('Fund name')}
        name="name"
        required
        maxLength={120}
        defaultValue={fund?.name ?? ''}
      />
      <CheckboxInput
        id={`${id}-active`}
        label={t('Active')}
        name="active"
        defaultChecked={fund?.active ?? true}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundTargetForm({
  fund,
  action = saveExpenseFundTargetAction,
}: {
  fund: ExpenseFundReconciliation['funds'][number];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Save target')}
      input={(data) => ({
        fundId: fund.fund_id,
        targetRupees: data.get('targetRupees') || null,
        targetDate: data.get('targetDate') || null,
        expectedUpdatedAt: fund.target_updated_at,
      })}
    >
      <AmountInput
        id={`${id}-target`}
        label={t('Target amount (optional)')}
        name="targetRupees"
        defaultValue={
          fund.target_paise === null ? '' : rupeesFromPaise(fund.target_paise)
        }
      />
      <TextInput
        id={`${id}-date`}
        label={t('Target date (optional)')}
        name="targetDate"
        type="date"
        defaultValue={fund.target_date ?? ''}
      />
    </ModuleActionForm>
  );
}

export function ExpenseStatementBalanceForm({
  account,
  month,
  action = saveExpenseStatementBalanceAction,
}: {
  account: ExpenseFundReconciliation['accounts'][number];
  month: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const editing = account.updated_at !== null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t(
        editing ? 'Update statement balance' : 'Save statement balance',
      )}
      input={(data) => ({
        accountId: account.account_id,
        month,
        closingRupees: data.get('closingRupees'),
        note: data.get('note'),
        reason: data.get('reason'),
        expectedUpdatedAt: account.updated_at,
      })}
    >
      <AmountInput
        id={`${id}-closing`}
        label={t('Statement closing balance')}
        name="closingRupees"
        required
        defaultValue={
          account.statement_closing_paise === null
            ? ''
            : rupeesFromPaise(account.statement_closing_paise)
        }
      />
      <TextAreaInput
        id={`${id}-note`}
        label={t('Note (optional)')}
        name="note"
        maxLength={500}
        defaultValue={account.note ?? ''}
      />
      {editing ? (
        <TextAreaInput
          id={`${id}-reason`}
          label={t('Reason for change')}
          name="reason"
          required
          minLength={5}
          maxLength={500}
        />
      ) : (
        <input type="hidden" name="reason" value="" />
      )}
    </ModuleActionForm>
  );
}

export function ExpenseFundActivationForm({
  funds,
  cutoverOn,
  accountsTotalPaise,
  action = activateExpenseFundsAction,
}: {
  funds: readonly ExpenseFund[];
  cutoverOn: string;
  accountsTotalPaise: number;
  action?: ModuleFormAction;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(funds.map((fund) => [fund.id, '0'])),
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const parsedAmounts = funds.map((fund) =>
    nonnegativeRupeesSchema.safeParse(amounts[fund.id] ?? ''),
  );
  const validAmounts = parsedAmounts.every((result) => result.success);
  const allocatedTotalPaise = parsedAmounts.reduce(
    (total, result) =>
      total + (result.success ? BigInt(result.data) : BigInt(0)),
    BigInt(0),
  );
  const overTotal =
    validAmounts && allocatedTotalPaise > BigInt(accountsTotalPaise);
  const unallocatedPaise = overTotal
    ? BigInt(0)
    : BigInt(accountsTotalPaise) - allocatedTotalPaise;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Activate fund tracking')}
      submitDisabled={!acknowledged || !validAmounts || overTotal}
      input={(data) => ({
        cutoverOn,
        allocations: funds.map((fund) => ({
          fundId: fund.id,
          amountRupees: data.get(`amount-${fund.id}`),
        })),
        acknowledged: data.get('acknowledged') === 'on',
      })}
    >
      <input type="hidden" name="cutoverOn" value={cutoverOn} />
      {funds.map((fund) => (
        <AmountInput
          key={fund.id}
          id={`${id}-${fund.id}`}
          label={fund.name}
          name={`amount-${fund.id}`}
          required
          value={amounts[fund.id] ?? '0'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setAmounts((current) => ({
              ...current,
              [fund.id]: value,
            }));
          }}
        />
      ))}
      <p className="text-caption text-ink-muted" aria-live="polite">
        {validAmounts
          ? t('Allocated: {allocated}. Unallocated: {unallocated}.', {
              allocated: formatLocalizedCurrency(
                allocatedTotalPaise,
                locale ?? 'en',
              ),
              unallocated: formatLocalizedCurrency(
                unallocatedPaise,
                locale ?? 'en',
              ),
            })
          : t('Enter a valid amount for every fund.')}
      </p>
      {overTotal ? (
        <p className="text-caption text-danger" role="alert">
          {t('Fund openings cannot exceed the Accounts total.')}
        </p>
      ) : null}
      <CheckboxInput
        id={`${id}-acknowledged`}
        label={t(EXPENSE_FUND_WARNING)}
        name="acknowledged"
        required
        checked={acknowledged}
        onChange={(event) => setAcknowledged(event.currentTarget.checked)}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundMappingForm({
  label,
  sourceKind,
  sourceId,
  incomeKind,
  fundId,
  updatedAt,
  funds,
  action = saveExpenseFundMappingAction,
}: {
  label: string;
  sourceKind: 'expense_category' | 'income_kind' | 'billing_charge';
  sourceId: string | null;
  incomeKind: 'donation' | 'interest' | 'other' | null;
  fundId: string | null;
  updatedAt: string | null;
  funds: readonly ExpenseFund[];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save suggestion')}
      input={(data) => ({
        sourceKind,
        sourceId,
        incomeKind,
        fundId: data.get('fundId') || null,
        expectedUpdatedAt: updatedAt,
      })}
    >
      <SelectInput
        id={`${id}-fund`}
        label={label}
        name="fundId"
        defaultValue={fundId ?? ''}
        options={[
          { value: '', label: t('No suggested fund') },
          ...funds
            .filter((fund) => fund.active)
            .map((fund) => ({ value: fund.id, label: fund.name })),
        ]}
        helpText={t(
          'Suggestions are not saved to an entry until an admin confirms them.',
        )}
      />
    </ModuleActionForm>
  );
}

function fundAmounts(
  funds: readonly ExpenseFund[],
  entry: ExpenseFundActivityEntry,
  suggestions?: readonly {
    fund_id: string | null;
    amount_paise: number;
  }[],
) {
  return Object.fromEntries(
    funds.map((fund) => [
      fund.id,
      suggestions
        ? rupeesFromPaise(
            suggestions.find((allocation) => allocation.fund_id === fund.id)
              ?.amount_paise ?? 0,
          )
        : fund.id === entry.suggested_fund_id
          ? rupeesFromPaise(entry.amount_paise)
          : '0',
    ]),
  );
}

export function ExpenseFundAllocationForm({
  entry,
  funds,
  suggestedAllocations,
  action = confirmExpenseFundAllocationsAction,
}: {
  entry: ExpenseFundActivityEntry;
  funds: readonly ExpenseFund[];
  suggestedAllocations?: readonly {
    fund_id: string | null;
    amount_paise: number;
  }[];
  action?: ModuleFormAction;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    fundAmounts(funds, entry, suggestedAllocations),
  );
  const parsedAmounts = funds.map((fund) =>
    nonnegativeRupeesSchema.safeParse(amounts[fund.id] ?? ''),
  );
  const validAmounts = parsedAmounts.every((result) => result.success);
  const allocatedPaise = parsedAmounts.reduce(
    (total, result) =>
      total + (result.success ? BigInt(result.data) : BigInt(0)),
    BigInt(0),
  );
  const totalPaise = BigInt(entry.amount_paise);
  const overTotal = validAmounts && allocatedPaise > totalPaise;
  const unallocatedPaise =
    validAmounts && !overTotal ? totalPaise - allocatedPaise : BigInt(0);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Confirm allocation')}
      submitDisabled={!validAmounts || overTotal}
      input={() => {
        const allocations: {
          fundId: string | null;
          amountRupees: string;
        }[] = funds.flatMap((fund) => {
          const parsed = nonnegativeRupeesSchema.parse(amounts[fund.id] ?? '0');
          return parsed > 0
            ? [{ fundId: fund.id, amountRupees: amounts[fund.id] ?? '0' }]
            : [];
        });
        if (unallocatedPaise > BigInt(0))
          allocations.push({
            fundId: null,
            amountRupees: rupeesFromPaise(unallocatedPaise.toString()),
          });
        return { items: [{ entryId: entry.entry_id, allocations }] };
      }}
    >
      {funds.map((fund) => (
        <AmountInput
          key={fund.id}
          id={`${id}-${fund.id}`}
          label={fund.name}
          name={`amount-${fund.id}`}
          required
          value={amounts[fund.id] ?? '0'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setAmounts((current) => ({ ...current, [fund.id]: value }));
          }}
        />
      ))}
      <p className="text-caption text-ink-muted" aria-live="polite">
        {t('Fund allocations: {allocated}. Unallocated: {unallocated}.', {
          allocated: formatLocalizedCurrency(
            allocatedPaise.toString(),
            locale ?? 'en',
          ),
          unallocated: formatLocalizedCurrency(
            unallocatedPaise.toString(),
            locale ?? 'en',
          ),
        })}
      </p>
      {overTotal ? (
        <p className="text-caption text-danger" role="alert">
          {t('Allocations cannot exceed the entry amount.')}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

export function ExpenseFundBulkSuggestionsForm({
  entries,
  suggestions,
  action = confirmExpenseFundAllocationsAction,
}: {
  entries: readonly ExpenseFundActivityEntry[];
  suggestions?: readonly {
    entry_id: string;
    allocations: readonly {
      fund_id: string | null;
      amount_paise: number;
    }[];
  }[];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Confirm selected suggestions')}
      submitDisabled={selected.size === 0}
      input={() => ({
        items: entries
          .filter((entry) => selected.has(entry.entry_id))
          .map((entry) => {
            const suggested = suggestions?.find(
              (item) => item.entry_id === entry.entry_id,
            );
            return {
              entryId: entry.entry_id,
              allocations: suggested
                ? suggested.allocations.map((allocation) => ({
                    fundId: allocation.fund_id,
                    amountRupees: rupeesFromPaise(allocation.amount_paise),
                  }))
                : [
                    {
                      fundId: entry.suggested_fund_id,
                      amountRupees: rupeesFromPaise(entry.amount_paise),
                    },
                  ],
            };
          }),
      })}
    >
      {entries.map((entry) => (
        <CheckboxInput
          key={entry.entry_id}
          id={`fund-suggestion-${entry.entry_id}`}
          label={`${entry.voucher_no}: ${entry.counterparty}`}
          checked={selected.has(entry.entry_id)}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setSelected((current) => {
              const next = new Set(current);
              if (checked) next.add(entry.entry_id);
              else next.delete(entry.entry_id);
              return next;
            });
          }}
        />
      ))}
    </ModuleActionForm>
  );
}

export function ExpenseFundOpeningCorrectionForm({
  funds,
  accountsTotalPaise,
  currentAllocations,
  action = correctExpenseFundOpeningAction,
}: {
  funds: readonly ExpenseFund[];
  accountsTotalPaise: number;
  currentAllocations: readonly {
    fund_id: string;
    amount_paise: number;
  }[];
  action?: ModuleFormAction;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      funds.map((fund) => [
        fund.id,
        rupeesFromPaise(
          currentAllocations.find(
            (allocation) => allocation.fund_id === fund.id,
          )?.amount_paise ?? 0,
        ),
      ]),
    ),
  );
  const parsedAmounts = funds.map((fund) =>
    nonnegativeRupeesSchema.safeParse(amounts[fund.id] ?? ''),
  );
  const validAmounts = parsedAmounts.every((result) => result.success);
  const allocatedPaise = parsedAmounts.reduce(
    (total, result) =>
      total + (result.success ? BigInt(result.data) : BigInt(0)),
    BigInt(0),
  );
  const totalPaise = BigInt(accountsTotalPaise);
  const overTotal = validAmounts && allocatedPaise > totalPaise;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Re-confirm opening')}
      submitDisabled={!validAmounts || overTotal}
      input={(data) => ({
        allocations: funds.map((fund) => ({
          fundId: fund.id,
          amountRupees: data.get(`opening-${fund.id}`),
        })),
        reason: data.get('reason'),
      })}
    >
      {funds.map((fund) => (
        <AmountInput
          key={fund.id}
          id={`${id}-${fund.id}`}
          label={fund.name}
          name={`opening-${fund.id}`}
          required
          value={amounts[fund.id] ?? '0'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setAmounts((current) => ({ ...current, [fund.id]: value }));
          }}
        />
      ))}
      <p className="text-caption text-ink-muted" aria-live="polite">
        {t('Opening allocations: {allocated}. Unallocated: {unallocated}.', {
          allocated: formatLocalizedCurrency(
            allocatedPaise.toString(),
            locale ?? 'en',
          ),
          unallocated: formatLocalizedCurrency(
            (totalPaise - allocatedPaise).toString(),
            locale ?? 'en',
          ),
        })}
      </p>
      {overTotal ? (
        <p className="text-caption text-danger" role="alert">
          {t('Opening allocations cannot exceed the Accounts total.')}
        </p>
      ) : null}
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

export function ExpenseFundAllocationCorrectionForm({
  entry,
  funds,
  action = correctExpenseFundAllocationAction,
}: {
  entry: ExpenseFundActivityEntry;
  funds: readonly ExpenseFund[];
  action?: ModuleFormAction;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      funds.map((fund) => [
        fund.id,
        rupeesFromPaise(
          entry.allocations.find((allocation) => allocation.fund_id === fund.id)
            ?.amount_paise ?? 0,
        ),
      ]),
    ),
  );
  const parsedAmounts = funds.map((fund) =>
    nonnegativeRupeesSchema.safeParse(amounts[fund.id] ?? ''),
  );
  const validAmounts = parsedAmounts.every((result) => result.success);
  const allocatedPaise = parsedAmounts.reduce(
    (total, result) =>
      total + (result.success ? BigInt(result.data) : BigInt(0)),
    BigInt(0),
  );
  const totalPaise = BigInt(entry.amount_paise);
  const overTotal = validAmounts && allocatedPaise > totalPaise;
  const unallocatedPaise =
    validAmounts && !overTotal ? totalPaise - allocatedPaise : BigInt(0);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Save correction')}
      submitDisabled={!validAmounts || overTotal}
      input={(data) => {
        const allocations: {
          fundId: string | null;
          amountRupees: string;
        }[] = funds.flatMap((fund) => {
          const parsed = nonnegativeRupeesSchema.parse(amounts[fund.id] ?? '0');
          return parsed > 0
            ? [{ fundId: fund.id, amountRupees: amounts[fund.id] ?? '0' }]
            : [];
        });
        if (unallocatedPaise > BigInt(0))
          allocations.push({
            fundId: null,
            amountRupees: rupeesFromPaise(unallocatedPaise.toString()),
          });
        return {
          entryId: entry.entry_id,
          allocations,
          reason: data.get('reason'),
        };
      }}
    >
      {funds.map((fund) => (
        <AmountInput
          key={fund.id}
          id={`${id}-${fund.id}`}
          label={fund.name}
          name={`correction-${fund.id}`}
          required
          value={amounts[fund.id] ?? '0'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setAmounts((current) => ({ ...current, [fund.id]: value }));
          }}
        />
      ))}
      <p className="text-caption text-ink-muted" aria-live="polite">
        {t('Fund allocations: {allocated}. Unallocated: {unallocated}.', {
          allocated: formatLocalizedCurrency(
            allocatedPaise.toString(),
            locale ?? 'en',
          ),
          unallocated: formatLocalizedCurrency(
            unallocatedPaise.toString(),
            locale ?? 'en',
          ),
        })}
      </p>
      {overTotal ? (
        <p className="text-caption text-danger" role="alert">
          {t('Allocations cannot exceed the entry amount.')}
        </p>
      ) : null}
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

export function ExpenseFixedDepositForm({
  funds,
  accounts,
  today,
  deposit,
  predecessor,
  action = saveExpenseFixedDepositAction,
}: {
  funds: readonly ExpenseFund[];
  accounts: readonly ExpenseAccount[];
  today: string;
  deposit?: ExpenseFixedDeposit;
  predecessor?: ExpenseFixedDeposit;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const initial = deposit ?? predecessor;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={
        deposit
          ? t('Save fixed deposit')
          : predecessor
            ? t('Record renewal')
            : t('Add fixed deposit')
      }
      input={(data) => ({
        depositId: deposit?.id ?? null,
        predecessorId: deposit?.predecessor_id ?? predecessor?.id ?? null,
        fundId: data.get('fundId'),
        accountId: data.get('accountId') || null,
        bankName: data.get('bankName'),
        reference: data.get('reference') || null,
        principalRupees: data.get('principalRupees') || null,
        quotedRate: data.get('quotedRate') || null,
        depositOn: data.get('depositOn'),
        maturityOn: data.get('maturityOn'),
        maturityValueRupees: data.get('maturityValueRupees') || null,
        expectedUpdatedAt: deposit?.updated_at ?? null,
      })}
    >
      <SelectInput
        id={`${id}-fund`}
        label={t('Fund')}
        name="fundId"
        required
        defaultValue={initial?.fund_id ?? ''}
        options={funds
          .filter((fund) => fund.active)
          .map((fund) => ({ value: fund.id, label: fund.name }))}
      />
      <SelectInput
        id={`${id}-account`}
        label={t('Deposit account')}
        name="accountId"
        defaultValue={initial?.account_id ?? ''}
        options={[
          { value: '', label: t('Not reconciled yet') },
          ...accounts
            .filter((account) => account.account_type === 'deposit')
            .map((account) => ({ value: account.id, label: account.name })),
        ]}
        helpText={t(
          'The Accounts deposit account holds the real money; register figures are never added to Accounts totals.',
        )}
      />
      <TextInput
        id={`${id}-bank`}
        label={t('Bank name')}
        name="bankName"
        required
        maxLength={120}
        defaultValue={initial?.bank_name ?? ''}
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Bank reference (admin only)')}
        name="reference"
        maxLength={120}
        defaultValue={deposit?.reference ?? ''}
      />
      <AmountInput
        id={`${id}-principal`}
        label={t('Confirmed principal, if known')}
        name="principalRupees"
        defaultValue={
          initial?.principal_paise == null
            ? ''
            : rupeesFromPaise(initial.principal_paise)
        }
      />
      <TextInput
        id={`${id}-rate`}
        label={t('Quoted annual rate %, if known')}
        name="quotedRate"
        inputMode="decimal"
        defaultValue={
          initial?.quoted_rate == null ? '' : String(initial.quoted_rate)
        }
        helpText={t('Use the bank-provided quoted rate, not an estimate.')}
      />
      <TextInput
        id={`${id}-deposit-on`}
        label={t('Deposit date')}
        name="depositOn"
        type="date"
        required
        max={today}
        defaultValue={predecessor?.maturity_on ?? deposit?.deposit_on ?? today}
      />
      <TextInput
        id={`${id}-maturity-on`}
        label={t('Maturity date')}
        name="maturityOn"
        type="date"
        required
        defaultValue={deposit?.maturity_on ?? ''}
      />
      <AmountInput
        id={`${id}-maturity-value`}
        label={t('Quoted maturity value, if known')}
        name="maturityValueRupees"
        defaultValue={
          initial?.maturity_value_paise == null
            ? ''
            : rupeesFromPaise(initial.maturity_value_paise)
        }
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundInterestForm({
  funds,
  deposits,
  interestEntries,
  record,
  action = saveExpenseFundInterestAction,
}: {
  funds: readonly ExpenseFund[];
  deposits: readonly ExpenseFixedDeposit[];
  interestEntries: readonly {
    entry_id: string;
    voucher_no: string;
    entry_date: string;
    counterparty: string;
    amount_paise: number;
  }[];
  record?: ExpenseFundInterestRecord;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={
        record ? t('Save interest record') : t('Add interest record')
      }
      input={(data) => ({
        recordId: record?.id ?? null,
        fundId: data.get('fundId'),
        fixedDepositId: data.get('fixedDepositId') || null,
        incomeEntryId: data.get('incomeEntryId') || null,
        sourceLabel: data.get('sourceLabel'),
        periodFrom: data.get('periodFrom'),
        periodTo: data.get('periodTo'),
        grossInterestRupees: data.get('grossInterestRupees') || null,
        taxWithheldRupees: data.get('taxWithheldRupees') || null,
        actualCreditRupees: data.get('actualCreditRupees') || null,
        averageBalanceRupees: data.get('averageBalanceRupees') || null,
        note: data.get('note') || null,
        expectedUpdatedAt: record?.updated_at ?? null,
      })}
    >
      <SelectInput
        id={`${id}-fund`}
        label={t('Fund')}
        name="fundId"
        required
        defaultValue={record?.fund_id ?? ''}
        options={funds
          .filter((fund) => fund.active)
          .map((fund) => ({ value: fund.id, label: fund.name }))}
      />
      <SelectInput
        id={`${id}-deposit`}
        label={t('Source fixed deposit, if any')}
        name="fixedDepositId"
        defaultValue={record?.fixed_deposit_id ?? ''}
        options={[
          { value: '', label: t('Other interest source') },
          ...deposits.map((deposit) => ({
            value: deposit.id,
            label: `${deposit.bank_name} · ${deposit.fund_name}`,
          })),
        ]}
      />
      <TextInput
        id={`${id}-source`}
        label={t('Interest source')}
        name="sourceLabel"
        required
        maxLength={120}
        defaultValue={record?.source_label ?? ''}
      />
      <TextInput
        id={`${id}-from`}
        label={t('Period start')}
        name="periodFrom"
        type="date"
        required
        defaultValue={record?.period_from ?? ''}
      />
      <TextInput
        id={`${id}-to`}
        label={t('Period end')}
        name="periodTo"
        type="date"
        required
        defaultValue={record?.period_to ?? ''}
      />
      <AmountInput
        id={`${id}-gross`}
        label={t('Bank-reported gross interest')}
        name="grossInterestRupees"
        defaultValue={
          record?.gross_interest_paise === null ||
          record?.gross_interest_paise === undefined
            ? ''
            : rupeesFromPaise(record.gross_interest_paise)
        }
      />
      <AmountInput
        id={`${id}-tds`}
        label={t('Tax withheld, TDS')}
        name="taxWithheldRupees"
        defaultValue={
          record?.tax_withheld_paise === null ||
          record?.tax_withheld_paise === undefined
            ? ''
            : rupeesFromPaise(record.tax_withheld_paise)
        }
      />
      <AmountInput
        id={`${id}-credit`}
        label={t('Bank-reported actual credit')}
        name="actualCreditRupees"
        defaultValue={
          record?.actual_credit_paise === null ||
          record?.actual_credit_paise === undefined
            ? ''
            : rupeesFromPaise(record.actual_credit_paise)
        }
      />
      <AmountInput
        id={`${id}-average`}
        label={t('Bank-provided average balance')}
        name="averageBalanceRupees"
        defaultValue={
          record?.average_balance_paise === null ||
          record?.average_balance_paise === undefined
            ? ''
            : rupeesFromPaise(record.average_balance_paise)
        }
        helpText={t('Leave blank when the bank did not provide it.')}
      />
      <SelectInput
        id={`${id}-income`}
        label={t('Linked Accounts interest income')}
        name="incomeEntryId"
        defaultValue={record?.income_entry_id ?? ''}
        options={[
          { value: '', label: t('Not linked yet') },
          ...interestEntries.map((entry) => ({
            value: entry.entry_id,
            label: `${entry.voucher_no} · ${entry.counterparty}`,
          })),
        ]}
      />
      <TextAreaInput
        id={`${id}-note`}
        label={t('Notes')}
        name="note"
        maxLength={2000}
        defaultValue={record?.note ?? ''}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundTransferRuleForm({
  funds,
  rule,
  action = saveExpenseFundTransferRuleAction,
}: {
  funds: readonly ExpenseFund[];
  rule?: ExpenseFundTransferRule;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={rule ? t('Save transfer pair') : t('Add transfer pair')}
      input={(data) => ({
        ruleId: rule?.id ?? null,
        fromFundId: rule?.from_fund_id ?? data.get('fromFundId'),
        toFundId: rule?.to_fund_id ?? data.get('toFundId'),
        active: data.get('active') === 'on',
        expectedUpdatedAt: rule?.updated_at ?? null,
      })}
    >
      {rule ? (
        <p>
          {rule.from_fund_name} → {rule.to_fund_name}
        </p>
      ) : (
        <div className="grid gap-space-3 medium:grid-cols-2">
          <SelectInput
            id={`${id}-from`}
            label={t('Source fund')}
            name="fromFundId"
            required
            options={funds
              .filter((fund) => fund.active)
              .map((fund) => ({ value: fund.id, label: fund.name }))}
          />
          <SelectInput
            id={`${id}-to`}
            label={t('Target fund')}
            name="toFundId"
            required
            options={funds
              .filter((fund) => fund.active)
              .map((fund) => ({ value: fund.id, label: fund.name }))}
          />
        </div>
      )}
      <CheckboxInput
        id={`${id}-active`}
        label={t('Active pair')}
        name="active"
        defaultChecked={rule?.active ?? true}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundTransferForm({
  rules,
  today,
  action = recordExpenseFundTransferAction,
}: {
  rules: readonly ExpenseFundTransferRule[];
  today: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const activeRules = rules.filter((rule) => rule.active);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Transfer allocation')}
      input={(data) => {
        const rule = activeRules.find(
          (candidate) => candidate.id === data.get('ruleId'),
        );
        if (!rule) throw new Error('Choose an active transfer pair.');
        return {
          fromFundId: rule.from_fund_id,
          toFundId: rule.to_fund_id,
          transferOn: data.get('transferOn'),
          amountRupees: data.get('amountRupees'),
          reason: data.get('reason'),
          decisionReference: data.get('decisionReference'),
        };
      }}
    >
      <SelectInput
        id={`${id}-rule`}
        label={t('Fund pair')}
        name="ruleId"
        required
        options={activeRules.map((rule) => ({
          value: rule.id,
          label: `${rule.from_fund_name} → ${rule.to_fund_name}`,
        }))}
      />
      <TextInput
        id={`${id}-date`}
        label={t('Transfer date')}
        name="transferOn"
        type="date"
        required
        max={today}
        defaultValue={today}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount')}
        name="amountRupees"
        required
      />
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Reason')}
        name="reason"
        required
        maxLength={1000}
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Decision reference')}
        name="decisionReference"
        required
        maxLength={120}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundTransferReverseForm({
  transfer,
  today,
  action = reverseExpenseFundTransferAction,
}: {
  transfer: ExpenseFundTransfer;
  today: string;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Reverse allocation transfer')}
      input={(data) => ({
        transferId: transfer.id,
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
        min={transfer.transfer_on}
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

export function ExpenseFundCorpusForm({
  funds,
  units,
  today,
  record,
  action = saveExpenseFundCorpusAction,
}: {
  funds: readonly ExpenseFund[];
  units: readonly { id: string; label: string }[];
  today: string;
  record?: ExpenseFundCorpusRecord;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={record ? t('Save corpus record') : t('Add corpus record')}
      input={(data) => ({
        recordId: record?.id ?? null,
        unitId: data.get('unitId'),
        fundId: data.get('fundId'),
        eventDescription: data.get('eventDescription'),
        eventOn: data.get('eventOn'),
        reportedAmountRupees: data.get('reportedAmountRupees'),
        concessionRupees: data.get('concessionRupees') || '0',
        concessionReason: data.get('concessionReason') || null,
        decisionReference: data.get('decisionReference'),
        expectedUpdatedAt: record?.updated_at ?? null,
      })}
    >
      <SelectInput
        id={`${id}-unit`}
        label={t('Unit')}
        name="unitId"
        required
        defaultValue={record?.unit_id ?? ''}
        options={units.map((unit) => ({ value: unit.id, label: unit.label }))}
      />
      <SelectInput
        id={`${id}-fund`}
        label={t('Fund')}
        name="fundId"
        required
        defaultValue={record?.fund_id ?? ''}
        options={funds
          .filter((fund) => fund.active)
          .map((fund) => ({ value: fund.id, label: fund.name }))}
      />
      <TextAreaInput
        id={`${id}-description`}
        label={t('Corpus event description')}
        name="eventDescription"
        required
        maxLength={1000}
        defaultValue={record?.event_description ?? ''}
      />
      <TextInput
        id={`${id}-date`}
        label={t('Event date')}
        name="eventOn"
        type="date"
        required
        max={today}
        defaultValue={record?.event_on ?? today}
      />
      <AmountInput
        id={`${id}-reported`}
        label={t('Reported amount')}
        name="reportedAmountRupees"
        required
        defaultValue={
          record ? rupeesFromPaise(record.reported_amount_paise) : ''
        }
      />
      <AmountInput
        id={`${id}-concession`}
        label={t('Concession')}
        name="concessionRupees"
        required
        defaultValue={record ? rupeesFromPaise(record.concession_paise) : '0'}
      />
      <TextAreaInput
        id={`${id}-concession-reason`}
        label={t('Concession reason')}
        name="concessionReason"
        maxLength={1000}
        defaultValue={record?.concession_reason ?? ''}
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Decision reference')}
        name="decisionReference"
        required
        maxLength={120}
        defaultValue={record?.decision_reference ?? ''}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundReceiptLinkForm({
  record,
  receipts,
  action = linkExpenseFundReceiptAction,
}: {
  record: ExpenseFundCorpusRecord;
  receipts: readonly {
    entry_id: string;
    fund_id: string;
    voucher_no: string;
    entry_date: string;
    counterparty: string;
    amount_paise: number;
  }[];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const matching = receipts.filter(
    (receipt) => receipt.fund_id === record.fund_id,
  );
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Link receipt')}
      submitDisabled={!matching.length || record.remaining_paise <= 0}
      input={(data) => ({
        corpusRecordId: record.id,
        entryId: data.get('entryId'),
        amountRupees: data.get('amountRupees'),
      })}
    >
      <SelectInput
        id={`${id}-receipt`}
        label={t('Accounts receipt')}
        name="entryId"
        required
        options={matching.map((receipt) => ({
          value: receipt.entry_id,
          label: `${receipt.voucher_no} · ${receipt.counterparty}`,
        }))}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount to link')}
        name="amountRupees"
        required
        helpText={t('A missing link is not proof that no payment was made.')}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundWorkForm({
  funds,
  resolutions,
  today,
  work,
  action = saveExpenseFundWorkAction,
}: {
  funds: readonly ExpenseFund[];
  resolutions: readonly {
    id: string;
    title: string;
    version: number;
    outcome: 'passed';
  }[];
  today: string;
  work?: ExpenseFundWork;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={work ? t('Save sanctioned work') : t('Add sanctioned work')}
      input={(data) => ({
        workId: work?.id ?? null,
        fundId: data.get('fundId'),
        title: data.get('title'),
        sanctionedAmountRupees: data.get('sanctionedAmountRupees'),
        sanctionedOn: data.get('sanctionedOn'),
        validUntil: data.get('validUntil') || null,
        meetingResolutionId:
          data.get('authority') === 'resolution'
            ? data.get('meetingResolutionId')
            : null,
        externalReference:
          data.get('authority') === 'external'
            ? data.get('externalReference') || null
            : null,
        expectedUpdatedAt: work?.updated_at ?? null,
      })}
    >
      <SelectInput
        id={`${id}-fund`}
        label={t('Fund')}
        name="fundId"
        required
        defaultValue={work?.fund_id ?? ''}
        options={funds
          .filter((fund) => fund.active)
          .map((fund) => ({ value: fund.id, label: fund.name }))}
      />
      <TextInput
        id={`${id}-title`}
        label={t('Sanctioned work')}
        name="title"
        required
        maxLength={200}
        defaultValue={work?.title ?? ''}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Sanctioned amount')}
        name="sanctionedAmountRupees"
        required
        defaultValue={work ? rupeesFromPaise(work.sanctioned_amount_paise) : ''}
      />
      <TextInput
        id={`${id}-sanctioned-on`}
        label={t('Sanctioned on')}
        name="sanctionedOn"
        type="date"
        required
        max={today}
        defaultValue={work?.sanctioned_on ?? today}
      />
      <TextInput
        id={`${id}-valid-until`}
        label={t('Valid until, optional')}
        name="validUntil"
        type="date"
        defaultValue={work?.valid_until ?? ''}
      />
      <SelectInput
        id={`${id}-authority`}
        label={t('Authority source')}
        name="authority"
        required
        defaultValue={
          work?.external_reference
            ? 'external'
            : work?.meeting_resolution_id
              ? 'resolution'
              : resolutions.length
                ? 'resolution'
                : 'external'
        }
        options={[
          { value: 'resolution', label: t('Passed Homeish resolution') },
          { value: 'external', label: t('External decision reference') },
        ]}
      />
      <SelectInput
        id={`${id}-resolution`}
        label={t('Homeish resolution')}
        name="meetingResolutionId"
        defaultValue={work?.meeting_resolution_id ?? ''}
        options={[
          { value: '', label: t('No resolution') },
          ...resolutions.map((resolution) => ({
            value: resolution.id,
            label: resolution.title,
          })),
        ]}
      />
      <TextInput
        id={`${id}-external`}
        label={t('External decision reference')}
        name="externalReference"
        maxLength={120}
        defaultValue={work?.external_reference ?? ''}
        helpText={t(
          'A reference records the decision; it does not itself prove authority.',
        )}
      />
    </ModuleActionForm>
  );
}

export function ExpenseFundWorkLinkForm({
  work,
  expenses,
  action = linkExpenseFundWorkAction,
}: {
  work: ExpenseFundWork;
  expenses: readonly {
    entry_id: string;
    fund_id: string;
    voucher_no: string;
    entry_date: string;
    payee: string;
    amount_paise: number;
  }[];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const matching = expenses.filter(
    (expense) => expense.fund_id === work.fund_id && expense.amount_paise > 0,
  );
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Link Accounts expense')}
      submitDisabled={!matching.length}
      input={(data) => ({
        workId: work.id,
        entryId: data.get('entryId'),
        amountRupees: data.get('amountRupees'),
      })}
    >
      <SelectInput
        id={`${id}-expense`}
        label={t('Accounts expense')}
        name="entryId"
        required
        options={matching.map((expense) => ({
          value: expense.entry_id,
          label: `${expense.voucher_no} · ${expense.payee}`,
        }))}
      />
      <AmountInput
        id={`${id}-amount`}
        label={t('Amount to link')}
        name="amountRupees"
        required
      />
    </ModuleActionForm>
  );
}
