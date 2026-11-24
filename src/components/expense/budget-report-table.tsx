// Show P41.3 budget comparisons with P42.2 warning and projection signals.
import { StatusChip } from '@/components/ui/data-display';
import type { ExpenseBudgetReport } from '@/core/expense/budget-validation';
import { formatLocalizedCurrency } from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';

function warningStatus(
  warning: ExpenseBudgetReport['summary'][number]['warning'],
) {
  if (warning === 'over_plan') return 'expense_budget.over_plan' as const;
  if (warning === 'watch') return 'expense_budget.watch' as const;
  if (warning === 'on_track') return 'expense_budget.on_track' as const;
  return null;
}

export function ExpenseBudgetReportTable({
  locale,
  report,
}: {
  locale: Locale;
  report: ExpenseBudgetReport;
}) {
  const t = (source: string) => translateMessage(locale, source);
  const finishedYear = report.as_of === report.to;
  return (
    <div
      aria-label={t('Budget warning summary')}
      className="overflow-x-auto"
      role="region"
      tabIndex={0}
    >
      <table className="min-w-[84rem] w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-rule">
            <th className="sticky left-0 bg-surface p-space-2">{t('Head')}</th>
            <th className="p-space-2 text-right">{t('Original')}</th>
            <th className="p-space-2 text-right">{t('Changes')}</th>
            <th className="p-space-2 text-right">{t('Current')}</th>
            <th className="p-space-2 text-right">{t('Plan to date')}</th>
            <th className="p-space-2 text-right">{t('Actual to date')}</th>
            <th className="p-space-2 text-right">{t('Difference')}</th>
            <th className="p-space-2 text-right">{t('Burn rate / % used')}</th>
            <th className="p-space-2 text-right">{t('Status')}</th>
            <th className="p-space-2 text-right">{t('Projected year-end')}</th>
          </tr>
        </thead>
        <tbody>
          {report.summary.map((row) => {
            const status = warningStatus(row.warning);
            return (
              <tr
                className="border-b border-rule"
                key={`${row.category_id}:${row.income_type}`}
              >
                <th className="sticky left-0 bg-surface p-space-2 font-normal">
                  {row.name}
                  {!row.budgeted ? ` · ${t('Not budgeted')}` : ''}
                </th>
                <td className="p-space-2 text-right">
                  {formatLocalizedCurrency(row.original_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {formatLocalizedCurrency(row.changes_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {formatLocalizedCurrency(row.current_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {formatLocalizedCurrency(row.plan_to_date_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {formatLocalizedCurrency(row.actual_to_date_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {t(row.difference_label)} ·{' '}
                  {formatLocalizedCurrency(row.difference_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {row.burn_rate_bp === null
                    ? t('Not available')
                    : `${(row.burn_rate_bp / 100).toFixed(2)}%`}
                </td>
                <td className="p-space-2 text-right">
                  {status ? (
                    <StatusChip status={status} />
                  ) : (
                    <span className="text-ink-muted">{t('Not available')}</span>
                  )}
                </td>
                <td className="p-space-2 text-right">
                  {row.projection_available &&
                  row.projected_year_end_paise !== null ? (
                    <div className="grid gap-space-1">
                      <span>
                        {formatLocalizedCurrency(
                          row.projected_year_end_paise,
                          locale,
                        )}
                      </span>
                      <span className="text-micro text-ink-muted">
                        {finishedYear ? t('Actual') : t('Estimate')}
                        {row.projected_overrun_paise !== null
                          ? ` · ${t('Projected overrun')} ${formatLocalizedCurrency(
                              row.projected_overrun_paise,
                              locale,
                            )}`
                          : ''}
                      </span>
                    </div>
                  ) : (
                    t('Not available')
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
