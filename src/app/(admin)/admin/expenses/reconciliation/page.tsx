// Reconcile a bank account: statement items against book entries, never posting differences.
import { Card } from '@/components/ui/data-display';
import {
  StatementCancelForm,
  StatementItemForm,
  StatementMatchForm,
} from '@/components/expense/reconciliation-controls';
import { ExpenseNav, ExpensePager } from '@/components/expense/nav';
import {
  EXPENSE_PAGE_SIZE,
  getExpenseWorkspace,
  getReconciliation,
} from '@/core/expense/operations';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Bank reconciliation | Homeish',
  robots: { index: false, follow: false },
};
const fieldClass =
  'min-h-12 min-w-0 rounded-md border border-rule-strong bg-surface px-space-3';
const STATUS_LABELS = {
  unmatched: 'Unmatched',
  matched: 'Matched',
  cancelled: 'Cancelled',
} as const;

export default async function ExpenseReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; page?: string }>;
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
  const search = await searchParams;
  const w = await getExpenseWorkspace();
  const banks = w.accounts.filter((a) => a.account_type === 'bank');
  const account =
    banks.find((a) => a.id === search.account) ?? banks[0] ?? null;
  const pageValue = Number(search.page);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const data = account ? await getReconciliation(account.id, page) : null;
  const money = (direction: 'in' | 'out', paise: number) =>
    `${direction === 'in' ? '+' : '−'}${formatLocalizedCurrency(paise, locale)}`;

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Bank reconciliation')}</h1>
      <ExpenseNav
        current="reconciliation"
        canManage={w.can_manage}
        locale={locale}
      />
      {!w.can_manage ? (
        <p role="status" className="rounded-md border border-rule p-space-3">
          {t('View only')}
        </p>
      ) : null}
      <p>
        {t(
          'Enter lines from the bank statement and match them to book entries. Differences are never posted automatically.',
        )}
      </p>
      {!account || !data ? (
        <Card title={t('No bank account')}>
          <p>{t('Add a bank account in setup to reconcile it.')}</p>
        </Card>
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-space-3">
            <label className="grid min-w-0 gap-space-1">
              {t('Bank account')}
              <select
                name="account"
                defaultValue={account.id}
                className={fieldClass}
              >
                {banks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="min-h-12 rounded-md border border-rule px-space-4"
            >
              {t('Show')}
            </button>
          </form>

          {w.can_manage ? (
            <Card title={t('Add statement item')}>
              <StatementItemForm accountId={account.id} today={w.today} />
            </Card>
          ) : null}

          <Card
            title={t('Statement items')}
            description={
              data.old_total
                ? t('{count} unmatched items are older than 30 days.', {
                    count: formatLocalizedNumber(data.old_total, locale),
                  })
                : undefined
            }
          >
            {data.items.length ? (
              <ul className="grid min-w-0 gap-space-3">
                {data.items.map((item) => {
                  const candidates = data.unmatched_entries
                    .filter(
                      (entry) =>
                        entry.direction === item.direction &&
                        entry.amount_paise === item.amount_paise,
                    )
                    .map((entry) => ({
                      id: entry.id,
                      label: `${entry.voucher_no} · ${formatDate(entry.entry_date)} · ${entry.counterparty}`,
                    }));
                  return (
                    <li
                      key={item.id}
                      className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
                    >
                      <p className="flex flex-wrap justify-between gap-space-2 text-body-strong">
                        <span>
                          {formatDate(item.statement_date)}
                          {item.party ? ` · ${item.party}` : ''}
                          {item.reference ? ` · ${item.reference}` : ''}
                        </span>
                        <span>{money(item.direction, item.amount_paise)}</span>
                      </p>
                      <p className="flex flex-wrap gap-space-2">
                        <span className="rounded-full border border-rule px-space-2 text-caption">
                          {t(STATUS_LABELS[item.status])}
                        </span>
                        {item.is_old ? (
                          <span className="rounded-full border border-warning px-space-2 text-caption">
                            {t('Older than 30 days')}
                          </span>
                        ) : null}
                      </p>
                      {item.status === 'matched' && item.matched_voucher_no ? (
                        <p className="text-caption text-ink-muted">
                          {t('Matched to {voucher}', {
                            voucher: item.matched_voucher_no,
                          })}
                          {item.decided_by_name
                            ? ` · ${item.decided_by_name}`
                            : ''}
                        </p>
                      ) : null}
                      {item.status === 'cancelled' ? (
                        <p className="text-caption text-ink-muted">
                          {t('Cancelled: {reason}', {
                            reason: item.cancel_reason ?? '',
                          })}
                          {item.decided_by_name
                            ? ` · ${item.decided_by_name}`
                            : ''}
                        </p>
                      ) : null}
                      {w.can_manage && item.status === 'unmatched' ? (
                        <div className="grid min-w-0 gap-space-3 medium:grid-cols-2">
                          {candidates.length ? (
                            <StatementMatchForm
                              itemId={item.id}
                              candidates={candidates}
                            />
                          ) : (
                            <p className="text-caption text-ink-muted">
                              {t(
                                'No unmatched book entry has the same amount and direction.',
                              )}
                            </p>
                          )}
                          <details>
                            <summary className="cursor-pointer">
                              {t('Cancel item')}
                            </summary>
                            <StatementCancelForm itemId={item.id} />
                          </details>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>{t('No statement items yet.')}</p>
            )}
            <ExpensePager
              locale={locale}
              page={page}
              total={data.total}
              pageSize={EXPENSE_PAGE_SIZE}
              href={(next) =>
                `/admin/expenses/reconciliation?${new URLSearchParams({ account: account.id, page: String(next) })}`
              }
              label={t('Statement item pages')}
            />
          </Card>

          <Card title={t('Book entries not yet matched')}>
            {data.unmatched_entries.length ? (
              <ul className="grid min-w-0 gap-space-2">
                {data.unmatched_entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap justify-between gap-space-2"
                  >
                    <span>
                      {entry.voucher_no} · {formatDate(entry.entry_date)} ·{' '}
                      {entry.counterparty}
                      {entry.reference ? ` · ${entry.reference}` : ''}
                    </span>
                    <span>{money(entry.direction, entry.amount_paise)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('Every book entry on this account is matched.')}</p>
            )}
            {data.unmatched_entries_total > data.unmatched_entries.length ? (
              <p className="mt-space-3 text-caption text-ink-muted">
                {t('Showing the first {shown} of {total}.', {
                  shown: formatLocalizedNumber(
                    data.unmatched_entries.length,
                    locale,
                  ),
                  total: formatLocalizedNumber(
                    data.unmatched_entries_total,
                    locale,
                  ),
                })}
              </p>
            ) : null}
          </Card>
        </>
      )}
    </section>
  );
}
