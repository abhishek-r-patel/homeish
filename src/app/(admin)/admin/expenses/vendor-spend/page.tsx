// Show P42 vendor spend from posted Accounts entries with confirmed mappings.
import { Card, StatTile } from '@/components/ui/data-display';
import { ExpenseNav } from '@/components/expense/nav';
import {
  ExpensePayeeMappingForm,
  ExpensePayeeMappingRemoveForm,
} from '@/components/expense/vendor-spend-controls';
import {
  getExpenseVendorSpend,
  getExpenseWorkspace,
} from '@/core/expense/operations';
import { expenseRangeOrDefault } from '@/core/expense/validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { translateMessage } from '@/core/i18n/messages';
import { getRequestLocale } from '@/core/i18n/request-locale';

export const metadata = {
  title: 'Vendor spend | Homeish',
  robots: { index: false, follow: false },
};

const fieldClass =
  'min-h-12 min-w-0 rounded-md border border-rule-strong bg-surface px-space-3';

export default async function ExpenseVendorSpendPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    categoryId?: string;
    group?: string;
    costNature?: string;
  }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const search = await searchParams;
  const workspace = await getExpenseWorkspace();
  const range = expenseRangeOrDefault(search, workspace.today);
  const input = {
    ...range,
    categoryId: search.categoryId || null,
    group: search.group || null,
    costNature: search.costNature || null,
  };
  const report = await getExpenseVendorSpend(input);
  const query = new URLSearchParams({
    from: report.from,
    to: report.to,
    report: 'vendor_spend',
    format: 'csv',
  });
  if (search.categoryId) query.set('categoryId', search.categoryId);
  if (search.group) query.set('group', search.group);
  if (search.costNature) query.set('costNature', search.costNature);
  const pdfQuery = new URLSearchParams(query);
  pdfQuery.set('format', 'pdf');
  const groups = Array.from(
    new Set(
      report.categories.flatMap((category) =>
        category.detail_group ? [category.detail_group] : [],
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const formatDate = (value: string) =>
    formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Vendor spend')}</h1>
      <ExpenseNav
        current="vendor-spend"
        canManage={workspace.can_manage}
        locale={locale}
      />
      <Card title={t('Report filters')}>
        <form
          method="get"
          className="grid min-w-0 gap-space-3 medium:grid-cols-3"
        >
          <label className="grid min-w-0 gap-space-1">
            {t('From')}
            <input
              className={fieldClass}
              type="date"
              name="from"
              required
              defaultValue={report.from}
            />
          </label>
          <label className="grid min-w-0 gap-space-1">
            {t('To')}
            <input
              className={fieldClass}
              type="date"
              name="to"
              required
              defaultValue={report.to}
            />
          </label>
          <label className="grid min-w-0 gap-space-1">
            {t('Category')}
            <select
              className={fieldClass}
              name="categoryId"
              defaultValue={search.categoryId ?? ''}
            >
              <option value="">{t('All categories')}</option>
              {report.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-space-1">
            {t('Group')}
            <select
              className={fieldClass}
              name="group"
              defaultValue={search.group ?? ''}
            >
              <option value="">{t('All groups')}</option>
              {groups.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-space-1">
            {t('Cost nature')}
            <select
              className={fieldClass}
              name="costNature"
              defaultValue={search.costNature ?? ''}
            >
              <option value="">{t('All cost types')}</option>
              <option value="fixed">{t('Fixed')}</option>
              <option value="variable">{t('Variable')}</option>
              <option value="periodic">{t('Periodic')}</option>
            </select>
          </label>
          <button
            type="submit"
            className="min-h-12 self-end rounded-md border border-rule px-space-3"
          >
            {t('Show report')}
          </button>
        </form>
        <p className="mt-space-3 text-caption text-ink-muted">
          {t(
            '{from} to {to}. Ranges can cover up to 24 months. Transfers and income are excluded.',
            { from: formatDate(report.from), to: formatDate(report.to) },
          )}
        </p>
        <div className="mt-space-3 flex flex-wrap gap-space-4">
          <a
            className="text-brand underline"
            href={`/api/expense/export?${query}`}
          >
            {t('Download CSV')}
          </a>
          <a
            className="text-brand underline"
            href={`/api/expense/export?${pdfQuery}`}
          >
            {t('Download PDF')}
          </a>
        </div>
      </Card>

      <div className="grid gap-space-3 medium:grid-cols-3">
        <StatTile
          label={t('Filtered expenditure')}
          value={formatLocalizedCurrency(report.total_expense_paise, locale)}
        />
        <StatTile
          label={t('Accounts expenditure')}
          value={formatLocalizedCurrency(report.accounts_expense_paise, locale)}
        />
        <StatTile
          label={t('Reconciliation')}
          value={
            report.reconciles_to_accounts ? t('Matches') : t('Needs review')
          }
        />
      </div>

      <Card
        title={t('By vendor or payee')}
        description={t(
          'High share means 40% or more of this report. It is a reporting signal, not a finding.',
        )}
      >
        {report.rows.length ? (
          <ul className="grid gap-space-3">
            {report.rows.map((row) => (
              <li
                key={row.key}
                className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-space-3">
                  <div>
                    <h2 className="text-body-strong">
                      {row.vendor_name ?? row.payee}
                    </h2>
                    <p className="text-caption text-ink-muted">
                      {row.vendor_name
                        ? t('Linked vendor')
                        : t('Not linked to a vendor')}
                    </p>
                  </div>
                  <p className="tabular-nums">
                    {formatLocalizedCurrency(row.total_paise, locale)}
                  </p>
                </div>
                <p>
                  {t('Share {share}%', {
                    share: (row.share_bp / 100).toFixed(1),
                  })}
                  {' · '}
                  {t('{months} active month(s)', {
                    months: row.active_months,
                  })}
                  {' · '}
                  {t('Average')}{' '}
                  {formatLocalizedCurrency(
                    row.average_per_active_month_paise,
                    locale,
                  )}
                  {row.high_share ? ` · ${t('High share')}` : ''}
                </p>
                {report.vendor_enabled ? (
                  <p>
                    {t('Approved quotes — not payments')}:{' '}
                    {formatLocalizedCurrency(
                      row.approved_quote_paise ?? 0,
                      locale,
                    )}
                  </p>
                ) : null}
                <div className="grid gap-space-2 medium:grid-cols-2">
                  <details>
                    <summary className="cursor-pointer">
                      {t('Month by month')}
                    </summary>
                    <ul className="mt-space-2 grid gap-space-1">
                      {row.months.map((month) => (
                        <li
                          key={month.month}
                          className="flex justify-between gap-space-3"
                        >
                          <span>{month.month.slice(0, 7)}</span>
                          <span className="tabular-nums">
                            {formatLocalizedCurrency(
                              month.amount_paise,
                              locale,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <details>
                    <summary className="cursor-pointer">
                      {t('Category breakdown')}
                    </summary>
                    <ul className="mt-space-2 grid gap-space-1">
                      {row.categories.map((category) => (
                        <li
                          key={category.category_id}
                          className="flex justify-between gap-space-3"
                        >
                          <span>{category.category_name}</span>
                          <span className="tabular-nums">
                            {formatLocalizedCurrency(
                              category.amount_paise,
                              locale,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No posted expenditure matches this report.')}</p>
        )}
      </Card>

      {report.vendor_enabled ? (
        <>
          <Card title={t('Payee mapping suggestions')}>
            {report.mapping_suggestions.length ? (
              <ul className="grid gap-space-3">
                {report.mapping_suggestions.map((suggestion) => (
                  <li key={suggestion.payee_key}>
                    <p className="mb-space-2">
                      {t('Exact name match: {payee} → {vendor}', {
                        payee: suggestion.payee,
                        vendor: suggestion.vendor_name,
                      })}
                    </p>
                    {workspace.can_manage ? (
                      <ExpensePayeeMappingForm
                        payee={suggestion.payee}
                        vendors={report.vendors}
                        suggestedVendorId={suggestion.vendor_id}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('No exact name matches need confirmation.')}</p>
            )}
          </Card>
          <Card title={t('Confirmed mappings')}>
            {report.mappings.length ? (
              <ul className="grid gap-space-3">
                {report.mappings.map((mapping) => (
                  <li key={mapping.id}>
                    <p className="mb-space-2">
                      {mapping.payee_key} → {mapping.vendor_name}
                    </p>
                    {workspace.can_manage ? (
                      <ExpensePayeeMappingRemoveForm mapping={mapping} />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('No payees are mapped yet.')}</p>
            )}
          </Card>
        </>
      ) : (
        <p className="text-caption text-ink-muted">
          {t(
            'The Vendor module is off. Payees still show, while mappings and approved quotes stay hidden.',
          )}
        </p>
      )}
    </section>
  );
}
