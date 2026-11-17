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
import { incomeSourceLabel } from '@/core/expense/documents';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

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
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const formatDate = (value: string) =>
    formatLocalizedDate(
      new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
      locale,
      { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
    );
  const formatPeriod = (value: string) => {
    const [year, month] = value.slice(0, 7).split('-').map(Number);
    return formatLocalizedDate(new Date(Date.UTC(year, month - 1, 1)), locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };
  const formatSignedCurrency = (paise: number) =>
    `${paise < 0 ? '-' : ''}${formatLocalizedCurrency(Math.abs(paise), locale)}`;
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
      <h1 className="text-title font-semibold">{t('Accounts reports')}</h1>
      <ExpenseNav current="reports" canManage={w.can_manage} locale={locale} />
      <Card title={t('Period')}>
        <form
          method="get"
          className="grid min-w-0 gap-space-3 medium:grid-cols-3"
        >
          <label className="grid min-w-0 gap-space-1">
            {t('From')}
            <input
              type="date"
              name="from"
              defaultValue={range.from}
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
          <button
            type="submit"
            className="min-h-12 self-end rounded-md border border-rule"
          >
            {t('Show report')}
          </button>
        </form>
        <p className="mt-space-3 text-caption text-ink-muted">
          {t(
            '{from} to {to}. Periods up to two years. The financial year runs April to March.',
            {
              from: formatDate(report.from),
              to: formatDate(report.to),
            },
          )}
        </p>
        <div className="mt-space-3 flex flex-wrap gap-space-4">
          <a
            className="text-brand underline"
            href={`/api/expense/export?${query}&format=csv`}
          >
            {t('Download entries CSV')}
          </a>
          <a
            className="text-brand underline"
            href={`/api/expense/export?${query}&format=pdf`}
          >
            {t('Download summary PDF')}
          </a>
        </div>
      </Card>

      <div className="grid min-w-0 gap-space-3 medium:grid-cols-3">
        <StatTile
          label={t('Income')}
          value={formatLocalizedCurrency(report.income_paise, locale)}
        />
        <StatTile
          label={t('Expenditure')}
          value={formatLocalizedCurrency(report.expense_paise, locale)}
        />
        <StatTile
          label={surplus < 0 ? t('Deficit') : t('Surplus')}
          value={formatSignedCurrency(surplus)}
        />
      </div>
      {report.billing_enabled && report.outstanding_dues_paise !== null ? (
        <p>
          {t('Outstanding maintenance dues today:')}{' '}
          {formatLocalizedCurrency(report.outstanding_dues_paise, locale)}
        </p>
      ) : null}

      <Card title={t('Month by month')}>
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
                  {formatPeriod(month)}
                  {isClosed ? ` · ${t('Closed')}` : ''}
                </p>
                <p>
                  {t('Income')}{' '}
                  {formatLocalizedCurrency(row?.income_paise ?? 0, locale)} ·{' '}
                  {t('Expenditure')}{' '}
                  {formatLocalizedCurrency(row?.expense_paise ?? 0, locale)}
                </p>
                {w.can_manage && month < currentMonth ? (
                  isClosed ? (
                    <details>
                      <summary className="cursor-pointer">
                        {t('Reopen month')}
                      </summary>
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
        <Card title={t('Expenditure by category')}>
          {report.categories.length ? (
            <ul className="grid gap-space-2">
              {report.categories.map((c) => (
                <li
                  key={c.category}
                  className="flex justify-between gap-space-3"
                >
                  <span>{c.category}</span>
                  <span className="tabular-nums">
                    {formatSignedCurrency(c.expense_paise)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('No expenditure in this period.')}</p>
          )}
        </Card>
        <Card title={t('Income by source')}>
          {report.income_sources.length ? (
            <ul className="grid gap-space-2">
              {report.income_sources.map((s) => (
                <li key={s.source} className="flex justify-between gap-space-3">
                  <span>{incomeSourceLabel(s.source)}</span>
                  <span className="tabular-nums">
                    {formatSignedCurrency(s.income_paise)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('No income in this period.')}</p>
          )}
        </Card>
      </div>

      <Card title={t('Closing balances')}>
        <ul className="grid gap-space-2">
          {report.balances.map((b) => (
            <li key={b.account} className="flex justify-between gap-space-3">
              <span>
                {b.account} ({b.account_type === 'cash' ? t('Cash') : t('Bank')}
                {b.active ? '' : ', inactive'})
              </span>
              <span className="tabular-nums">
                {formatSignedCurrency(b.balance_paise)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-space-3 text-caption text-ink-muted">
          {t('Balances as at')} {formatDate(report.to)}.
        </p>
      </Card>
    </section>
  );
}
