// Show the owner, tenant and family budget summary when the society shares it.
import { Card } from '@/components/ui/data-display';
import { getResidentBudgetSummary } from '@/core/expense/budget-operations';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Budget | Homeish',
  robots: { index: false, follow: false },
};

function defaultFinancialYear() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return month >= 4 ? year : year - 1;
}

export default async function ResidentBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const [locale, search] = await Promise.all([
    getRequestLocale(),
    searchParams,
  ]);
  const parsed = Number(search.year);
  const financialYear =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
      ? parsed
      : defaultFinancialYear();
  const summary = await getResidentBudgetSummary(financialYear);
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Budget')}</h1>
      <form method="get" className="flex flex-wrap items-end gap-space-3">
        <label className="grid gap-space-1">
          {t('Financial year')}
          <input
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={financialYear}
          />
        </label>
        <button
          className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
          type="submit"
        >
          {t('View year')}
        </button>
      </form>
      {!summary.shared ? (
        <Card title={t('Budget summary')}>
          <p>{t('No budget has been shared yet')}</p>
        </Card>
      ) : (
        <>
          <Card
            title={t('Approved budget')}
            description={
              summary.approved_on
                ? t('Approved on {date}.', {
                    date: formatLocalizedDate(
                      new Date(`${summary.approved_on}T00:00:00.000Z`),
                      locale,
                      {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      },
                    ),
                  })
                : undefined
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-[38rem] w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="sticky left-0 bg-surface p-space-2">
                      {t('Head')}
                    </th>
                    <th className="p-space-2 text-right">
                      {t('Current budget')}
                    </th>
                    <th className="p-space-2 text-right">
                      {t('Actual to date')}
                    </th>
                    <th className="p-space-2 text-right">{t('% used')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr
                      className="border-b border-rule"
                      key={`${row.category_id}:${row.income_type}`}
                    >
                      <th className="sticky left-0 bg-surface p-space-2 font-normal">
                        {row.name}
                      </th>
                      <td className="p-space-2 text-right">
                        {formatLocalizedCurrency(row.current_paise, locale)}
                      </td>
                      <td className="p-space-2 text-right">
                        {formatLocalizedCurrency(
                          row.actual_to_date_paise,
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
                <tfoot>
                  <tr className="border-t border-rule font-semibold">
                    <th className="sticky left-0 bg-surface p-space-2 text-left">
                      {t('Money in')}
                    </th>
                    <td className="p-space-2 text-right" colSpan={3}>
                      {formatLocalizedCurrency(
                        summary.totals.income_paise,
                        locale,
                      )}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <th className="sticky left-0 bg-surface p-space-2 text-left">
                      {t('Spending')}
                    </th>
                    <td className="p-space-2 text-right" colSpan={3}>
                      {formatLocalizedCurrency(
                        summary.totals.spending_paise,
                        locale,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <p className="text-caption text-ink-muted">
            {t(
              'This is a read-only summary. It does not show changes, warnings, estimates, individual entries or payees.',
            )}
          </p>
        </>
      )}
    </section>
  );
}
