// Show the P40.9 estimate-only major-repair forecast and manage its inputs.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { ExpenseNav } from '@/components/expense/nav';
import {
  EXPENSE_REPAIR_FORECAST_CATEGORY_LABELS,
  RepairForecastArchiveForm,
  RepairForecastFundForm,
  RepairForecastItemForm,
} from '@/components/expense/repair-forecast';
import { getExpenseRepairForecast } from '@/core/expense/repair-forecast-operations';
import { formatLocalizedCurrency } from '@/core/i18n/format';
import { translateMessage } from '@/core/i18n/messages';
import { getRequestLocale } from '@/core/i18n/request-locale';

export const metadata = {
  title: 'Repair forecast | Accounts | Homeish',
  robots: { index: false, follow: false },
};

function estimate(value: bigint, locale: 'en' | 'hi') {
  return formatLocalizedCurrency(value, locale);
}

export default async function ExpenseRepairForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ includeArchived?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const params = await searchParams;
  const includeArchived = params.includeArchived === 'true';
  const forecast = await getExpenseRepairForecast(includeArchived);
  const currentBalance = forecast.gap_fund_balance_paise ?? null;
  const cumulativeRows = forecast.years.reduce<
    { year: number; cumulative: bigint; gap: bigint | null }[]
  >((rows, year) => {
    const cumulative =
      (rows.at(-1)?.cumulative ?? BigInt(0)) + BigInt(year.total_paise);
    return [
      ...rows,
      {
        year: year.financial_year,
        cumulative,
        gap:
          currentBalance === null
            ? null
            : cumulative > BigInt(currentBalance)
              ? cumulative - BigInt(currentBalance)
              : BigInt(0),
      },
    ];
  }, []);

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <Link
          className="text-caption text-brand underline"
          href="/admin/expenses/funds"
        >
          {t('Back to funds')}
        </Link>
        <h1 className="text-title font-semibold">{t('Repair forecast')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            "Estimate the next ten financial years using each repair item's own cycle and inflation rate.",
          )}
        </p>
      </header>
      <ExpenseNav
        canManage={forecast.can_manage}
        current="funds"
        locale={locale}
      />
      <Banner title={t('Estimate only')} tone="warning">
        {t(
          'This forecast creates no levy, bill, budget, fund allocation, work approval or Accounts entry.',
        )}
      </Banner>
      {!forecast.can_manage ? (
        <Banner title={t('View only')} tone="info">
          {t(
            'Committee members can review the forecast but cannot change items or the gap fund.',
          )}
        </Banner>
      ) : null}

      <Card
        title={t('Repair items')}
        description={t(
          'An unknown last-done year uses one manually entered next-due year.',
        )}
      >
        {forecast.items.length ? (
          <div className="grid gap-space-3">
            {forecast.items.map((item) => (
              <details
                className="rounded-md border border-rule p-space-3"
                key={item.id}
              >
                <summary className="cursor-pointer">
                  <span className="font-semibold">{item.name}</span>
                  <span className="ml-space-2 text-caption text-ink-muted">
                    {t(EXPENSE_REPAIR_FORECAST_CATEGORY_LABELS[item.category])}
                    {item.overdue ? ` · ${t('Overdue')}` : ''}
                    {item.archived_at ? ` · ${t('Archived')}` : ''}
                    {item.project_id ? ` · ${t('Project started')}` : ''}
                  </span>
                </summary>
                <dl className="mt-space-3 grid gap-space-2 medium:grid-cols-3">
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Next due')}
                    </dt>
                    <dd>{item.next_due_year}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t("Today's cost")}
                    </dt>
                    <dd>{estimate(BigInt(item.current_cost_paise), locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Inflation')}
                    </dt>
                    <dd>{item.inflation_bp / 100}%</dd>
                  </div>
                </dl>
                {item.notes ? (
                  <p className="mt-space-2 text-ink-muted">{item.notes}</p>
                ) : null}
                {item.archive_reason ? (
                  <p className="mt-space-2 text-caption text-ink-muted">
                    {t('Archived: {reason}', {
                      reason: item.archive_reason,
                    })}
                  </p>
                ) : null}
                {forecast.can_manage ? (
                  <div className="mt-space-4 grid gap-space-4 large:grid-cols-2">
                    {!item.archived_at ? (
                      <RepairForecastItemForm item={item} />
                    ) : null}
                    <RepairForecastArchiveForm item={item} />
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        ) : (
          <p>{t('No repair items have been added.')}</p>
        )}
        {forecast.can_manage ? (
          <details className="mt-space-4 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">{t('Add repair item')}</summary>
            <div className="mt-space-3 max-w-[42rem]">
              <RepairForecastItemForm />
            </div>
          </details>
        ) : null}
        <Link
          className="mt-space-4 inline-block text-brand underline"
          href={
            includeArchived
              ? '/admin/expenses/funds/forecast'
              : '/admin/expenses/funds/forecast?includeArchived=true'
          }
        >
          {includeArchived
            ? t('Hide archived items')
            : t('Show archived items')}
        </Link>
      </Card>

      <Card
        title={t('Ten-year estimate')}
        description={t(
          'Every figure is an estimate. Overdue items count in the current financial year and then repeat by cycle.',
        )}
      >
        <div
          className="max-w-full overflow-x-auto"
          role="region"
          aria-label={t('Ten-year repair forecast table')}
          tabIndex={0}
        >
          <table className="min-w-[68rem] border-collapse text-body">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-space-2 py-space-2 text-left">
                  {t('Estimate')}
                </th>
                {forecast.years.map((year) => (
                  <th
                    className="px-space-2 py-space-2 text-right"
                    key={year.financial_year}
                  >
                    {year.financial_year}-
                    {String(year.financial_year + 1).slice(-2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.items
                .filter((item) => item.archived_at === null)
                .map((item) => (
                  <tr className="border-t border-rule" key={item.id}>
                    <th className="sticky left-0 z-10 bg-surface px-space-2 py-space-2 text-left font-normal">
                      {item.name}
                    </th>
                    {item.years.map((year) => (
                      <td
                        className="px-space-2 py-space-2 text-right tabular-nums"
                        key={year.financial_year}
                      >
                        {year.amount_paise
                          ? estimate(BigInt(year.amount_paise), locale)
                          : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              <tr className="border-t border-rule-strong font-semibold">
                <th className="sticky left-0 z-10 bg-surface px-space-2 py-space-2 text-left">
                  {t('Year total - Estimate')}
                </th>
                {forecast.years.map((year) => (
                  <td
                    className="px-space-2 py-space-2 text-right tabular-nums"
                    key={year.financial_year}
                  >
                    {estimate(BigInt(year.total_paise), locale)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-rule">
                <th className="sticky left-0 z-10 bg-surface px-space-2 py-space-2 text-left">
                  {t('Cumulative estimate')}
                </th>
                {cumulativeRows.map((row) => (
                  <td
                    className="px-space-2 py-space-2 text-right tabular-nums"
                    key={row.year}
                  >
                    {estimate(row.cumulative, locale)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-rule">
                <th className="sticky left-0 z-10 bg-surface px-space-2 py-space-2 text-left">
                  {t('Estimated gap')}
                </th>
                {cumulativeRows.map((row) => (
                  <td
                    className="px-space-2 py-space-2 text-right tabular-nums"
                    key={row.year}
                  >
                    {row.gap === null
                      ? t('Fund balance not available')
                      : estimate(row.gap, locale)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={t('Fund gap')}
        description={
          forecast.fund_balance_available && currentBalance !== null
            ? t('Current recorded balance: {amount}', {
                amount: estimate(BigInt(currentBalance), locale),
              })
            : t('Fund balance not available')
        }
      >
        <p className="text-ink-muted">
          {t(
            'The recorded balance is not projected forward. It is compared only with the cumulative estimate.',
          )}
        </p>
        {forecast.can_manage ? (
          <RepairForecastFundForm forecast={forecast} />
        ) : null}
      </Card>
    </section>
  );
}
