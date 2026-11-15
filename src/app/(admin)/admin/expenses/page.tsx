// Show society balances, pending approvals, the cash and bank book and expenses.
import Link from 'next/link';
import { Card, StatTile } from '@/components/ui/data-display';
import {
  ExpenseDecisionForm,
  ExpenseIncomeForm,
  ExpenseRecordForm,
  ExpenseReverseForm,
} from '@/components/expense/controls';
import { ExpenseNav, ExpensePager } from '@/components/expense/nav';
import {
  EXPENSE_PAGE_SIZE,
  getExpenseWorkspace,
  listExpenseEntries,
  listExpenses,
} from '@/core/expense/operations';
import {
  EXPENSE_STATUSES,
  expenseRangeOrDefault,
} from '@/core/expense/validation';
import {
  entrySourceLabel,
  formatSignedRupees,
  incomeSourceLabel,
} from '@/core/expense/documents';
import { formatBillingDate, formatRupees } from '@/core/billing/format';

export const metadata = {
  title: 'Accounts | Homeish',
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<(typeof EXPENSE_STATUSES)[number], string> = {
  pending_approval: 'Awaiting approval',
  posted: 'Posted',
  rejected: 'Rejected',
};
const fieldClass =
  'min-h-12 min-w-0 rounded-md border border-rule-strong bg-surface px-space-3';

function pageNumber(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    account?: string;
    page?: string;
    status?: string;
    expensesPage?: string;
  }>;
}) {
  const search = await searchParams;
  const w = await getExpenseWorkspace();
  const range = expenseRangeOrDefault(search, w.today);
  const account = w.accounts.some((a) => a.id === search.account)
    ? (search.account ?? null)
    : null;
  const status = EXPENSE_STATUSES.find((s) => s === search.status);
  const entriesPage = pageNumber(search.page);
  const expensesPage = pageNumber(search.expensesPage);
  const [entries, expenses] = await Promise.all([
    listExpenseEntries(range, account, entriesPage),
    listExpenses(status, expensesPage),
  ]);
  const query = (changes: Record<string, string | number | null>) => {
    const params = new URLSearchParams({ ...range });
    if (account) params.set('account', account);
    if (status) params.set('status', status);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, String(value));
    }
    return `/admin/expenses?${params}`;
  };

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">Society accounts</h1>
      <ExpenseNav current="book" canManage={w.can_manage} />
      {!w.can_manage ? (
        <p>
          Committee access: review the books and approve large expenses recorded
          by others.
        </p>
      ) : null}
      {w.accounts.length === 0 ? (
        <Card title="Set up accounts">
          <p>
            No cash or bank accounts yet.{' '}
            {w.can_manage ? (
              <Link
                className="text-brand underline"
                href="/admin/expenses/setup"
              >
                Add the society&apos;s accounts and opening balances
              </Link>
            ) : (
              'An administrator needs to add them first.'
            )}
          </p>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-space-3 medium:grid-cols-3">
          {w.accounts.map((a) => (
            <StatTile
              key={a.id}
              label={`${a.name}${a.active ? '' : ' (inactive)'}`}
              value={formatSignedRupees(a.balance_paise)}
              context={a.account_type === 'cash' ? 'Cash' : 'Bank account'}
            />
          ))}
        </div>
      )}

      <Card
        title="Awaiting committee approval"
        description={`Expenses above ${formatRupees(w.settings.approval_threshold_paise)} post only after a committee member who did not record them approves.`}
      >
        {w.pending.length ? (
          <ul className="grid min-w-0 gap-space-3">
            {w.pending.map((e) => (
              <li
                key={e.id}
                className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {e.payee} · {formatRupees(e.amount_paise)}
                </p>
                <p>
                  {formatBillingDate(e.spent_on)} · {e.category_name} ·{' '}
                  {e.account_name} · {e.payment_mode.toUpperCase()}
                  {e.reference ? ` · ${e.reference}` : ''}
                </p>
                {e.description ? <p>{e.description}</p> : null}
                <p className="text-caption text-ink-muted">
                  Recorded by {e.recorded_by_name}
                </p>
                {e.receiptUrl ? (
                  <a
                    href={e.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand underline"
                  >
                    View private receipt
                  </a>
                ) : null}
                {w.can_approve && e.recorded_by !== w.actor_id ? (
                  <div className="grid min-w-0 gap-space-3 medium:grid-cols-2">
                    <ExpenseDecisionForm expenseId={e.id} approve />
                    <ExpenseDecisionForm expenseId={e.id} approve={false} />
                  </div>
                ) : (
                  <p className="text-caption text-ink-muted">
                    {e.recorded_by === w.actor_id
                      ? 'Another committee member must approve an expense you recorded.'
                      : 'Waiting for a committee member to decide.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No expenses are waiting for approval.</p>
        )}
        {w.pendingTotal > w.pending.length ? (
          <p className="mt-space-3 text-caption text-ink-muted">
            Showing the first {w.pending.length} of {w.pendingTotal}.
          </p>
        ) : null}
      </Card>

      {w.can_manage && w.accounts.some((a) => a.active) ? (
        <div className="grid min-w-0 gap-space-5 medium:grid-cols-2">
          <Card title="Record expense">
            <ExpenseRecordForm
              accounts={w.accounts}
              categories={w.categories}
              today={w.today}
              thresholdPaise={w.settings.approval_threshold_paise}
            />
          </Card>
          <Card title="Record other income">
            <ExpenseIncomeForm accounts={w.accounts} today={w.today} />
          </Card>
        </div>
      ) : null}

      <Card
        title="Cash and bank book"
        description="Entries are permanent. Correct mistakes by recording a reversal."
      >
        <form
          method="get"
          className="grid min-w-0 gap-space-3 medium:grid-cols-4"
        >
          <label className="grid min-w-0 gap-space-1">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              max={w.today}
              className={fieldClass}
            />
          </label>
          <label className="grid min-w-0 gap-space-1">
            To
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              className={fieldClass}
            />
          </label>
          <label className="grid min-w-0 gap-space-1">
            Account
            <select
              name="account"
              defaultValue={account ?? ''}
              className={fieldClass}
            >
              <option value="">All accounts</option>
              {w.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-12 self-end rounded-md border border-rule"
          >
            Show entries
          </button>
        </form>
        <p className="mt-space-3 text-caption text-ink-muted">
          {entries.total} entries from {formatBillingDate(range.from)} to{' '}
          {formatBillingDate(range.to)}.
        </p>
        <ul className="mt-space-3 grid min-w-0 gap-space-3">
          {entries.rows.map((e) => (
            <li
              key={e.id}
              className="grid min-w-0 gap-space-1 rounded-md border border-rule p-space-3"
            >
              <p className="flex flex-wrap justify-between gap-space-2 text-body-strong">
                <span>
                  {formatBillingDate(e.entry_date)} · {e.counterparty}
                </span>
                <span className={e.direction === 'in' ? 'text-success' : ''}>
                  {e.direction === 'in' ? '+' : '−'}
                  {formatRupees(e.amount_paise)}
                </span>
              </p>
              <p>
                {entrySourceLabel(e.source)} ·{' '}
                {e.category_name ??
                  (e.income_kind ? incomeSourceLabel(e.income_kind) : '')}{' '}
                · {e.account_name}
                {e.reference ? ` · ${e.reference}` : ''}
              </p>
              {e.description ? (
                <p className="text-caption text-ink-muted">{e.description}</p>
              ) : null}
              {e.reversed_by_entry_id ? (
                <p className="text-caption text-ink-muted">Reversed.</p>
              ) : null}
              {e.receiptUrl ? (
                <a
                  href={e.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  View private receipt
                </a>
              ) : null}
              {w.can_manage &&
              (e.source === 'expense' || e.source === 'income') &&
              !e.reversed_by_entry_id ? (
                <details>
                  <summary className="cursor-pointer">Reverse entry</summary>
                  <ExpenseReverseForm entryId={e.id} today={w.today} />
                </details>
              ) : null}
            </li>
          ))}
        </ul>
        <ExpensePager
          page={entriesPage}
          total={entries.total}
          pageSize={EXPENSE_PAGE_SIZE}
          href={(page) => query({ page })}
          label="Cash and bank book pages"
        />
      </Card>

      <Card title="Expenses">
        <nav aria-label="Expense status" className="flex flex-wrap gap-space-3">
          <Link
            className={status ? 'text-brand underline' : 'font-semibold'}
            href={query({ status: null, expensesPage: null })}
          >
            All
          </Link>
          {EXPENSE_STATUSES.map((s) => (
            <Link
              key={s}
              className={
                status === s ? 'font-semibold' : 'text-brand underline'
              }
              href={query({ status: s, expensesPage: null })}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </nav>
        <ul className="mt-space-3 grid min-w-0 gap-space-3">
          {expenses.rows.map((e) => (
            <li
              key={e.id}
              className="grid min-w-0 gap-space-1 rounded-md border border-rule p-space-3"
            >
              <p className="text-body-strong">
                {e.payee} · {formatRupees(e.amount_paise)} ·{' '}
                {STATUS_LABELS[e.status]}
              </p>
              <p>
                {formatBillingDate(e.spent_on)} · {e.category_name} ·{' '}
                {e.account_name}
              </p>
              <p className="text-caption text-ink-muted">
                Recorded by {e.recorded_by_name}
                {e.decided_by_name
                  ? ` · ${e.status === 'rejected' ? 'Rejected' : 'Approved'} by ${e.decided_by_name}`
                  : ''}
                {e.decision_note ? ` · ${e.decision_note}` : ''}
              </p>
              {e.receiptUrl ? (
                <a
                  href={e.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  View private receipt
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        {expenses.rows.length === 0 ? <p>No expenses to show.</p> : null}
        <ExpensePager
          page={expensesPage}
          total={expenses.total}
          pageSize={EXPENSE_PAGE_SIZE}
          href={(page) => query({ expensesPage: page })}
          label="Expense pages"
        />
      </Card>
    </section>
  );
}
