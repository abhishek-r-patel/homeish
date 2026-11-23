// Show fund setup and activate P40 allocations from the Accounts total.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { ExpenseNav, ExpensePager } from '@/components/expense/nav';
import { ExpenseFundReconciliation } from '@/components/expense/fund-reconciliation';
import {
  ExpenseFundAllocationForm,
  ExpenseFundActivationForm,
  ExpenseFundBulkSuggestionsForm,
  ExpenseFundAllocationCorrectionForm,
  ExpenseFundForm,
  ExpenseFixedDepositForm,
  ExpenseFundInterestForm,
  ExpenseFundTransferForm,
  ExpenseFundTransferReverseForm,
  ExpenseFundTransferRuleForm,
  ExpenseFundCorpusForm,
  ExpenseFundReceiptLinkForm,
  ExpenseFundWorkForm,
  ExpenseFundWorkLinkForm,
  ExpenseFundMappingForm,
  ExpenseFundOpeningCorrectionForm,
} from '@/components/expense/funds';
import {
  EXPENSE_PAGE_SIZE,
  getExpenseFundActivity,
  getExpenseFixedDeposits,
  getExpenseFundInterestRecords,
  getExpenseFundBillingMappings,
  getExpenseBillingCollectionSuggestions,
  getExpenseFundCorpus,
  getExpenseFundWorks,
  getExpenseFundReport,
  getExpenseFundReconciliation,
  getExpenseFundTransfers,
  getExpenseFunds,
  getExpenseWorkspace,
} from '@/core/expense/operations';
import {
  EXPENSE_FUND_WARNING,
  expenseRangeOrDefault,
} from '@/core/expense/validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedDateTime,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Funds | Accounts | Homeish',
  robots: { index: false, follow: false },
};

const fieldClass =
  'min-h-12 min-w-0 rounded-md border border-rule-strong bg-surface px-space-3';

function localizedDate(value: string, locale: 'en' | 'hi') {
  return formatLocalizedDate(
    new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
    locale,
    { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
  );
}

function pageNumber(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default async function ExpenseFundsPage({
  searchParams,
}: {
  searchParams: Promise<{
    cutover?: string;
    allocationPage?: string;
    reportFrom?: string;
    reportTo?: string;
    reconciliationMonth?: string;
  }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const search = await searchParams;
  const allocationPage = pageNumber(search.allocationPage);
  const [
    workspace,
    activity,
    fixedDeposits,
    interestRecords,
    fundTransfers,
    billingMappings,
    billingSuggestions,
    corpus,
    works,
    accountsWorkspace,
  ] = await Promise.all([
    getExpenseFunds(search.cutover),
    getExpenseFundActivity(allocationPage),
    getExpenseFixedDeposits(),
    getExpenseFundInterestRecords(),
    getExpenseFundTransfers(),
    getExpenseFundBillingMappings(),
    getExpenseBillingCollectionSuggestions(),
    getExpenseFundCorpus(),
    getExpenseFundWorks(),
    getExpenseWorkspace(),
  ]);
  const activeFunds = workspace.funds.filter((fund) => fund.active);
  const preview = workspace.preview;
  const opening = workspace.opening;
  const reportRange = expenseRangeOrDefault(
    { from: search.reportFrom, to: search.reportTo },
    workspace.today,
  );
  const fundReport = opening ? await getExpenseFundReport(reportRange) : null;
  const reconciliationMonth = search.reconciliationMonth?.match(/^\d{4}-\d{2}$/)
    ? `${search.reconciliationMonth}-01`
    : search.reconciliationMonth?.match(/^\d{4}-\d{2}-01$/)
      ? search.reconciliationMonth
      : `${reportRange.to.slice(0, 7)}-01`;
  const reconciliation = opening
    ? await getExpenseFundReconciliation(reconciliationMonth)
    : null;
  const suggestableEntries = activity.entries.filter(
    (entry) =>
      entry.suggested_fund_id !== null &&
      entry.allocations.length === 0 &&
      !entry.month_closed,
  );
  const billingSuggestionByEntry = new Map(
    billingSuggestions.map((suggestion) => [
      suggestion.entry_id,
      suggestion.allocations,
    ]),
  );
  const billingSuggestableEntries = activity.entries.filter((entry) =>
    billingSuggestionByEntry.has(entry.entry_id),
  );
  const bulkSuggestableEntries = [
    ...suggestableEntries,
    ...billingSuggestableEntries.filter(
      (entry) =>
        !suggestableEntries.some((item) => item.entry_id === entry.entry_id),
    ),
  ];
  const fundAllocationHref = (page: number) => {
    const params = new URLSearchParams();
    if (search.cutover) params.set('cutover', search.cutover);
    params.set('allocationPage', String(page));
    return `/admin/expenses/funds?${params}`;
  };

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Society funds')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Allocate the existing Accounts total into named funds without moving or creating money.',
          )}
        </p>
      </header>
      <ExpenseNav
        current="funds"
        canManage={workspace.can_manage}
        locale={locale}
      />
      <Banner title={t('Manual fund tracking')} tone="warning">
        <p>{t(EXPENSE_FUND_WARNING)}</p>
        <p className="mt-space-2">
          {t(
            'Follow applicable society rules and obtain professional review where needed before relying on these records.',
          )}
        </p>
      </Banner>
      {!workspace.can_manage ? (
        <Banner title={t('View only')} tone="info">
          {t(
            'Committee members can review fund records but cannot change them.',
          )}
        </Banner>
      ) : null}
      <Card
        title={t('Repair forecast')}
        description={t(
          'Estimate major repairs over the next ten financial years without creating a levy, bill or approval.',
        )}
      >
        <Link
          className="text-brand underline"
          href="/admin/expenses/funds/forecast"
        >
          {t('Open repair forecast')}
        </Link>
      </Card>

      <Card
        title={t('Fund names')}
        description={t(
          'Deactivate a fund instead of deleting it after the fund has been used.',
        )}
      >
        {workspace.funds.length ? (
          <div className="grid gap-space-3">
            {workspace.funds.map((fund) =>
              workspace.can_manage ? (
                <details
                  key={fund.id}
                  className="rounded-md border border-rule p-space-3"
                >
                  <summary className="cursor-pointer">
                    {fund.name}
                    {fund.active ? '' : ` ${t('(inactive)')}`}
                  </summary>
                  <div className="mt-space-3">
                    <ExpenseFundForm key={fund.updated_at} fund={fund} />
                  </div>
                </details>
              ) : (
                <p
                  key={fund.id}
                  className="rounded-md border border-rule p-space-3"
                >
                  {fund.name}
                  {fund.active ? '' : ` ${t('(inactive)')}`}
                </p>
              ),
            )}
          </div>
        ) : (
          <p>{t('No funds have been named yet.')}</p>
        )}
        {workspace.can_manage ? (
          <details className="mt-space-3 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">{t('Add fund')}</summary>
            <div className="mt-space-3">
              <ExpenseFundForm />
            </div>
          </details>
        ) : null}
      </Card>

      {opening ? (
        <Card
          title={t('Fund tracking active')}
          description={t(
            'The opening remains a snapshot of Accounts. Later changes will be reviewed in the next fund activity slice.',
          )}
        >
          {opening.review_required ? (
            <Banner title={t('Opening needs review')} tone="danger">
              <p>
                {t(
                  'An Accounts change happened before the cutover. Review the new total and re-confirm the opening before relying on fund figures.',
                )}
              </p>
              <ul className="mt-space-2 list-disc pl-space-5">
                {opening.review_reasons.map((reason) => (
                  <li key={reason}>
                    {t(
                      reason === 'previous_month_reopened'
                        ? 'The previous month was reopened.'
                        : reason === 'accounts_total_changed'
                          ? 'The Accounts opening total changed.'
                          : reason === 'backdated_entry_added'
                            ? 'A backdated Accounts entry was added.'
                            : 'An account opening date or balance changed.',
                    )}
                  </li>
                ))}
              </ul>
            </Banner>
          ) : null}
          <dl className="grid gap-space-3 medium:grid-cols-2">
            <div>
              <dt className="text-caption text-ink-muted">{t('Cutover')}</dt>
              <dd>{localizedDate(opening.cutover_on, locale)}</dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Accounts total')}
              </dt>
              <dd>
                {formatLocalizedCurrency(opening.accounts_total_paise, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Allocated to funds')}
              </dt>
              <dd>
                {formatLocalizedCurrency(opening.allocated_total_paise, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Unallocated')}
              </dt>
              <dd>
                {formatLocalizedCurrency(opening.unallocated_paise, locale)}
              </dd>
            </div>
          </dl>
          <ul className="mt-space-4 grid gap-space-2">
            {opening.allocations.map((allocation) => (
              <li
                key={allocation.fund_id}
                className="flex flex-wrap justify-between gap-space-2 rounded-md border border-rule p-space-3"
              >
                <span>{allocation.fund_name}</span>
                <span className="font-semibold">
                  {formatLocalizedCurrency(allocation.amount_paise, locale)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-space-4 text-caption text-ink-muted">
            {t('Warning acknowledged by {name} on {date}.', {
              name: opening.activated_by_name ?? t('an administrator'),
              date: formatLocalizedDateTime(
                new Date(opening.activated_at),
                locale,
              ),
            })}
          </p>
          {workspace.can_manage ? (
            <details className="mt-space-4 rounded-md border border-rule p-space-3">
              <summary className="cursor-pointer">
                {opening.review_required
                  ? t('Review and re-confirm opening')
                  : t('Correct opening allocations')}
              </summary>
              <p className="mt-space-3 text-caption text-ink-muted">
                {t('Current Accounts total at the cutover: {amount}', {
                  amount: formatLocalizedCurrency(
                    opening.current_accounts_total_paise,
                    locale,
                  ),
                })}
              </p>
              <div className="mt-space-3">
                <ExpenseFundOpeningCorrectionForm
                  key={`${opening.reviewed_at}:${activeFunds
                    .map((fund) => fund.updated_at)
                    .join(':')}`}
                  funds={activeFunds}
                  accountsTotalPaise={opening.current_accounts_total_paise}
                  currentAllocations={opening.allocations}
                />
              </div>
            </details>
          ) : null}
        </Card>
      ) : (
        <Card
          title={t('Activate fund tracking')}
          description={t(
            'Choose a cutover after a closed month. The opening uses every Accounts balance at the end of the previous day.',
          )}
        >
          {workspace.eligible_cutovers.length ? (
            <form method="get" className="grid gap-space-3 medium:grid-cols-2">
              <label className="grid gap-space-1">
                {t('Cutover')}
                <select
                  className={fieldClass}
                  defaultValue={preview?.cutover_on ?? ''}
                  name="cutover"
                >
                  {workspace.eligible_cutovers.map((cutover) => (
                    <option key={cutover} value={cutover}>
                      {localizedDate(cutover, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="min-h-12 self-end rounded-md border border-rule-strong"
              >
                {t('Check opening total')}
              </button>
            </form>
          ) : (
            <Banner title={t('Close a month first')} tone="warning">
              {t(
                'The month before the cutover must be closed in the Accounts reports.',
              )}
            </Banner>
          )}
          {preview ? (
            <div className="mt-space-4 grid gap-space-3">
              <div className="flex flex-wrap justify-between gap-space-2 rounded-md border border-rule p-space-3">
                <span>
                  {t('Accounts total at the end of {date}', {
                    date: localizedDate(preview.as_of, locale),
                  })}
                </span>
                <span className="font-semibold">
                  {formatLocalizedCurrency(
                    preview.accounts_total_paise,
                    locale,
                  )}
                </span>
              </div>
              {preview.accounts_total_paise < 0 ? (
                <Banner title={t('Accounts total is negative')} tone="danger">
                  {t(
                    'Reconcile the Accounts balances before activating fund tracking. Normal Accounts posting remains available.',
                  )}
                </Banner>
              ) : null}
              {!activeFunds.length ? (
                <Banner title={t('Add an active fund')} tone="info">
                  {t('Name at least one active fund before activation.')}
                </Banner>
              ) : null}
              {workspace.can_manage &&
              preview.accounts_total_paise >= 0 &&
              activeFunds.length ? (
                <ExpenseFundActivationForm
                  key={`${preview.cutover_on}:${activeFunds
                    .map((fund) => fund.updated_at)
                    .join(':')}`}
                  funds={activeFunds}
                  cutoverOn={preview.cutover_on}
                  accountsTotalPaise={preview.accounts_total_paise}
                />
              ) : null}
            </div>
          ) : null}
        </Card>
      )}
      {fundReport ? (
        <Card
          title={t('Fund report')}
          description={t(
            'Review monthly movements, source reconciliation and optional fund targets.',
          )}
        >
          <form method="get" className="grid gap-space-3 medium:grid-cols-3">
            {search.cutover ? (
              <input type="hidden" name="cutover" value={search.cutover} />
            ) : null}
            <label className="grid gap-space-1">
              {t('From')}
              <input
                type="date"
                name="reportFrom"
                defaultValue={reportRange.from}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-space-1">
              {t('To')}
              <input
                type="date"
                name="reportTo"
                defaultValue={reportRange.to}
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              className="min-h-12 self-end rounded-md border border-rule-strong"
            >
              {t('Show fund report')}
            </button>
          </form>
          <div className="mt-space-4 grid gap-space-3 medium:grid-cols-3">
            <div className="rounded-md border border-rule p-space-3">
              <p className="text-caption text-ink-muted">
                {t('Accounts total')}
              </p>
              <p className="font-semibold">
                {formatLocalizedCurrency(
                  fundReport.accounts_total_paise,
                  locale,
                )}
              </p>
            </div>
            <div className="rounded-md border border-rule p-space-3">
              <p className="text-caption text-ink-muted">{t('Named funds')}</p>
              <p className="font-semibold">
                {formatLocalizedCurrency(
                  fundReport.named_funds_total_paise,
                  locale,
                )}
              </p>
            </div>
            <div className="rounded-md border border-rule p-space-3">
              <p className="text-caption text-ink-muted">{t('Unallocated')}</p>
              <p className="font-semibold">
                {formatLocalizedCurrency(fundReport.unallocated_paise, locale)}
              </p>
            </div>
          </div>
          {fundReport.missing_data ? (
            <div className="mt-space-3">
              <Banner
                title={t('Some fixed-deposit data is unknown')}
                tone="warning"
              >
                {t(
                  'Missing figures stay unknown; they are not reported as zero.',
                )}
              </Banner>
            </div>
          ) : null}
          <div className="mt-space-4 overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-left">
              <thead>
                <tr className="border-b border-rule">
                  <th className="p-space-2">{t('Fund')}</th>
                  <th className="p-space-2">{t('Month')}</th>
                  <th className="p-space-2">{t('Entry in')}</th>
                  <th className="p-space-2">{t('Entry out')}</th>
                  <th className="p-space-2">{t('Transfer net')}</th>
                  <th className="p-space-2">{t('Balance at report end')}</th>
                </tr>
              </thead>
              <tbody>
                {fundReport.funds.flatMap((fund) =>
                  fund.months.map((month) => (
                    <tr
                      key={`${fund.fund_id}:${month.month}`}
                      className="border-b border-rule"
                    >
                      <td className="p-space-2">{fund.fund_name}</td>
                      <td className="p-space-2">
                        {localizedDate(month.month, locale)}
                      </td>
                      <td className="p-space-2">
                        {formatLocalizedCurrency(month.entry_in_paise, locale)}
                      </td>
                      <td className="p-space-2">
                        {formatLocalizedCurrency(month.entry_out_paise, locale)}
                      </td>
                      <td className="p-space-2">
                        {formatLocalizedCurrency(
                          month.transfer_in_paise - month.transfer_out_paise,
                          locale,
                        )}
                      </td>
                      <td className="p-space-2 font-semibold">
                        {formatLocalizedCurrency(fund.balance_paise, locale)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          {fundReport.unreconciled_deposits.length ? (
            <div className="mt-space-4">
              <h3 className="font-semibold">{t('Unreconciled deposits')}</h3>
              <ul className="mt-space-2 grid gap-space-2">
                {fundReport.unreconciled_deposits.map((deposit) => (
                  <li
                    key={deposit.deposit_id}
                    className="rounded-md border border-rule p-space-3"
                  >
                    {deposit.bank_name} · {deposit.fund_name} ·{' '}
                    {deposit.account_balance_paise === null
                      ? t('Account balance unknown')
                      : formatLocalizedCurrency(
                          deposit.account_balance_paise,
                          locale,
                        )}
                    {' · '}
                    {deposit.principal_paise === null
                      ? t('Confirmed principal unknown')
                      : formatLocalizedCurrency(
                          deposit.principal_paise,
                          locale,
                        )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {reconciliation ? (
            <div className="mt-space-5 border-t border-rule pt-space-5">
              <form
                method="get"
                className="mb-space-4 flex flex-wrap items-end gap-space-3"
              >
                <input
                  type="hidden"
                  name="reportFrom"
                  value={reportRange.from}
                />
                <input type="hidden" name="reportTo" value={reportRange.to} />
                <label className="grid gap-space-1">
                  {t('Reconciliation month')}
                  <input
                    type="month"
                    name="reconciliationMonth"
                    defaultValue={reconciliation.month.slice(0, 7)}
                    max={workspace.today.slice(0, 7)}
                    className={fieldClass}
                  />
                </label>
                <button
                  type="submit"
                  className="min-h-12 rounded-md border border-rule-strong px-space-4"
                >
                  {t('Show reconciliation')}
                </button>
              </form>
              <ExpenseFundReconciliation
                canManage={workspace.can_manage}
                locale={locale}
                report={reconciliation}
              />
              {workspace.can_manage ? (
                <a
                  className="mt-space-4 inline-block text-brand underline"
                  href={`/api/expense/export?report=fund_reconciliation&month=${reconciliation.month}&format=csv`}
                >
                  {t('Download reconciliation CSV')}
                </a>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}
      <Card
        title={t('Fixed deposits')}
        description={t(
          'Store bank-confirmed terms. These register figures never add to Accounts totals.',
        )}
      >
        {fixedDeposits.deposits.some(
          (deposit) => deposit.maturity_follow_up,
        ) ? (
          <Banner title={t('Maturity follow-up')} tone="warning">
            <ul className="list-disc pl-space-5">
              {fixedDeposits.deposits
                .filter((deposit) => deposit.maturity_follow_up)
                .map((deposit) => (
                  <li key={deposit.id}>
                    {deposit.bank_name}:{' '}
                    {deposit.days_to_maturity < 0
                      ? t('Past maturity by {days} days', {
                          days: Math.abs(deposit.days_to_maturity),
                        })
                      : deposit.days_to_maturity === 0
                        ? t('Matures today')
                        : t('Matures in {days} days', {
                            days: deposit.days_to_maturity,
                          })}
                  </li>
                ))}
            </ul>
          </Banner>
        ) : (
          <p className="text-caption text-ink-muted">
            {t(
              'No fixed deposit needs maturity follow-up in the next 30 days.',
            )}
          </p>
        )}
        {fixedDeposits.deposits.length ? (
          <ul className="grid gap-space-3">
            {fixedDeposits.deposits.map((deposit) => (
              <li
                key={deposit.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {deposit.bank_name} · {deposit.fund_name}
                </p>
                {deposit.reference ? (
                  <p className="text-caption text-ink-muted">
                    {t('Reference')} {deposit.reference}
                  </p>
                ) : null}
                <p>
                  {localizedDate(deposit.deposit_on, locale)} ·{' '}
                  {t('Matures {date}', {
                    date: localizedDate(deposit.maturity_on, locale),
                  })}
                </p>
                <p>
                  {deposit.principal_paise === null
                    ? t('Confirmed principal unavailable')
                    : formatLocalizedCurrency(deposit.principal_paise, locale)}
                  {deposit.quoted_rate === null
                    ? ` · ${t('Rate unavailable')}`
                    : ` · ${deposit.quoted_rate}%`}
                </p>
                <p className="text-caption text-ink-muted">
                  {t(
                    deposit.reconciliation_status === 'not_reconciled'
                      ? 'Not reconciled: choose a deposit account'
                      : deposit.reconciliation_status === 'principal_unknown'
                        ? 'Principal unknown: comparison unavailable'
                        : deposit.reconciliation_status === 'matched'
                          ? 'Matched to the linked Accounts deposit balance'
                          : 'Difference from the linked Accounts deposit balance',
                  )}
                </p>
                {deposit.account_id &&
                deposit.account_balance_paise !== null ? (
                  <p className="text-caption text-ink-muted">
                    {t('{account} balance: {amount}', {
                      account: deposit.account_name ?? t('Deposit account'),
                      amount: formatLocalizedCurrency(
                        deposit.account_balance_paise,
                        locale,
                      ),
                    })}
                  </p>
                ) : null}
                {fixedDeposits.can_manage ? (
                  <>
                    <details>
                      <summary className="cursor-pointer">
                        {t('Edit fixed deposit')}
                      </summary>
                      <div className="mt-space-3">
                        <ExpenseFixedDepositForm
                          key={deposit.updated_at}
                          funds={workspace.funds}
                          accounts={accountsWorkspace.accounts}
                          today={workspace.today}
                          deposit={deposit}
                        />
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer">
                        {t('Record renewal')}
                      </summary>
                      <div className="mt-space-3">
                        <ExpenseFixedDepositForm
                          key={`renewal:${deposit.id}`}
                          funds={workspace.funds}
                          accounts={accountsWorkspace.accounts}
                          today={workspace.today}
                          predecessor={deposit}
                        />
                      </div>
                    </details>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No fixed deposits recorded.')}</p>
        )}
        {fixedDeposits.can_manage ? (
          <details className="mt-space-3 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">
              {t('Add fixed deposit')}
            </summary>
            <div className="mt-space-3">
              <ExpenseFixedDepositForm
                funds={workspace.funds}
                accounts={accountsWorkspace.accounts}
                today={workspace.today}
              />
            </div>
          </details>
        ) : null}
      </Card>
      <Card
        title={t('Interest and TDS')}
        description={t(
          'Bank figures are recorded separately from Accounts interest. Nothing is posted automatically.',
        )}
      >
        {interestRecords.records.length ? (
          <ul className="grid gap-space-3">
            {interestRecords.records.map((record) => (
              <li
                key={record.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {record.source_label} · {record.fund_name}
                </p>
                <p className="text-caption text-ink-muted">
                  {localizedDate(record.period_from, locale)} –{' '}
                  {localizedDate(record.period_to, locale)}
                </p>
                <p>
                  {t('Gross')}{' '}
                  {record.gross_interest_paise === null
                    ? t('Unknown')
                    : formatLocalizedCurrency(
                        record.gross_interest_paise,
                        locale,
                      )}{' '}
                  · {t('TDS')}{' '}
                  {record.tax_withheld_paise === null
                    ? t('Unknown')
                    : formatLocalizedCurrency(
                        record.tax_withheld_paise,
                        locale,
                      )}{' '}
                  · {t('Net')}{' '}
                  {record.net_interest_paise === null
                    ? t('Unknown')
                    : formatLocalizedCurrency(
                        record.net_interest_paise,
                        locale,
                      )}
                </p>
                {record.credit_difference_paise === null ? (
                  <p className="text-caption text-warning">
                    {t(
                      'Link Accounts interest to compare the actual credit. Missing data is not zero.',
                    )}
                  </p>
                ) : (
                  <p className="text-caption text-ink-muted">
                    {t('Accounts credit difference: {amount}', {
                      amount: formatLocalizedCurrency(
                        record.credit_difference_paise,
                        locale,
                      ),
                    })}
                  </p>
                )}
                {record.annualised_yield_percent === null ? (
                  <p className="text-caption text-ink-muted">
                    {t('Annualised yield unavailable from the known inputs.')}
                  </p>
                ) : (
                  <p className="text-caption text-ink-muted">
                    {t('Estimated annualised yield: {percent}%', {
                      percent: record.annualised_yield_percent.toFixed(2),
                    })}
                  </p>
                )}
                {record.note ? <p>{record.note}</p> : null}
                {interestRecords.can_manage ? (
                  <details>
                    <summary className="cursor-pointer">
                      {t('Edit interest record')}
                    </summary>
                    <div className="mt-space-3">
                      <ExpenseFundInterestForm
                        key={record.updated_at}
                        funds={workspace.funds}
                        deposits={fixedDeposits.deposits}
                        interestEntries={interestRecords.interest_entries}
                        record={record}
                      />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No interest or TDS records yet.')}</p>
        )}
        {interestRecords.can_manage ? (
          <details className="mt-space-3 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">
              {t('Add interest record')}
            </summary>
            <div className="mt-space-3">
              <ExpenseFundInterestForm
                funds={workspace.funds}
                deposits={fixedDeposits.deposits}
                interestEntries={interestRecords.interest_entries}
              />
            </div>
          </details>
        ) : null}
      </Card>
      <Card
        title={t('Transfers between funds')}
        description={t(
          'These transfers move allocation only. They never move bank money, create a bill or establish authority.',
        )}
      >
        <div className="grid gap-space-3">
          {fundTransfers.rules.length ? (
            fundTransfers.rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-md border border-rule p-space-3"
              >
                <p>
                  {rule.from_fund_name} → {rule.to_fund_name}
                  {rule.active ? '' : ` ${t('(inactive)')}`}
                </p>
                {fundTransfers.can_manage ? (
                  <details className="mt-space-2">
                    <summary className="cursor-pointer">
                      {t('Edit transfer pair')}
                    </summary>
                    <div className="mt-space-3">
                      <ExpenseFundTransferRuleForm
                        key={rule.updated_at}
                        funds={workspace.funds}
                        rule={rule}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            ))
          ) : (
            <p>{t('No fund transfer pairs configured yet.')}</p>
          )}
        </div>
        {fundTransfers.can_manage ? (
          <>
            <details className="mt-space-3 rounded-md border border-rule p-space-3">
              <summary className="cursor-pointer">
                {t('Add transfer pair')}
              </summary>
              <div className="mt-space-3">
                <ExpenseFundTransferRuleForm funds={workspace.funds} />
              </div>
            </details>
            {fundTransfers.rules.some((rule) => rule.active) ? (
              <details className="mt-space-3 rounded-md border border-rule p-space-3">
                <summary className="cursor-pointer">
                  {t('Record fund allocation transfer')}
                </summary>
                <div className="mt-space-3">
                  <ExpenseFundTransferForm
                    rules={fundTransfers.rules}
                    today={workspace.today}
                  />
                </div>
              </details>
            ) : null}
          </>
        ) : null}
        <ul className="mt-space-4 grid gap-space-3">
          {fundTransfers.transfers.map((transfer) => (
            <li
              key={transfer.id}
              className="grid gap-space-2 rounded-md border border-rule p-space-3"
            >
              <p className="flex flex-wrap justify-between gap-space-2 text-body-strong">
                <span>
                  {transfer.from_fund_name} → {transfer.to_fund_name}
                </span>
                <span>
                  {formatLocalizedCurrency(transfer.amount_paise, locale)}
                </span>
              </p>
              <p>
                {localizedDate(transfer.transfer_on, locale)} ·{' '}
                {transfer.decision_reference}
              </p>
              <p className="text-caption text-ink-muted">{transfer.reason}</p>
              {transfer.reverses_transfer_id ? (
                <p className="text-caption text-ink-muted">
                  {t('Reasoned reversal of an earlier allocation transfer.')}
                </p>
              ) : fundTransfers.can_manage ? (
                <details>
                  <summary className="cursor-pointer">
                    {t('Reverse allocation transfer')}
                  </summary>
                  <div className="mt-space-3">
                    <ExpenseFundTransferReverseForm
                      transfer={transfer}
                      today={workspace.today}
                    />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title={t('Corpus tracker')}
        description={t(
          'A manual tracker only. It does not create a bill, establish legal debt, give unit credit or block an NOC.',
        )}
      >
        {corpus.records.length ? (
          <ul className="grid gap-space-3">
            {corpus.records.map((record) => (
              <li
                key={record.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {record.unit_label_snapshot} · {record.event_description}
                </p>
                <p>
                  {record.fund_name} · {localizedDate(record.event_on, locale)}{' '}
                  · {record.decision_reference}
                </p>
                <dl className="grid gap-space-2 medium:grid-cols-3">
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Reported')}
                    </dt>
                    <dd>
                      {formatLocalizedCurrency(
                        record.reported_amount_paise,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Linked receipts')}
                    </dt>
                    <dd>
                      {formatLocalizedCurrency(
                        record.linked_receipts_paise,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-muted">
                      {t('Remaining tracker')}
                    </dt>
                    <dd>
                      {formatLocalizedCurrency(record.remaining_paise, locale)}
                    </dd>
                  </div>
                </dl>
                {record.concession_paise > 0 ? (
                  <p className="text-caption text-ink-muted">
                    {t('Concession {amount}: {reason}', {
                      amount: formatLocalizedCurrency(
                        record.concession_paise,
                        locale,
                      ),
                      reason: record.concession_reason ?? '',
                    })}
                  </p>
                ) : null}
                {corpus.can_manage ? (
                  <>
                    <details>
                      <summary className="cursor-pointer">
                        {t('Edit corpus record')}
                      </summary>
                      <div className="mt-space-3">
                        <ExpenseFundCorpusForm
                          key={record.updated_at}
                          funds={workspace.funds}
                          units={corpus.units}
                          today={workspace.today}
                          record={record}
                        />
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer">
                        {t('Link Accounts receipt')}
                      </summary>
                      <div className="mt-space-3">
                        <ExpenseFundReceiptLinkForm
                          record={record}
                          receipts={corpus.eligible_receipts}
                        />
                      </div>
                    </details>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No corpus records yet.')}</p>
        )}
        {corpus.can_manage ? (
          <details className="mt-space-3 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">
              {t('Add corpus record')}
            </summary>
            <div className="mt-space-3">
              <ExpenseFundCorpusForm
                funds={workspace.funds}
                units={corpus.units}
                today={workspace.today}
              />
            </div>
          </details>
        ) : null}
      </Card>
      <Card
        title={t('Sanctioned work')}
        description={t(
          'Actual utilization comes only from linked posted Accounts expenses. This register does not approve or post work.',
        )}
      >
        {works.works.length ? (
          <ul className="grid gap-space-3">
            {works.works.map((work) => (
              <li
                key={work.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {work.title} · {work.fund_name}
                </p>
                <p>
                  {formatLocalizedCurrency(
                    work.sanctioned_amount_paise,
                    locale,
                  )}{' '}
                  · {localizedDate(work.sanctioned_on, locale)}
                  {work.valid_until
                    ? ` · ${t('Valid until {date}', {
                        date: localizedDate(work.valid_until, locale),
                      })}`
                    : ''}
                </p>
                <p className="text-caption text-ink-muted">
                  {work.resolution_title_snapshot ??
                    work.external_reference ??
                    t('Authority reference unavailable')}
                </p>
                <p>
                  {t('Utilized {amount}', {
                    amount: formatLocalizedCurrency(
                      work.utilized_paise,
                      locale,
                    ),
                  })}
                </p>
                {work.authority_status !== 'current' &&
                work.authority_status !== 'external' ? (
                  <p className="text-caption text-warning">
                    {t(
                      work.authority_status === 'changed'
                        ? 'The meeting resolution changed after this work was linked.'
                        : work.authority_status === 'meeting_unavailable'
                          ? 'The meeting module is unavailable; the linked source cannot be checked.'
                          : 'The linked meeting resolution is no longer available.',
                    )}
                  </p>
                ) : null}
                {work.expired ? (
                  <p className="text-caption text-warning">
                    {t('Validity ended. This warning does not block Accounts.')}
                  </p>
                ) : null}
                {work.overrun ? (
                  <p className="text-caption text-danger">
                    {t('Linked utilization exceeds the sanctioned amount.')}
                  </p>
                ) : null}
                {works.can_manage ? (
                  <>
                    <details>
                      <summary className="cursor-pointer">
                        {t('Edit sanctioned work')}
                      </summary>
                      <div className="mt-space-3">
                        <ExpenseFundWorkForm
                          key={work.updated_at}
                          funds={workspace.funds}
                          resolutions={works.resolutions}
                          today={workspace.today}
                          work={work}
                        />
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer">
                        {t('Link Accounts expense')}
                      </summary>
                      <div className="mt-space-3">
                        <ExpenseFundWorkLinkForm
                          work={work}
                          expenses={works.eligible_expenses}
                        />
                      </div>
                    </details>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No sanctioned work recorded yet.')}</p>
        )}
        {works.can_manage ? (
          <details className="mt-space-3 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">
              {t('Add sanctioned work')}
            </summary>
            <div className="mt-space-3">
              <ExpenseFundWorkForm
                funds={workspace.funds}
                resolutions={works.resolutions}
                today={workspace.today}
              />
            </div>
          </details>
        ) : null}
      </Card>
      {opening ? (
        <>
          <Card
            title={t('Fund balances')}
            description={t(
              'Balances are derived from the opening and confirmed Accounts entries.',
            )}
          >
            <div className="grid gap-space-3 medium:grid-cols-2">
              {activity.balances.map((balance) => (
                <div
                  key={balance.fund_id}
                  className="grid gap-space-1 rounded-md border border-rule p-space-3"
                >
                  <p className="text-body-strong">{balance.fund_name}</p>
                  <p>
                    {formatLocalizedCurrency(balance.balance_paise, locale)}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {t('Opening {amount}', {
                      amount: formatLocalizedCurrency(
                        balance.opening_paise,
                        locale,
                      ),
                    })}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-space-3 rounded-md border border-rule-strong p-space-3">
              <p className="text-body-strong">{t('Unallocated')}</p>
              <p>
                {activity.unallocated_paise === null
                  ? t('Not available')
                  : formatLocalizedCurrency(activity.unallocated_paise, locale)}
              </p>
              <p className="text-caption text-ink-muted">
                {t(
                  'Unconfirmed entries and new account openings stay here until an admin confirms their fund.',
                )}
              </p>
            </div>
          </Card>

          <Card
            title={t('Suggested fund mappings')}
            description={t(
              'A mapping suggests a full entry split. It is not applied until an admin confirms the entry.',
            )}
          >
            <div className="grid gap-space-4 medium:grid-cols-3">
              <div className="grid gap-space-3">
                <h3 className="font-semibold">{t('Expense categories')}</h3>
                {activity.mappings.expense_categories.length ? (
                  activity.mappings.expense_categories.map((mapping) =>
                    workspace.can_manage ? (
                      <ExpenseFundMappingForm
                        key={`${mapping.category_id}:${mapping.updated_at ?? 'new'}`}
                        label={mapping.category_name}
                        sourceKind="expense_category"
                        sourceId={mapping.category_id}
                        incomeKind={null}
                        fundId={mapping.fund_id}
                        updatedAt={mapping.updated_at}
                        funds={workspace.funds}
                      />
                    ) : (
                      <p
                        key={mapping.category_id}
                        className="rounded-md border border-rule p-space-3"
                      >
                        {mapping.category_name}:{' '}
                        {workspace.funds.find(
                          (fund) => fund.id === mapping.fund_id,
                        )?.name ?? t('No suggested fund')}
                      </p>
                    ),
                  )
                ) : (
                  <p>{t('No active expense categories.')}</p>
                )}
              </div>
              <div className="grid gap-space-3">
                <h3 className="font-semibold">{t('Income types')}</h3>
                {activity.mappings.income_kinds.map((mapping) => {
                  const label = t(
                    mapping.income_kind === 'donation'
                      ? 'Donation'
                      : mapping.income_kind === 'interest'
                        ? 'Interest'
                        : 'Other income',
                  );
                  return workspace.can_manage ? (
                    <ExpenseFundMappingForm
                      key={`${mapping.income_kind}:${mapping.updated_at ?? 'new'}`}
                      label={label}
                      sourceKind="income_kind"
                      sourceId={null}
                      incomeKind={mapping.income_kind}
                      fundId={mapping.fund_id}
                      updatedAt={mapping.updated_at}
                      funds={workspace.funds}
                    />
                  ) : (
                    <p
                      key={mapping.income_kind}
                      className="rounded-md border border-rule p-space-3"
                    >
                      {label}:{' '}
                      {workspace.funds.find(
                        (fund) => fund.id === mapping.fund_id,
                      )?.name ?? t('No suggested fund')}
                    </p>
                  );
                })}
              </div>
              <div className="grid gap-space-3">
                <h3 className="font-semibold">{t('Billing charges')}</h3>
                {billingMappings.length ? (
                  billingMappings.map((mapping) =>
                    workspace.can_manage ? (
                      <ExpenseFundMappingForm
                        key={`${mapping.charge_type_id}:${mapping.updated_at ?? 'new'}`}
                        label={mapping.charge_name}
                        sourceKind="billing_charge"
                        sourceId={mapping.charge_type_id}
                        incomeKind={null}
                        fundId={mapping.fund_id}
                        updatedAt={mapping.updated_at}
                        funds={workspace.funds}
                      />
                    ) : (
                      <p
                        key={mapping.charge_type_id}
                        className="rounded-md border border-rule p-space-3"
                      >
                        {mapping.charge_name}:{' '}
                        {workspace.funds.find(
                          (fund) => fund.id === mapping.fund_id,
                        )?.name ?? t('No suggested fund')}
                      </p>
                    ),
                  )
                ) : (
                  <p>{t('No active Billing charges.')}</p>
                )}
              </div>
            </div>
          </Card>

          {workspace.can_manage && bulkSuggestableEntries.length ? (
            <Card
              title={t('Confirm suggested splits')}
              description={t(
                'Selected entries are confirmed together. Closed-month entries are never confirmed.',
              )}
            >
              <ExpenseFundBulkSuggestionsForm
                entries={bulkSuggestableEntries}
                suggestions={billingSuggestions}
              />
            </Card>
          ) : null}

          <span id="fund-activity" />
          <Card
            title={t('Accounts entries and fund allocations')}
            description={t(
              'Each confirmed split equals the original Accounts entry, including Unallocated.',
            )}
          >
            {activity.entries.length ? (
              <ul className="grid gap-space-3">
                {activity.entries.map((entry) => (
                  <li
                    key={entry.entry_id}
                    className="grid gap-space-2 rounded-md border border-rule p-space-3"
                  >
                    <p className="flex flex-wrap justify-between gap-space-2 text-body-strong">
                      <span>
                        {localizedDate(entry.entry_date, locale)} ·{' '}
                        {entry.counterparty}
                      </span>
                      <span>
                        {entry.direction === 'in' ? '+' : '−'}
                        {formatLocalizedCurrency(entry.amount_paise, locale)}
                      </span>
                    </p>
                    <p className="text-caption text-ink-muted">
                      {t('Voucher')} {entry.voucher_no}
                      {entry.category_name ? ` · ${entry.category_name}` : ''}
                      {entry.income_kind
                        ? ` · ${t(
                            entry.income_kind === 'donation'
                              ? 'Donation'
                              : entry.income_kind === 'interest'
                                ? 'Interest'
                                : 'Other income',
                          )}`
                        : ''}
                    </p>
                    {entry.month_closed ? (
                      <p className="text-caption text-warning">
                        {t(
                          'Month closed; reopen it before changing allocations.',
                        )}
                      </p>
                    ) : null}
                    {entry.allocations.length ? (
                      <>
                        <ul className="grid gap-space-1 text-caption">
                          {entry.allocations.map((allocation) => (
                            <li
                              key={allocation.fund_id ?? 'unallocated'}
                              className="flex flex-wrap justify-between gap-space-2"
                            >
                              <span>
                                {allocation.fund_name ?? t('Unallocated')}
                              </span>
                              <span>
                                {formatLocalizedCurrency(
                                  allocation.amount_paise,
                                  locale,
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {entry.source === 'reversal' ? (
                          <p className="text-caption text-ink-muted">
                            {t(
                              'This reversal follows the original allocation.',
                            )}
                          </p>
                        ) : workspace.can_manage && !entry.month_closed ? (
                          <details>
                            <summary className="cursor-pointer">
                              {t('Correct allocation')}
                            </summary>
                            <div className="mt-space-3">
                              <ExpenseFundAllocationCorrectionForm
                                key={`${entry.entry_id}:${entry.allocations
                                  .map(
                                    (allocation) =>
                                      `${allocation.fund_id ?? 'unallocated'}:${allocation.amount_paise}`,
                                  )
                                  .join(':')}`}
                                entry={entry}
                                funds={activeFunds}
                              />
                            </div>
                          </details>
                        ) : null}
                      </>
                    ) : workspace.can_manage && !entry.month_closed ? (
                      <details>
                        <summary className="cursor-pointer">
                          {entry.suggested_fund_id
                            ? t('Review suggested allocation')
                            : t('Set fund allocation')}
                        </summary>
                        <div className="mt-space-3">
                          <ExpenseFundAllocationForm
                            key={`${entry.entry_id}:${entry.suggested_fund_id ?? 'none'}`}
                            entry={entry}
                            funds={activeFunds}
                            suggestedAllocations={
                              billingSuggestionByEntry.get(entry.entry_id) ??
                              undefined
                            }
                          />
                        </div>
                      </details>
                    ) : (
                      <p className="text-caption text-ink-muted">
                        {t('Not confirmed; currently Unallocated.')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {t('No Accounts entries are available for allocation yet.')}
              </p>
            )}
            <ExpensePager
              page={allocationPage}
              total={activity.entries_total}
              pageSize={EXPENSE_PAGE_SIZE}
              href={fundAllocationHref}
              label={t('Fund allocation pages')}
              locale={locale}
            />
          </Card>
        </>
      ) : null}
    </section>
  );
}
