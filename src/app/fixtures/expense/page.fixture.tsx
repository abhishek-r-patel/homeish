// Exercise account setup, threshold approval, reversals, vouchers, bank reconciliation
// and petty-cash counts with in-memory books.
'use client';
import { useState } from 'react';
import {
  ExpenseAccountForm,
  ExpenseDecisionForm,
  ExpenseRecordForm,
  ExpenseReverseForm,
} from '@/components/expense/controls';
import {
  CashCountForm,
  PettyCashAssignForm,
  StatementCancelForm,
  StatementItemForm,
  StatementMatchForm,
} from '@/components/expense/reconciliation-controls';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  cashCountInputSchema,
  cashDifferenceKind,
  DEFAULT_EXPENSE_APPROVAL_THRESHOLD_PAISE,
  expenseAccountInputSchema,
  expenseDecisionInputSchema,
  expenseRecordInputSchema,
  expenseReverseInputSchema,
  pettyCashAssignInputSchema,
  statementItemCancelInputSchema,
  statementItemInputSchema,
  statementItemMatchInputSchema,
  type ExpenseAccount,
  type ExpenseCategory,
} from '@/core/expense/validation';
import { formatSignedRupees } from '@/core/expense/documents';

const today = new Date().toISOString().slice(0, 10);
const financialYear =
  Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 4 ? 1 : 0);
const yearLabel = `${financialYear}-${String((financialYear + 1) % 100).padStart(2, '0')}`;
const cashAccountId = '00000000-0000-4000-8000-000000000010';
const pettyBookPaise = 500_000;
const members = [
  {
    user_id: '00000000-0000-4000-8000-000000000021',
    full_name: 'Synthetic Guard',
  },
  {
    user_id: '00000000-0000-4000-8000-000000000022',
    full_name: 'Synthetic Resident',
  },
];
const categories: ExpenseCategory[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Repairs and maintenance',
    active: true,
    updated_at: '2026-04-01T00:00:00.000Z',
  },
];
type Entry = {
  id: string;
  accountId: string;
  label: string;
  signedPaise: number;
  reversed: boolean;
};
type StatementItem = {
  id: string;
  direction: 'in' | 'out';
  amountPaise: number;
  status: 'unmatched' | 'matched' | 'cancelled';
  matchedEntryId: string | null;
  reason: string | null;
};
type CashCount = { id: string; countedPaise: number; kind: string };
type Pending = {
  id: string;
  accountId: string;
  payee: string;
  amount: number;
};

function input(data: FormData): unknown {
  const raw = data.get('input');
  if (typeof raw !== 'string') throw new Error('Missing fixture input.');
  return JSON.parse(raw);
}
function failure(message: string) {
  return { ok: false as const, code: 'VALIDATION_FAILED' as const, message };
}

export default function ExpenseFixturePage() {
  const [accounts, setAccounts] = useState<ExpenseAccount[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [items, setItems] = useState<StatementItem[]>([]);
  const [custodianId, setCustodianId] = useState<string | null>(null);
  const [counts, setCounts] = useState<CashCount[]>([]);
  const voucher = (entry: Entry) => {
    const receipt = entry.signedPaise > 0;
    const sequence = entries
      .slice(0, entries.indexOf(entry) + 1)
      .filter((row) => row.signedPaise > 0 === receipt).length;
    return `${receipt ? 'RV' : 'PV'}/${yearLabel}/${sequence}`;
  };
  const bankAccount = accounts.find((a) => a.account_type === 'bank');
  const matchedIds = new Set(items.map((item) => item.matchedEntryId));
  const balance = (account: ExpenseAccount) =>
    account.opening_balance_paise +
    entries
      .filter((e) => e.accountId === account.id)
      .reduce((sum, e) => sum + e.signedPaise, 0);

  const saveAccount: ModuleFormAction = async (data) => {
    const parsed = expenseAccountInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    const v = parsed.data;
    setAccounts((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        name: v.name,
        account_type: v.accountType,
        opening_balance_paise: v.openingBalanceRupees,
        opening_on: v.openingOn,
        active: v.active,
        updated_at: new Date().toISOString(),
        balance_paise: 0,
        has_entries: false,
      },
    ]);
    return { ok: true, message: 'Account saved.' };
  };
  const record: ModuleFormAction = async (data) => {
    const parsed = expenseRecordInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    const v = parsed.data;
    const account = accounts.find((a) => a.id === v.accountId);
    if ((v.paymentMode === 'cash') !== (account?.account_type === 'cash'))
      return failure('Cash payments must use a cash account.');
    if (v.amountRupees > DEFAULT_EXPENSE_APPROVAL_THRESHOLD_PAISE) {
      setPending((rows) => [
        ...rows,
        {
          id: crypto.randomUUID(),
          accountId: v.accountId,
          payee: v.payee,
          amount: v.amountRupees,
        },
      ]);
      return { ok: true, message: 'Expense sent for committee approval.' };
    }
    setEntries((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        accountId: v.accountId,
        label: `Paid ${v.payee}`,
        signedPaise: -v.amountRupees,
        reversed: false,
      },
    ]);
    return { ok: true, message: 'Expense posted to the books.' };
  };
  const decide: ModuleFormAction = async (data) => {
    const parsed = expenseDecisionInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    const v = parsed.data;
    const expense = pending.find((p) => p.id === v.expenseId);
    if (!expense) return failure('This expense was already decided.');
    setPending((rows) => rows.filter((p) => p.id !== v.expenseId));
    if (v.approve)
      setEntries((rows) => [
        ...rows,
        {
          id: crypto.randomUUID(),
          accountId: expense.accountId,
          label: `Paid ${expense.payee}`,
          signedPaise: -expense.amount,
          reversed: false,
        },
      ]);
    return {
      ok: true,
      message: v.approve ? 'Expense approved and posted.' : 'Expense rejected.',
    };
  };
  const reverse: ModuleFormAction = async (data) => {
    const parsed = expenseReverseInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    const original = entries.find((e) => e.id === parsed.data.entryId);
    if (!original || original.reversed)
      return failure('This entry is already reversed.');
    setEntries((rows) => [
      ...rows.map((e) => (e.id === original.id ? { ...e, reversed: true } : e)),
      {
        id: crypto.randomUUID(),
        accountId: original.accountId,
        label: `Reversal of ${original.label}`,
        signedPaise: -original.signedPaise,
        reversed: true,
      },
    ]);
    return { ok: true, message: 'Reversal recorded.' };
  };

  const recordItem: ModuleFormAction = async (data) => {
    const parsed = statementItemInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    const v = parsed.data;
    setItems((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        direction: v.direction,
        amountPaise: v.amountRupees,
        status: 'unmatched',
        matchedEntryId: null,
        reason: null,
      },
    ]);
    return { ok: true, message: 'Statement item added.' };
  };
  const matchItem: ModuleFormAction = async (data) => {
    const parsed = statementItemMatchInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    if (matchedIds.has(parsed.data.entryId))
      return failure('This statement item is already settled.');
    setItems((rows) =>
      rows.map((item) =>
        item.id === parsed.data.itemId
          ? { ...item, status: 'matched', matchedEntryId: parsed.data.entryId }
          : item,
      ),
    );
    return { ok: true, message: 'Statement item matched.' };
  };
  const cancelItem: ModuleFormAction = async (data) => {
    const parsed = statementItemCancelInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    setItems((rows) =>
      rows.map((item) =>
        item.id === parsed.data.itemId
          ? { ...item, status: 'cancelled', reason: parsed.data.reason }
          : item,
      ),
    );
    return { ok: true, message: 'Statement item cancelled.' };
  };
  const assignCustodian: ModuleFormAction = async (data) => {
    const parsed = pettyCashAssignInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    const v = parsed.data;
    if (custodianId && v.custodianUserId === custodianId)
      return { ok: true, message: 'Petty cash custodian saved.' };
    if (custodianId && v.handoverCountRupees === null)
      return failure(
        'Choose the active cash account and an active member. Changing the custodian needs the handover count.',
      );
    if (v.handoverCountRupees !== null) {
      const counted = v.handoverCountRupees;
      setCounts((rows) => [
        { id: crypto.randomUUID(), countedPaise: counted, kind: 'handover' },
        ...rows,
      ]);
    }
    setCustodianId(v.custodianUserId);
    return { ok: true, message: 'Petty cash custodian saved.' };
  };
  const recordCount: ModuleFormAction = async (data) => {
    const parsed = cashCountInputSchema.safeParse(input(data));
    if (!parsed.success) return failure(parsed.error.issues[0].message);
    const counted = parsed.data.countedRupees;
    setCounts((rows) => [
      { id: crypto.randomUUID(), countedPaise: counted, kind: 'routine' },
      ...rows,
    ]);
    return { ok: true, message: 'Cash count recorded.' };
  };
  const differenceText = (countedPaise: number) => {
    const difference = countedPaise - pettyBookPaise;
    const kind = cashDifferenceKind(difference);
    if (kind === 'matches') return 'Matches the book';
    return `${formatSignedRupees(Math.abs(difference))} ${kind}`;
  };

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink [overflow-wrap:anywhere]">
      <Banner title="Synthetic accounts fixture" tone="info">
        Development-only simulated actions. No database writes. Reload to reset.
      </Banner>
      <h1 className="text-title font-semibold">Accounts workflows</h1>
      <section aria-label="Add account" className="grid min-w-0 gap-space-3">
        <h2 className="text-heading font-semibold">Add account</h2>
        <ExpenseAccountForm today={today} action={saveAccount} />
      </section>
      <section aria-label="Balances" className="grid min-w-0 gap-space-2">
        <h2 className="text-heading font-semibold">Balances</h2>
        {accounts.map((a) => (
          <p key={a.id}>
            {a.name} balance: {formatSignedRupees(balance(a))}
          </p>
        ))}
      </section>
      {accounts.length ? (
        <section
          aria-label="Record expense"
          className="grid min-w-0 gap-space-3"
        >
          <h2 className="text-heading font-semibold">Record expense</h2>
          <ExpenseRecordForm
            accounts={accounts}
            categories={categories}
            today={today}
            thresholdPaise={DEFAULT_EXPENSE_APPROVAL_THRESHOLD_PAISE}
            action={record}
          />
        </section>
      ) : null}
      <section
        aria-label="Pending approval"
        className="grid min-w-0 gap-space-3"
      >
        <h2 className="text-heading font-semibold">Pending approval</h2>
        {pending.map((p) => (
          <div key={p.id} className="grid min-w-0 gap-space-3">
            <p>Pending: {p.payee}</p>
            <ExpenseDecisionForm expenseId={p.id} approve action={decide} />
          </div>
        ))}
      </section>
      <section aria-label="Book" className="grid min-w-0 gap-space-3">
        <h2 className="text-heading font-semibold">Book</h2>
        {entries.map((e) => (
          <div key={e.id} className="grid min-w-0 gap-space-3">
            <p>Entry: {e.label}</p>
            <p>Voucher {voucher(e)}</p>
            {!e.reversed ? (
              <ExpenseReverseForm
                entryId={e.id}
                today={today}
                action={reverse}
              />
            ) : null}
          </div>
        ))}
      </section>
      {bankAccount ? (
        <section
          aria-label="Reconciliation"
          className="grid min-w-0 gap-space-3"
        >
          <h2 className="text-heading font-semibold">Reconciliation</h2>
          <StatementItemForm
            accountId={bankAccount.id}
            today={today}
            action={recordItem}
          />
          <ul className="grid min-w-0 gap-space-3">
            {items.map((item) => {
              const matched = entries.find((e) => e.id === item.matchedEntryId);
              const candidates = entries.filter(
                (e) =>
                  e.accountId === bankAccount.id &&
                  !matchedIds.has(e.id) &&
                  e.signedPaise > 0 === (item.direction === 'in') &&
                  Math.abs(e.signedPaise) === item.amountPaise,
              );
              return (
                <li key={item.id} className="grid min-w-0 gap-space-2">
                  <p>
                    Item {item.direction} {formatSignedRupees(item.amountPaise)}
                    : {item.status}
                  </p>
                  {matched ? <p>Matched to {voucher(matched)}</p> : null}
                  {item.reason ? <p>Cancelled: {item.reason}</p> : null}
                  {item.status === 'unmatched' && candidates.length ? (
                    <StatementMatchForm
                      itemId={item.id}
                      candidates={candidates.map((e) => ({
                        id: e.id,
                        label: `${voucher(e)} ${e.label}`,
                      }))}
                      action={matchItem}
                    />
                  ) : null}
                  {item.status === 'unmatched' ? (
                    <StatementCancelForm itemId={item.id} action={cancelItem} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <section aria-label="Petty cash" className="grid min-w-0 gap-space-3">
        <h2 className="text-heading font-semibold">Petty cash</h2>
        <p>Book: {formatSignedRupees(pettyBookPaise)}</p>
        <p>
          Custodian:{' '}
          {members.find((m) => m.user_id === custodianId)?.full_name ??
            'Not named'}
        </p>
        <PettyCashAssignForm
          key={custodianId ?? 'none'}
          accountId={cashAccountId}
          members={members}
          currentCustodianId={custodianId}
          action={assignCustodian}
        />
        {custodianId ? (
          <CashCountForm
            today={today}
            openingOn={`${financialYear}-04-01`}
            action={recordCount}
          />
        ) : null}
        <ul className="grid min-w-0 gap-space-2">
          {counts.map((count) => (
            <li key={count.id}>
              Count ({count.kind}): {differenceText(count.countedPaise)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
