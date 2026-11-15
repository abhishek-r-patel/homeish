// Summarize income and expenditure, export the books and close finished months.
import { Card, StatTile } from '@/components/ui/data-display';
import {
  ExpenseMonthCloseForm,
  ExpenseMonthReopenForm,
} from '@/components/expense/controls';
import { ExpenseNav } from '@/components/expense/nav';
import {
  getExpenseReport,
  getExpenseWorkspace,
} from '@/core/expense/operations';
import { expenseRangeOrDefault } from '@/core/expense/validation';
import {
  formatSignedRupees,
  incomeSourceLabel,
} from '@/core/expense/documents';
import {
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
} from '@/core/billing/format';

export const metadata = {
  title: 'Accounts reports | Homeish',
  robots: { index: false, follow: false },
};
const fieldClass =
  'min-h-12 min-w-0 rounded-md border border-rule-strong bg-surface px-space-3';

function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split('-').map(Number);
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > end) return months;
    months.push(`${key}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

export default async function ExpenseReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const search = await searchParams;
  const w = await getExpenseWorkspace();
  const range = expenseRangeOrDefault(search, w.today);
  const report = await getExpenseReport(range);
  const totals = new Map(report.months.map((m) => [m.month, m]));
  const closed = new Set(w.closed_months);
  const currentMonth = `${w.today.slice(0, 7)}-01`;
  const query = new URLSearchParams(range);
  const surplus = report.income_paise - report.expense_paise;

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">Accounts reports</h1>
      <ExpenseNav current="reports" canManage={w.can_manage} />
      <Card title="Period">
        <form
          method="get"
          className="grid min-w-0 gap-space-3 medium:grid-cols-3"
        >
          <label className="grid min-w-0 gap-space-1">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.from}
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
          <button
            type="submit"
            className="min-h-12 self-end rounded-md border border-rule"
          >
            Show report
          </button>
        </form>
        <p className="mt-space-3 text-caption text-ink-muted">
          {formatBillingDate(report.from)} to {formatBillingDate(report.to)}.
          Periods up to two years. The financial year runs April to March.
        </p>
        <div className="mt-space-3 flex flex-wrap gap-space-4">
          <a
            className="text-brand underline"
            href={`/api/expense/export?${query}&format=csv`}
          >
            Download entries CSV
          </a>
          <a
            className="text-brand underline"
            href={`/api/expense/export?${query}&format=pdf`}
          >
            Download summary PDF
          </a>
        </div>
      </Card>

      <div className="grid min-w-0 gap-space-3 medium:grid-cols-3">
        <StatTile label="Income" value={formatRupees(report.income_paise)} />
        <StatTile
          label="Expenditure"
          value={formatRupees(report.expense_paise)}
        />
        <StatTile
          label={surplus < 0 ? 'Deficit' : 'Surplus'}
          value={formatSignedRupees(surplus)}
        />
      </div>
      {report.billing_enabled && report.outstanding_dues_paise !== null ? (
        <p>
          Outstanding maintenance dues today:{' '}
          {formatRupees(report.outstanding_dues_paise)}
        </p>
      ) : null}

      <Card title="Month by month">
        <ul className="grid min-w-0 gap-space-3">
          {monthsBetween(report.from, report.to).map((month) => {
            const row = totals.get(month);
            const isClosed = closed.has(month);
            return (
              <li
                key={month}
                className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {formatBillingPeriod(month)}
                  {isClosed ? ' · Closed' : ''}
                </p>
                <p>
                  Income {formatRupees(row?.income_paise ?? 0)} · Expenditure{' '}
                  {formatRupees(row?.expense_paise ?? 0)}
                </p>
                {w.can_manage && month < currentMonth ? (
                  isClosed ? (
                    <details>
                      <summary className="cursor-pointer">Reopen month</summary>
                      <ExpenseMonthReopenForm month={month} />
                    </details>
                  ) : (
                    <ExpenseMonthCloseForm month={month} />
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid min-w-0 gap-space-5 medium:grid-cols-2">
        <Card title="Expenditure by category">
          {report.categories.length ? (
            <ul className="grid gap-space-2">
              {report.categories.map((c) => (
                <li
                  key={c.category}
                  className="flex justify-between gap-space-3"
                >
                  <span>{c.category}</span>
                  <span className="tabular-nums">
                    {formatSignedRupees(c.expense_paise)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No expenditure in this period.</p>
          )}
        </Card>
        <Card title="Income by source">
          {report.income_sources.length ? (
            <ul className="grid gap-space-2">
              {report.income_sources.map((s) => (
                <li key={s.source} className="flex justify-between gap-space-3">
                  <span>{incomeSourceLabel(s.source)}</span>
                  <span className="tabular-nums">
                    {formatSignedRupees(s.income_paise)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No income in this period.</p>
          )}
        </Card>
      </div>

      <Card title="Closing balances">
        <ul className="grid gap-space-2">
          {report.balances.map((b) => (
            <li key={b.account} className="flex justify-between gap-space-3">
              <span>
                {b.account} ({b.account_type === 'cash' ? 'Cash' : 'Bank'}
                {b.active ? '' : ', inactive'})
              </span>
              <span className="tabular-nums">
                {formatSignedRupees(b.balance_paise)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-space-3 text-caption text-ink-muted">
          Balances as at {formatBillingDate(report.to)}.
        </p>
      </Card>
    </section>
  );
}
