// Show P40.8b-c reconciliation evidence, account balances and fund targets.
import { StatusChip } from '@/components/ui/data-display';
import type { ExpenseFundReconciliation } from '@/core/expense/validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';
import { ExpenseFundTargetForm, ExpenseStatementBalanceForm } from './funds';

function reasonText(
  reason: ExpenseFundReconciliation['reasons'][number],
  t: (source: string) => string,
) {
  switch (reason) {
    case 'month_not_closed':
      return t('The selected month is not closed.');
    case 'opening_needs_review':
      return t('The fund opening needs review.');
    case 'pending_suggested_splits':
      return t('Suggested fund splits are waiting for confirmation.');
    case 'fixed_deposits_need_review':
      return t('A fixed deposit is not linked and matched to Accounts.');
  }
}

export function ExpenseFundReconciliation({
  canManage,
  locale,
  report,
}: {
  canManage: boolean;
  locale: Locale;
  report: ExpenseFundReconciliation;
}) {
  const t = (source: string) => translateMessage(locale, source);
  const monthLabel = formatLocalizedDate(
    new Date(`${report.month}T00:00:00.000Z`),
    locale,
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );
  return (
    <div className="grid gap-space-5">
      <div className="flex flex-wrap items-center justify-between gap-space-3">
        <div>
          <p className="font-semibold">{t('Reconciliation status')}</p>
          <p className="text-caption text-ink-muted">{monthLabel}</p>
        </div>
        <StatusChip status={`fund_reconciliation.${report.status}`} />
      </div>
      {report.reasons.length ? (
        <div className="rounded-md border border-warning bg-warning-tint p-space-3">
          <p className="font-semibold">{t('Items to review')}</p>
          <ul className="mt-space-2 list-disc pl-space-5">
            {report.reasons.map((reason) => (
              <li key={reason}>
                <a className="underline" href="#fund-activity">
                  {reasonText(reason, t)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-caption text-ink-muted">
          {t(
            'The month is closed and the checked fund sources are up to date. This does not override an accountant’s review.',
          )}
        </p>
      )}

      <div
        className="overflow-x-auto"
        role="region"
        aria-label={t('Statement balances')}
        tabIndex={0}
      >
        <table className="w-full min-w-[54rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-rule">
              <th className="p-space-2">{t('Account')}</th>
              <th className="p-space-2 text-right">{t('Book balance')}</th>
              <th className="p-space-2 text-right">{t('Statement closing')}</th>
              <th className="p-space-2 text-right">{t('Difference')}</th>
              <th className="p-space-2">{t('Note')}</th>
            </tr>
          </thead>
          <tbody>
            {report.accounts.map((account) => (
              <tr className="border-b border-rule" key={account.account_id}>
                <th className="p-space-2 font-normal">
                  {account.account_name} · {t('Bank')}
                </th>
                <td className="p-space-2 text-right">
                  {formatLocalizedCurrency(account.book_balance_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {account.statement_closing_paise === null
                    ? t('Not entered')
                    : formatLocalizedCurrency(
                        account.statement_closing_paise,
                        locale,
                      )}
                </td>
                <td className="p-space-2 text-right">
                  {account.difference_paise === null
                    ? t('Not available')
                    : formatLocalizedCurrency(account.difference_paise, locale)}
                </td>
                <td className="p-space-2">
                  <StatusChip
                    status={`fund_reconciliation.${account.status}`}
                  />
                  {account.reasons.length ? (
                    <ul className="mt-space-2 list-disc pl-space-4 text-caption text-ink-muted">
                      {account.reasons.map((reason) => (
                        <li key={reason}>{reasonText(reason, t)}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-space-2">{account.note ?? t('No note')}</p>
                  {canManage ? (
                    <details className="mt-space-2">
                      <summary className="cursor-pointer font-semibold">
                        {account.updated_at
                          ? t('Update statement balance')
                          : t('Enter statement balance')}
                      </summary>
                      <div className="mt-space-3 min-w-[18rem]">
                        <ExpenseStatementBalanceForm
                          account={account}
                          month={report.month}
                        />
                      </div>
                    </details>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="overflow-x-auto"
        role="region"
        aria-label={t('Fund targets')}
        tabIndex={0}
      >
        <table className="w-full min-w-[58rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-rule">
              <th className="p-space-2">{t('Fund')}</th>
              <th className="p-space-2 text-right">{t('Balance')}</th>
              <th className="p-space-2 text-right">{t('Target')}</th>
              <th className="p-space-2 text-right">{t('Gap')}</th>
              <th className="p-space-2 text-right">{t('Estimated monthly')}</th>
              <th className="p-space-2">{t('Status')}</th>
            </tr>
          </thead>
          <tbody>
            {report.funds.map((fund) => (
              <tr className="border-b border-rule" key={fund.fund_id}>
                <th className="p-space-2 font-normal">
                  {fund.fund_name}
                  {fund.active ? '' : ` · ${t('Inactive')}`}
                </th>
                <td className="p-space-2 text-right">
                  {formatLocalizedCurrency(fund.balance_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {fund.target_paise === null
                    ? t('Not set')
                    : `${formatLocalizedCurrency(fund.target_paise, locale)}${
                        fund.target_date
                          ? ` · ${formatLocalizedDate(
                              new Date(`${fund.target_date}T00:00:00.000Z`),
                              locale,
                              {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'UTC',
                              },
                            )}`
                          : ''
                      }`}
                </td>
                <td className="p-space-2 text-right">
                  {fund.target_gap_paise === null
                    ? t('Not available')
                    : formatLocalizedCurrency(fund.target_gap_paise, locale)}
                </td>
                <td className="p-space-2 text-right">
                  {fund.estimated_monthly_paise === null
                    ? t('Not available')
                    : `${formatLocalizedCurrency(
                        fund.estimated_monthly_paise,
                        locale,
                      )} · ${t('Estimate')}`}
                </td>
                <td className="p-space-2">
                  {fund.target_status ? (
                    <StatusChip status={`fund_target.${fund.target_status}`} />
                  ) : (
                    <span className="text-ink-muted">{t('No target')}</span>
                  )}
                  {canManage ? (
                    <details className="mt-space-2">
                      <summary className="cursor-pointer font-semibold">
                        {t('Edit target')}
                      </summary>
                      <div className="mt-space-3 min-w-[18rem]">
                        <ExpenseFundTargetForm fund={fund} />
                      </div>
                    </details>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
