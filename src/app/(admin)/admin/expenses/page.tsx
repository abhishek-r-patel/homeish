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
import { entrySourceLabel, incomeSourceLabel } from '@/core/expense/documents';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

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
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const formatDate = (value: string) =>
    formatLocalizedDate(
      new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
      locale,
      { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
    );
  const formatSignedCurrency = (paise: number) =>
    `${paise < 0 ? '-' : ''}${formatLocalizedCurrency(Math.abs(paise), locale)}`;
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
      <h1 className="text-title font-semibold">{t('Society accounts')}</h1>
      <ExpenseNav current="book" canManage={w.can_manage} locale={locale} />
      {!w.can_manage ? (
        <p>
          {t(
            'Committee access: review the books and approve large expenses recorded by others.',
          )}
        </p>
      ) : null}
      {w.accounts.length === 0 ? (
        <Card title={t('Set up accounts')}>
          <p>
            {t('No cash or bank accounts yet.')}{' '}
            {w.can_manage ? (
              <Link
                className="text-brand underline"
                href="/admin/expenses/setup"
              >
                {t("Add the society's accounts and opening balances")}
              </Link>
            ) : (
              t('An administrator needs to add them first.')
            )}
          </p>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-space-3 medium:grid-cols-3">
          {w.accounts.map((a) => (
            <StatTile
              key={a.id}
              label={`${a.name}${a.active ? '' : ` (${t('inactive')})`}`}
              value={formatSignedCurrency(a.balance_paise)}
              context={
                a.account_type === 'cash' ? t('Cash') : t('Bank account')
              }
            />
          ))}
        </div>
      )}

      <Card
        title={t('Awaiting committee approval')}
        description={t(
          'Expenses above {amount} post only after a committee member who did not record them approves.',
          {
            amount: formatLocalizedCurrency(
              w.settings.approval_threshold_paise,
              locale,
            ),
          },
        )}
      >
        {w.pending.length ? (
          <ul className="grid min-w-0 gap-space-3">
            {w.pending.map((e) => (
              <li
                key={e.id}
                className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {e.payee} · {formatLocalizedCurrency(e.amount_paise, locale)}
                </p>
                <p>
                  {formatDate(e.spent_on)} · {e.category_name} ·{' '}
                  {e.account_name} · {e.payment_mode.toUpperCase()}
                  {e.reference ? ` · ${e.reference}` : ''}
                </p>
                {e.description ? <p>{e.description}</p> : null}
                <p className="text-caption text-ink-muted">
                  {t('Recorded by')} {e.recorded_by_name}
                </p>
                {e.receiptUrl ? (
                  <a
                    href={e.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand underline"
                  >
                    {t('View private receipt')}
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
                      ? t(
                          'Another committee member must approve an expense you recorded.',
                        )
                      : t('Waiting for a committee member to decide.')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No expenses are waiting for approval.')}</p>
        )}
        {w.pendingTotal > w.pending.length ? (
          <p className="mt-space-3 text-caption text-ink-muted">
            {t('Showing the first {shown} of {total}.', {
              shown: formatLocalizedNumber(w.pending.length, locale),
              total: formatLocalizedNumber(w.pendingTotal, locale),
            })}
          </p>
        ) : null}
      </Card>

      {w.can_manage && w.accounts.some((a) => a.active) ? (
        <div className="grid min-w-0 gap-space-5 medium:grid-cols-2">
          <Card title={t('Record expense')}>
            <ExpenseRecordForm
              accounts={w.accounts}
              categories={w.categories}
              today={w.today}
              thresholdPaise={w.settings.approval_threshold_paise}
            />
          </Card>
          <Card title={t('Record other income')}>
            <ExpenseIncomeForm accounts={w.accounts} today={w.today} />
          </Card>
        </div>
      ) : null}

      <Card
        title={t('Cash and bank book')}
        description={t(
          'Entries are permanent. Correct mistakes by recording a reversal.',
        )}
      >
        <form
          method="get"
          className="grid min-w-0 gap-space-3 medium:grid-cols-4"
        >
          <label className="grid min-w-0 gap-space-1">
            {t('From')}
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              max={w.today}
              className={fieldClass}
            />
          </label>
          <label className="grid min-w-0 gap-space-1">
            {t('To')}
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              className={fieldClass}
            />
          </label>
          <label className="grid min-w-0 gap-space-1">
            {t('Account')}
            <select
              name="account"
              defaultValue={account ?? ''}
              className={fieldClass}
            >
              <option value="">{t('All accounts')}</option>
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
            {t('Show entries')}
          </button>
        </form>
        <p className="mt-space-3 text-caption text-ink-muted">
          {t('{count} entries from {from} to {to}.', {
            count: formatLocalizedNumber(entries.total, locale),
            from: formatDate(range.from),
            to: formatDate(range.to),
          })}
        </p>
        <ul className="mt-space-3 grid min-w-0 gap-space-3">
          {entries.rows.map((e) => (
            <li
              key={e.id}
              className="grid min-w-0 gap-space-1 rounded-md border border-rule p-space-3"
            >
              <p className="flex flex-wrap justify-between gap-space-2 text-body-strong">
                <span>
                  {formatDate(e.entry_date)} · {e.counterparty}
                </span>
                <span className={e.direction === 'in' ? 'text-success' : ''}>
                  {e.direction === 'in' ? '+' : '−'}
                  {formatLocalizedCurrency(e.amount_paise, locale)}
                </span>
              </p>
              <p>
                {t('Voucher')} {e.voucher_no} · {entrySourceLabel(e.source)} ·{' '}
                {e.category_name ??
                  (e.income_kind ? incomeSourceLabel(e.income_kind) : '')}{' '}
                · {e.account_name}
                {e.reference ? ` · ${e.reference}` : ''}
              </p>
              {e.running_balance_paise !== null ? (
                <p className="text-caption text-ink-muted">
                  {t('Balance')} {formatSignedCurrency(e.running_balance_paise)}
                </p>
              ) : null}
              {e.description ? (
                <p className="text-caption text-ink-muted">{e.description}</p>
              ) : null}
              {e.reversed_by_entry_id ? (
                <p className="text-caption text-ink-muted">{t('Reversed.')}</p>
              ) : null}
              {e.receiptUrl ? (
                <a
                  href={e.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  {t('View private receipt')}
                </a>
              ) : null}
              {w.can_manage &&
              (e.source === 'expense' || e.source === 'income') &&
              !e.reversed_by_entry_id ? (
                <details>
                  <summary className="cursor-pointer">
                    {t('Reverse entry')}
                  </summary>
                  <ExpenseReverseForm entryId={e.id} today={w.today} />
                </details>
              ) : null}
            </li>
          ))}
        </ul>
        <ExpensePager
          locale={locale}
          page={entriesPage}
          total={entries.total}
          pageSize={EXPENSE_PAGE_SIZE}
          href={(page) => query({ page })}
          label={t('Cash and bank book pages')}
        />
      </Card>

      <Card title={t('Expenses')}>
        <nav
          aria-label={t('Expense status')}
          className="flex flex-wrap gap-space-3"
        >
          <Link
            className={status ? 'text-brand underline' : 'font-semibold'}
            href={query({ status: null, expensesPage: null })}
          >
            {t('All')}
          </Link>
          {EXPENSE_STATUSES.map((s) => (
            <Link
              key={s}
              className={
                status === s ? 'font-semibold' : 'text-brand underline'
              }
              href={query({ status: s, expensesPage: null })}
            >
              {t(STATUS_LABELS[s])}
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
                {e.payee} · {formatLocalizedCurrency(e.amount_paise, locale)} ·{' '}
                {t(STATUS_LABELS[e.status])}
              </p>
              <p>
                {formatDate(e.spent_on)} · {e.category_name} · {e.account_name}
              </p>
              <p className="text-caption text-ink-muted">
                {t('Recorded by')} {e.recorded_by_name}
                {e.decided_by_name
                  ? ` · ${t(e.status === 'rejected' ? 'Rejected by {name}' : 'Approved by {name}', { name: e.decided_by_name })}`
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
                  {t('View private receipt')}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        {expenses.rows.length === 0 ? <p>{t('No expenses to show.')}</p> : null}
        <ExpensePager
          locale={locale}
          page={expensesPage}
          total={expenses.total}
          pageSize={EXPENSE_PAGE_SIZE}
          href={(page) => query({ expensesPage: page })}
          label={t('Expense pages')}
        />
      </Card>
    </section>
  );
}
