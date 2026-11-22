// Show P41 receipts and payments, month heads, position and finance figures.
import { Card, StatTile } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { ExpenseNav } from '@/components/expense/nav';
import {
  getExpenseFinancialPosition,
  getExpenseMultiYear,
  getExpenseStatements,
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
import { z } from 'zod';

export const metadata = {
  title: 'Accounts statements | Homeish',
  robots: { index: false, follow: false },
};
const fieldClass =
  'min-h-12 min-w-0 rounded-md border border-rule-strong bg-surface px-space-3';

function displayHead(
  kind: 'receipt' | 'payment',
  label: string,
  t: (source: string) => string,
) {
  return kind === 'receipt' ? t(incomeSourceLabel(label)) : t(label);
}

function yearLabel(value: string) {
  const year = Number(value.slice(0, 4));
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

export default async function ExpenseStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; asOf?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const search = await searchParams;
  const workspace = await getExpenseWorkspace();
  const range = expenseRangeOrDefault(search, workspace.today);
  const asOf = z.iso.date().safeParse(search.asOf);
  const positionDate = asOf.success
    ? asOf.data > workspace.today
      ? workspace.today
      : asOf.data
    : workspace.today;
  const [statements, position, comparison] = await Promise.all([
    getExpenseStatements(range),
    getExpenseFinancialPosition(positionDate),
    getExpenseMultiYear(),
  ]);
  const formatDate = (value: string) =>
    formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const formatMonth = (value: string) =>
    formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const money = (value: number) => formatLocalizedCurrency(value, locale);
  const optionalMoney = (value: number | null) =>
    value === null ? t('Not available') : money(value);
  const percent = (value: number | null) =>
    value === null ? '—' : `${value.toFixed(2)}%`;
  const rangeQuery = new URLSearchParams(range);
  const allHeads = [
    ...statements.receipt_heads.map((head) => ({
      kind: 'receipt' as const,
      key: head.key,
      label: head.label,
    })),
    ...statements.payment_heads.map((head) => ({
      kind: 'payment' as const,
      key: head.key,
      label: head.label,
    })),
  ];
  const statementPdf = new URLSearchParams({
    ...range,
    report: 'statements',
    format: 'pdf',
  });
  const positionPdf = new URLSearchParams({
    report: 'position',
    asOf: positionDate,
    format: 'pdf',
  });

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Accounts statements')}</h1>
      <ExpenseNav
        current="statements"
        canManage={workspace.can_manage}
        locale={locale}
      />

      <Card title={t('Statement period')}>
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
            {t('Show statements')}
          </button>
        </form>
        <p className="mt-space-3 text-caption text-ink-muted">
          {t('{from} to {to}. Read-only; periods up to two years.', {
            from: formatDate(statements.from),
            to: formatDate(statements.to),
          })}
        </p>
        <div className="mt-space-3 flex flex-wrap gap-space-4">
          <a
            className="text-brand underline"
            href={`/api/expense/export?${rangeQuery}&report=statements&format=csv`}
          >
            {t('Download statements CSV')}
          </a>
          <a
            className="text-brand underline"
            href={`/api/expense/export?${statementPdf}`}
          >
            {t('Download statements PDF')}
          </a>
        </div>
      </Card>

      {!statements.identity_matches ? (
        <Banner tone="danger" title={t('The statement does not reconcile')}>
          {t(
            'Refresh the report and contact an administrator before using it.',
          )}
        </Banner>
      ) : null}

      <div className="grid min-w-0 gap-space-3 medium:grid-cols-2 wide:grid-cols-4">
        <StatTile
          label={t('Average monthly expenditure')}
          value={`${money(statements.figures.average_monthly_expense_paise)} · ${statements.figures.average_months} ${t('months')}`}
        />
        <StatTile
          label={t('Months of cash cover')}
          value={
            statements.figures.cash_cover_months === null
              ? t('Not available')
              : statements.figures.cash_cover_months.toFixed(2)
          }
        />
        <StatTile
          label={t('Income change from last year')}
          value={percent(statements.figures.income_change_percent)}
        />
        <StatTile
          label={t('Expenditure change from last year')}
          value={percent(statements.figures.expenditure_change_percent)}
        />
      </div>

      <Card title={t('Receipts and payments')}>
        <dl className="grid min-w-0 gap-space-2">
          {[
            [t('Opening money held'), statements.opening_money_paise],
            [
              t('Opening balances of accounts added'),
              statements.accounts_added_opening_paise,
            ],
            [t('Receipts'), statements.receipts_paise],
            [t('Payments'), -statements.payments_paise],
            [t('Closing money held'), statements.closing_money_paise],
          ].map(([label, value]) => (
            <div
              className="flex min-w-0 items-baseline justify-between gap-space-3 border-b border-rule pb-space-2 last:border-0"
              key={String(label)}
            >
              <dt>{label}</dt>
              <dd className="text-body-strong">{money(Number(value))}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-space-4 grid min-w-0 gap-space-4 medium:grid-cols-2">
          <div>
            <h3 className="font-semibold">{t('Receipts by head')}</h3>
            {statements.receipt_heads.length === 0 ? (
              <p className="mt-space-2 text-ink-muted">
                {t('No receipts in this period.')}
              </p>
            ) : (
              <ul className="mt-space-2 grid gap-space-2">
                {statements.receipt_heads.map((head) => (
                  <li
                    className="flex justify-between gap-space-3"
                    key={head.key}
                  >
                    <span>{t(incomeSourceLabel(head.label))}</span>
                    <span>{money(head.amount_paise)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-semibold">{t('Payments by head')}</h3>
            {statements.payment_heads.length === 0 ? (
              <p className="mt-space-2 text-ink-muted">
                {t('No payments in this period.')}
              </p>
            ) : (
              <ul className="mt-space-2 grid gap-space-2">
                {statements.payment_heads.map((head) => (
                  <li
                    className="flex justify-between gap-space-3"
                    key={head.key}
                  >
                    <span>{t(head.label)}</span>
                    <span>{money(head.amount_paise)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card title={t('Month by head')}>
        {allHeads.length === 0 ? (
          <p>{t('No income or expenditure in this period.')}</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-caption">
              <thead>
                <tr>
                  <th className="sticky left-0 border border-rule bg-surface p-space-2 text-left">
                    {t('Month')}
                  </th>
                  {allHeads.map((head) => (
                    <th
                      className="border border-rule p-space-2 text-left"
                      key={`${head.kind}-${head.key}`}
                    >
                      {displayHead(head.kind, head.label, t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statements.months.map((month) => (
                  <tr key={month.month}>
                    <th className="sticky left-0 border border-rule bg-surface p-space-2 text-left">
                      {formatMonth(month.month)}
                    </th>
                    {allHeads.map((head) => {
                      const value = month.heads.find(
                        (row) => row.kind === head.kind && row.key === head.key,
                      );
                      return (
                        <td
                          className="border border-rule p-space-2 text-right tabular-nums"
                          key={`${month.month}-${head.kind}-${head.key}`}
                        >
                          {money(value?.amount_paise ?? 0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('Expenditure share by category')}>
        {statements.figures.category_shares.length === 0 ? (
          <p>{t('No expenditure in this period.')}</p>
        ) : (
          <ul className="grid gap-space-2">
            {statements.figures.category_shares.map((row) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-space-3"
                key={row.category}
              >
                <span>{row.category}</span>
                <span>
                  {money(row.expense_paise)} · {percent(row.share_percent)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('Financial position summary — not a balance sheet')}
        description={t(
          'Every line names its Accounts, Billing, Vendors or fund source.',
        )}
      >
        <form
          method="get"
          className="mb-space-4 flex min-w-0 flex-wrap items-end gap-space-3"
        >
          <input type="hidden" name="from" value={range.from} />
          <input type="hidden" name="to" value={range.to} />
          <label className="grid min-w-0 gap-space-1">
            {t('As at')}
            <input
              type="date"
              name="asOf"
              max={workspace.today}
              defaultValue={positionDate}
              className={fieldClass}
            />
          </label>
          <button className="min-h-12 rounded-md border border-rule px-space-4">
            {t('Show position')}
          </button>
          <a
            className="min-h-12 content-center text-brand underline"
            href={`/api/expense/export?${positionPdf}`}
          >
            {t('Download position PDF')}
          </a>
        </form>
        <dl className="grid gap-space-2">
          {position.accounts.map((account) => (
            <div className="flex justify-between gap-space-3" key={account.id}>
              <dt>
                {account.account} · {t(account.account_type)}
              </dt>
              <dd>{optionalMoney(account.balance_paise)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-space-3 border-b border-rule pb-space-2">
            <dt>{t('Cash and bank accounts')}</dt>
            <dd>{money(position.accounts_total_paise)}</dd>
          </div>
          {position.funds_enabled ? (
            <>
              {position.funds.map((fund) => (
                <div
                  className="flex justify-between gap-space-3"
                  key={fund.fund}
                >
                  <dt>
                    {t('Fund')} · {fund.fund}
                  </dt>
                  <dd>{money(fund.balance_paise)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-space-3 border-b border-rule pb-space-2">
                <dt>{t('Unallocated')}</dt>
                <dd>{optionalMoney(position.unallocated_paise)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between gap-space-3">
            <dt>{t('Member dues still owed (Billing)')}</dt>
            <dd>{optionalMoney(position.member_dues_paise)}</dd>
          </div>
          <div className="flex justify-between gap-space-3">
            <dt>{t('Unpaid vendor bills (Vendors)')}</dt>
            <dd>{optionalMoney(position.vendor_bills_paise)}</dd>
          </div>
        </dl>
        <div className="mt-space-4">
          <h3 className="font-semibold">
            {t('Fixed deposits — not added to totals')}
          </h3>
          {position.fixed_deposits.length === 0 ? (
            <p className="mt-space-2 text-ink-muted">
              {t('No fixed deposits recorded.')}
            </p>
          ) : (
            <ul className="mt-space-2 grid gap-space-2">
              {position.fixed_deposits.map((deposit, index) => (
                <li
                  className="flex flex-wrap justify-between gap-space-3"
                  key={`${deposit.bank_name}-${index}`}
                >
                  <span>
                    {deposit.bank_name}
                    {deposit.reference ? ` · ${deposit.reference}` : ''}
                  </span>
                  <span>{optionalMoney(deposit.principal_paise)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card title={t('Five financial years')}>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 border border-rule bg-surface p-space-3 text-left">
                  {t('Financial year')}
                </th>
                <th className="border border-rule p-space-3 text-left">
                  {t('Income')}
                </th>
                <th className="border border-rule p-space-3 text-left">
                  {t('Expenditure')}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.years.map((year) => (
                <tr key={year.financial_year_start}>
                  <th className="sticky left-0 border border-rule bg-surface p-space-3 text-left">
                    {yearLabel(year.financial_year_start)}
                    {year.is_current ? ` · ${t('Year to date')}` : ''}
                    {!year.is_current && year.part_year
                      ? ` · ${t('Part year')}`
                      : ''}
                  </th>
                  <td className="border border-rule p-space-3 tabular-nums">
                    {year.not_available
                      ? t('Not available')
                      : money(year.income_paise)}
                  </td>
                  <td className="border border-rule p-space-3 tabular-nums">
                    {year.not_available
                      ? t('Not available')
                      : money(year.expense_paise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-space-4 grid gap-space-3">
          {comparison.years.map((year) => (
            <details
              className="rounded-md border border-rule p-space-3"
              key={`heads-${year.financial_year_start}`}
            >
              <summary className="cursor-pointer font-semibold">
                {yearLabel(year.financial_year_start)} · {t('Heads')}
              </summary>
              {year.not_available ? (
                <p className="mt-space-2">{t('Not available')}</p>
              ) : (
                <ul className="mt-space-3 grid gap-space-2">
                  {year.heads.map((head) => (
                    <li
                      className="flex flex-wrap justify-between gap-space-3"
                      key={`${year.financial_year_start}-${head.kind}-${head.key}`}
                    >
                      <span>{displayHead(head.kind, head.label, t)}</span>
                      <span>
                        {money(head.amount_paise)} ·{' '}
                        {percent(head.change_percent)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          ))}
        </div>
      </Card>
    </section>
  );
}
