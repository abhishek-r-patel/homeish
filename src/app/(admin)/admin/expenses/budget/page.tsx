// Show and edit a P42.5 yearly budget without posting to the books.
import { Card, StatusChip } from '@/components/ui/data-display';
import {
  ExpenseBudgetApprovalForm,
  ExpenseBudgetChangeForm,
  ExpenseBudgetChangeVoidForm,
  ExpenseBudgetDiscardForm,
  ExpenseBudgetSettingsForm,
} from '@/components/expense/budget-change-controls';
import { ExpenseBudgetDraftForm } from '@/components/expense/budget-draft-controls';
import { ExpenseNav } from '@/components/expense/nav';
import {
  getExpenseBudget,
  getExpenseBudgetCopyPreview,
  getExpenseBudgetReport,
} from '@/core/expense/budget-operations';
import { getExpenseWorkspace } from '@/core/expense/operations';
import type { ExpenseBudget } from '@/core/expense/budget-validation';
import { EXPENSE_BUDGET_MONTHS } from '@/core/expense/budget-validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { z } from 'zod';

export const metadata = {
  title: 'Budget | Homeish',
  robots: { index: false, follow: false },
};

function financialYearFrom(today: string) {
  const year = Number(today.slice(0, 4));
  return today.slice(5, 7) >= '04' ? year : year - 1;
}

function BudgetPlan({
  workspace,
  locale,
}: {
  workspace: ExpenseBudget;
  locale: Locale;
}) {
  const t = (source: string) => translateMessage(locale, source);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[48rem] w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-rule">
            <th className="sticky left-0 bg-surface p-space-3">{t('Head')}</th>
            <th className="p-space-3 text-right">{t('Original')}</th>
            <th className="p-space-3 text-right">{t('Changes')}</th>
            <th className="p-space-3 text-right">{t('Current')}</th>
          </tr>
        </thead>
        <tbody>
          {(['income', 'spending'] as const).map((kind) => (
            <BudgetPlanGroup
              key={kind}
              kind={kind}
              locale={locale}
              rows={workspace.current_plan.filter((row) => row.kind === kind)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BudgetPlanGroup({
  kind,
  locale,
  rows,
}: {
  kind: 'income' | 'spending';
  locale: Locale;
  rows: ExpenseBudget['current_plan'];
}) {
  const t = (source: string) => translateMessage(locale, source);
  return (
    <>
      <tr>
        <th className="bg-surface-sunken p-space-3 font-semibold" colSpan={4}>
          {t(kind === 'income' ? 'Money in' : 'Spending')}
        </th>
      </tr>
      {rows.map((row) => (
        <tr
          className="border-b border-rule"
          key={row.category_id ?? row.income_type}
        >
          <th className="sticky left-0 bg-surface p-space-3 font-normal">
            {row.name}
          </th>
          <td className="p-space-3 text-right tabular-nums">
            {formatLocalizedCurrency(row.original_paise, locale)}
          </td>
          <td className="p-space-3 text-right tabular-nums">
            {formatLocalizedCurrency(row.changes_paise, locale)}
          </td>
          <td className="p-space-3 text-right font-semibold tabular-nums">
            {formatLocalizedCurrency(row.current_paise, locale)}
          </td>
        </tr>
      ))}
    </>
  );
}

export default async function ExpenseBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    start?: string;
    copyPercent?: string;
    asOf?: string;
  }>;
}) {
  const [locale, expense] = await Promise.all([
    getRequestLocale(),
    getExpenseWorkspace(),
  ]);
  const search = await searchParams;
  const defaultYear = financialYearFrom(expense.today);
  const parsedYear = Number(search.year);
  const financialYear =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : defaultYear;
  const workspace = await getExpenseBudget(financialYear);
  const preview =
    search.start === 'copy' && !workspace.budget
      ? await getExpenseBudgetCopyPreview({
          financialYear,
          percent: search.copyPercent ?? '0',
        })
      : null;
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const yearOptions = Array.from(
    { length: 8 },
    (_, index) => defaultYear - 5 + index,
  );
  const approvedOn = workspace.budget?.approved_on
    ? formatLocalizedDate(
        new Date(`${workspace.budget.approved_on}T00:00:00.000Z`),
        locale,
        { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
      )
    : null;
  const editingDraft =
    workspace.budget?.status === 'draft' || search.start === 'blank' || preview;
  const currentFinancialYear = financialYearFrom(expense.today);
  const parsedAsOf = z.iso.date().safeParse(search.asOf);
  const defaultAsOf =
    financialYear < currentFinancialYear
      ? `${financialYear + 1}-03-31`
      : expense.today;
  const reportAsOf =
    parsedAsOf.success &&
    parsedAsOf.data >= `${financialYear}-04-01` &&
    parsedAsOf.data <= `${financialYear + 1}-03-31` &&
    parsedAsOf.data <= expense.today
      ? parsedAsOf.data
      : defaultAsOf;
  const report =
    workspace.budget?.status === 'approved' &&
    financialYear <= currentFinancialYear
      ? await getExpenseBudgetReport({ financialYear, asOf: reportAsOf })
      : null;
  const budgetExport = new URLSearchParams({
    report: 'budget',
    financialYear: String(financialYear),
    asOf: reportAsOf,
  });

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Budget')}</h1>
      <ExpenseNav
        current="budget"
        canManage={workspace.can_manage}
        locale={locale}
      />
      <p className="text-caption text-ink-muted">
        {t(
          'A budget is a plan only. It does not post money, allocate funds, approve spending or block an Accounts entry.',
        )}
      </p>
      <form
        className="flex min-w-0 flex-wrap items-end gap-space-3"
        method="get"
      >
        <label className="grid gap-space-1">
          {t('Financial year')}
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            name="year"
            defaultValue={financialYear}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}–{year + 1}
              </option>
            ))}
          </select>
        </label>
        <button
          className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
          type="submit"
        >
          {t('View year')}
        </button>
      </form>

      {!workspace.budget && !editingDraft ? (
        <Card title={t('No budget for this year')}>
          {workspace.can_manage ? (
            <form
              className="grid gap-space-3 medium:max-w-[36rem]"
              method="get"
            >
              <input type="hidden" name="year" value={financialYear} />
              <label className="grid gap-space-1">
                {t('Start with')}
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  name="start"
                  defaultValue="blank"
                >
                  <option value="blank">{t('Blank budget')}</option>
                  <option value="copy">{t('Copy last year’s actuals')}</option>
                </select>
              </label>
              <label className="grid gap-space-1">
                {t('Change copied amounts by % (optional)')}
                <input
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                  name="copyPercent"
                  inputMode="decimal"
                  placeholder={t('For example 7.5 or -10')}
                />
              </label>
              <button
                className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
                type="submit"
              >
                {t('Start a budget')}
              </button>
            </form>
          ) : (
            <p>{t('An administrator can start the budget.')}</p>
          )}
        </Card>
      ) : null}

      {preview ? (
        <Card
          title={t('Copy preview')}
          description={t(
            'These are the previous financial year’s net actuals. Review every amount before saving.',
          )}
        >
          <BudgetPlan
            workspace={{
              ...workspace,
              current_plan: workspace.current_plan.map((head) => {
                const line = preview.lines.find(
                  (candidate) =>
                    candidate.category_id === head.category_id &&
                    candidate.income_type === head.income_type,
                );
                return {
                  ...head,
                  original_paise: line?.annual_paise ?? 0,
                  current_paise: line?.annual_paise ?? 0,
                };
              }),
            }}
            locale={locale}
          />
        </Card>
      ) : null}

      {editingDraft && (workspace.can_manage || workspace.budget) ? (
        <Card
          title={workspace.budget ? t('Draft budget') : t('New budget')}
          action={
            workspace.budget ? (
              <StatusChip status="expense_budget.draft" />
            ) : null
          }
        >
          {workspace.can_manage ? (
            <ExpenseBudgetDraftForm workspace={workspace} preview={preview} />
          ) : (
            <BudgetPlan workspace={workspace} locale={locale} />
          )}
        </Card>
      ) : null}

      {workspace.budget?.status === 'draft' && workspace.can_manage ? (
        <div className="grid gap-space-5 medium:grid-cols-2">
          <Card title={t('Approve budget')}>
            <ExpenseBudgetApprovalForm workspace={workspace} />
          </Card>
          <Card title={t('Discard draft')}>
            <ExpenseBudgetDiscardForm workspace={workspace} />
          </Card>
        </div>
      ) : null}

      {workspace.budget?.status === 'approved' ? (
        <>
          <Card
            title={t('Approved budget')}
            action={<StatusChip status="expense_budget.approved" />}
            description={
              approvedOn
                ? t('Approved by {body} on {date}.', {
                    body:
                      workspace.budget.approved_body === 'general_body'
                        ? t('General body')
                        : t('Committee'),
                    date: approvedOn,
                  })
                : undefined
            }
          >
            <BudgetPlan workspace={workspace} locale={locale} />
            <p className="mt-space-3 text-caption text-ink-muted">
              {t(
                'Original figures are locked. Use a recorded change for a correction or new allocation.',
              )}
            </p>
          </Card>
          {workspace.can_manage ? (
            <Card title={t('Record a change')}>
              <ExpenseBudgetChangeForm workspace={workspace} />
            </Card>
          ) : null}
          {report ? (
            <>
              <Card
                title={t('Budget against actual')}
                description={t('Plan and actual figures are shown to {date}.', {
                  date: report.as_of,
                })}
              >
                <form
                  className="mb-space-4 flex flex-wrap items-end gap-space-3"
                  method="get"
                >
                  <input type="hidden" name="year" value={financialYear} />
                  <label className="grid gap-space-1">
                    {t('As of')}
                    <input
                      className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                      type="date"
                      name="asOf"
                      min={`${financialYear}-04-01`}
                      max={
                        financialYear === currentFinancialYear
                          ? expense.today
                          : `${financialYear + 1}-03-31`
                      }
                      defaultValue={report.as_of}
                    />
                  </label>
                  <button
                    className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
                    type="submit"
                  >
                    {t('Update report')}
                  </button>
                </form>
                <div className="overflow-x-auto">
                  <table className="min-w-[64rem] w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-rule">
                        <th className="sticky left-0 bg-surface p-space-2">
                          {t('Head')}
                        </th>
                        <th className="p-space-2 text-right">
                          {t('Original')}
                        </th>
                        <th className="p-space-2 text-right">{t('Changes')}</th>
                        <th className="p-space-2 text-right">{t('Current')}</th>
                        <th className="p-space-2 text-right">
                          {t('Plan to date')}
                        </th>
                        <th className="p-space-2 text-right">
                          {t('Actual to date')}
                        </th>
                        <th className="p-space-2 text-right">
                          {t('Difference')}
                        </th>
                        <th className="p-space-2 text-right">{t('% used')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.summary.map((row) => (
                        <tr
                          className="border-b border-rule"
                          key={`${row.category_id}:${row.income_type}`}
                        >
                          <th className="sticky left-0 bg-surface p-space-2 font-normal">
                            {row.name}
                            {!row.budgeted ? ` · ${t('Not budgeted')}` : ''}
                          </th>
                          <td className="p-space-2 text-right">
                            {formatLocalizedCurrency(
                              row.original_paise,
                              locale,
                            )}
                          </td>
                          <td className="p-space-2 text-right">
                            {formatLocalizedCurrency(row.changes_paise, locale)}
                          </td>
                          <td className="p-space-2 text-right">
                            {formatLocalizedCurrency(row.current_paise, locale)}
                          </td>
                          <td className="p-space-2 text-right">
                            {formatLocalizedCurrency(
                              row.plan_to_date_paise,
                              locale,
                            )}
                          </td>
                          <td className="p-space-2 text-right">
                            {formatLocalizedCurrency(
                              row.actual_to_date_paise,
                              locale,
                            )}
                          </td>
                          <td className="p-space-2 text-right">
                            {t(row.difference_label)} ·{' '}
                            {formatLocalizedCurrency(
                              row.difference_paise,
                              locale,
                            )}
                          </td>
                          <td className="p-space-2 text-right">
                            {row.percent_used_bp === null
                              ? t('Not available')
                              : `${(row.percent_used_bp / 100).toFixed(2)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-space-3 flex flex-wrap gap-space-4">
                  <a
                    className="text-brand underline"
                    href={`/api/expense/export?${budgetExport}&format=csv`}
                  >
                    {t('Download budget CSV')}
                  </a>
                  <a
                    className="text-brand underline"
                    href={`/api/expense/export?${budgetExport}&format=pdf`}
                  >
                    {t('Download budget PDF')}
                  </a>
                </div>
              </Card>
              <Card title={t('Month by head')}>
                <div className="overflow-x-auto">
                  <table className="min-w-[64rem] w-full border-collapse text-caption">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-surface p-space-2">
                          {t('Head')}
                        </th>
                        {report.months.map((month) => (
                          <th className="p-space-2" key={month.month}>
                            {formatLocalizedDate(
                              new Date(`${month.month}T00:00:00.000Z`),
                              locale,
                              {
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'UTC',
                              },
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.summary.map((summary) => (
                        <tr
                          className="border-t border-rule"
                          key={`${summary.category_id}:${summary.income_type}`}
                        >
                          <th className="sticky left-0 bg-surface p-space-2 text-left font-normal">
                            {summary.name}
                          </th>
                          {report.months.map((month) => {
                            const head = month.heads.find(
                              (candidate) =>
                                candidate.category_id === summary.category_id &&
                                candidate.income_type === summary.income_type,
                            );
                            return (
                              <td
                                className="p-space-2 text-right"
                                key={month.month}
                              >
                                <span>
                                  {formatLocalizedCurrency(
                                    head?.budget_paise ?? 0,
                                    locale,
                                  )}
                                </span>
                                <br />
                                <span className="text-ink-muted">
                                  {t('Actual')}{' '}
                                  {formatLocalizedCurrency(
                                    head?.actual_paise ?? 0,
                                    locale,
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card
                title={t('Cash flow')}
                description={t(
                  'Cash flow is separate from the budget difference and any surplus.',
                )}
              >
                <p className="mb-space-3 text-caption text-ink-muted">
                  {report.forecast_method === 'average_3_months'
                    ? t(
                        'Estimates use the average of the last {count} complete months.',
                        {
                          count: report.months_averaged,
                        },
                      )
                    : report.forecast_method === 'budget'
                      ? t(
                          'Unfinished months use the approved budget as an estimate.',
                        )
                      : t('No forecast is applied.')}
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-[48rem] w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-rule">
                        <th className="sticky left-0 bg-surface p-space-2">
                          {t('Month')}
                        </th>
                        <th className="p-space-2 text-right">
                          {t('Money in')}
                        </th>
                        <th className="p-space-2 text-right">
                          {t('Money out')}
                        </th>
                        <th className="p-space-2 text-right">{t('Net')}</th>
                        <th className="p-space-2 text-right">
                          {t('Running net')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.cash_flow.map((row) => (
                        <tr
                          className={`border-b border-rule ${row.is_estimate ? 'bg-surface-sunken' : ''}`}
                          key={row.month}
                        >
                          <th className="sticky left-0 bg-surface p-space-2 font-normal">
                            {formatLocalizedDate(
                              new Date(`${row.month}T00:00:00.000Z`),
                              locale,
                              {
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'UTC',
                              },
                            )}
                            {row.is_estimate ? ` · ${t('Estimate')}` : ''}
                          </th>
                          <td className="p-space-2 text-right">
                            {row.forecast_available
                              ? formatLocalizedCurrency(
                                  row.money_in_paise,
                                  locale,
                                )
                              : t('Not available')}
                          </td>
                          <td className="p-space-2 text-right">
                            {row.forecast_available
                              ? formatLocalizedCurrency(
                                  row.money_out_paise,
                                  locale,
                                )
                              : t('Not available')}
                          </td>
                          <td className="p-space-2 text-right">
                            {row.forecast_available
                              ? formatLocalizedCurrency(row.net_paise, locale)
                              : t('Not available')}
                          </td>
                          <td className="p-space-2 text-right">
                            {row.forecast_available
                              ? formatLocalizedCurrency(
                                  row.running_paise,
                                  locale,
                                )
                              : t('Not available')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
          {workspace.can_manage ? (
            <Card title={t('Budget settings')}>
              <ExpenseBudgetSettingsForm workspace={workspace} />
            </Card>
          ) : null}
          <Card title={t('Changes')}>
            {workspace.changes.length ? (
              <ul className="grid gap-space-3">
                {workspace.changes.map((change) => (
                  <li
                    className={`rounded-md border border-rule p-space-3 ${
                      change.voided_at ? 'bg-surface-sunken' : ''
                    }`}
                    key={change.id}
                  >
                    <div className="grid gap-space-2 medium:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <p
                          className={
                            change.voided_at ? 'line-through' : 'font-semibold'
                          }
                        >
                          {change.name} ·{' '}
                          {t(
                            change.direction === 'increase'
                              ? 'Increase'
                              : 'Decrease',
                          )}{' '}
                          ·{' '}
                          {formatLocalizedCurrency(change.amount_paise, locale)}
                        </p>
                        <p className="text-caption text-ink-muted">
                          {t('From')}{' '}
                          {t(EXPENSE_BUDGET_MONTHS[change.effective_month - 1])}{' '}
                          · {change.reason}
                        </p>
                        {change.voided_at ? (
                          <p className="text-caption text-ink-muted">
                            {t('Cancelled')}: {change.void_reason}
                          </p>
                        ) : null}
                      </div>
                      {!change.voided_at && workspace.can_manage ? (
                        <details className="min-w-0">
                          <summary className="cursor-pointer">
                            {t('Cancel change')}
                          </summary>
                          <ExpenseBudgetChangeVoidForm
                            workspace={workspace}
                            changeId={change.id}
                          />
                        </details>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('No changes have been recorded.')}</p>
            )}
          </Card>
        </>
      ) : null}
    </section>
  );
}
