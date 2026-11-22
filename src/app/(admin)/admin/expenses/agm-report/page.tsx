// Preview and edit the source-linked, non-statutory P41 AGM draft.
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { ExpenseAgmDraftForm } from '@/components/expense/agm';
import { ExpenseAuditWarningForm } from '@/components/expense/audit';
import { ExpenseNav } from '@/components/expense/nav';
import {
  getExpenseAgmDraft,
  getExpenseAudit,
  getExpenseFinancialPosition,
  getExpenseMultiYear,
  getExpenseStatements,
  getExpenseWorkspace,
} from '@/core/expense/operations';
import { expenseFinancialYearStart } from '@/core/expense/validation';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { z } from 'zod';

export const metadata = {
  title: 'Accounts AGM draft | Homeish',
  robots: { index: false, follow: false },
};

export default async function ExpenseAgmReportPage({
  searchParams,
}: {
  searchParams: Promise<{ financialYearStart?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const search = await searchParams;
  const workspace = await getExpenseWorkspace();
  const currentStart = expenseFinancialYearStart(workspace.today);
  const selected = z.iso
    .date()
    .refine((value) => value.endsWith('-04-01'))
    .safeParse(search.financialYearStart);
  const financialYearStart = selected.success ? selected.data : currentStart;
  const yearEnd = new Date(`${financialYearStart}T00:00:00Z`);
  yearEnd.setUTCFullYear(yearEnd.getUTCFullYear() + 1);
  yearEnd.setUTCDate(0);
  const fullYearEnd = yearEnd.toISOString().slice(0, 10);
  const reportEnd =
    fullYearEnd < workspace.today ? fullYearEnd : workspace.today;
  const [draft, audit, statements, position, comparison] = await Promise.all([
    getExpenseAgmDraft(financialYearStart),
    getExpenseAudit(financialYearStart),
    getExpenseStatements({ from: financialYearStart, to: reportEnd }),
    getExpenseFinancialPosition(reportEnd),
    getExpenseMultiYear(),
  ]);
  const yearOptions = Array.from({ length: 5 }, (_, index) => {
    const year = Number(currentStart.slice(0, 4)) - index;
    return `${year}-04-01`;
  });
  const labelYear = (value: string) => {
    const year = Number(value.slice(0, 4));
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  };
  const money = (value: number) => formatLocalizedCurrency(value, locale);
  const date = (value: string) =>
    formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const pdfQuery = new URLSearchParams({
    report: 'agm',
    format: 'pdf',
    financialYearStart,
  });

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Accounts AGM draft')}</h1>
      <ExpenseNav
        current="agm-report"
        canManage={workspace.can_manage}
        locale={locale}
      />
      <Banner tone="warning" title={t('Draft — not a statutory report')}>
        {t(
          'Every included figure is source-linked. This is not published in the app and does not replace professional review.',
        )}
      </Banner>

      <Card title={t('Financial year')}>
        <form method="get" className="flex flex-wrap items-end gap-space-3">
          <label className="grid min-w-0 gap-space-1">
            {t('Year')}
            <select
              name="financialYearStart"
              defaultValue={financialYearStart}
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            >
              {yearOptions.map((year) => (
                <option value={year} key={year}>
                  {labelYear(year)}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-12 rounded-md border border-rule px-space-4">
            {t('Show draft')}
          </button>
          {draft.warning_acknowledged_at ? (
            <a
              className="min-h-12 content-center text-brand underline"
              href={`/api/expense/export?${pdfQuery}`}
            >
              {t('Download draft PDF')}
            </a>
          ) : null}
        </form>
      </Card>

      {!draft.warning_acknowledged_at ? (
        draft.can_manage ? (
          <Card title={t('Acknowledge the warning')}>
            <ExpenseAuditWarningForm />
          </Card>
        ) : (
          <Card title={t('Waiting for an administrator')}>
            <p>
              {t(
                'An administrator must acknowledge the shared audit and AGM warning before a draft can be used.',
              )}
            </p>
          </Card>
        )
      ) : (
        <>
          <Card title={t('Included sections')}>
            <ul className="grid gap-space-2">
              {Object.entries(draft.sections).map(([key, enabled]) => (
                <li className="flex justify-between gap-space-3" key={key}>
                  <span>{t(key)}</span>
                  <strong
                    className={enabled ? 'text-success' : 'text-ink-muted'}
                  >
                    {enabled ? t('Included') : t('Off')}
                  </strong>
                </li>
              ))}
            </ul>
            {draft.can_manage ? (
              <p className="mt-space-3">
                <a
                  className="text-brand underline"
                  href="/admin/expenses/setup"
                >
                  {t('Change sections in Accounts setup')}
                </a>
              </p>
            ) : null}
          </Card>

          {draft.sections.finances ? (
            <Card title={t("Year's finances")}>
              <dl className="grid gap-space-2">
                <div className="flex justify-between gap-space-3">
                  <dt>{t('Opening money held')}</dt>
                  <dd>{money(statements.opening_money_paise)}</dd>
                </div>
                <div className="flex justify-between gap-space-3">
                  <dt>{t('Receipts')}</dt>
                  <dd>{money(statements.receipts_paise)}</dd>
                </div>
                <div className="flex justify-between gap-space-3">
                  <dt>{t('Payments')}</dt>
                  <dd>{money(statements.payments_paise)}</dd>
                </div>
                <div className="flex justify-between gap-space-3">
                  <dt>{t('Closing money held')}</dt>
                  <dd>{money(statements.closing_money_paise)}</dd>
                </div>
              </dl>
              <p className="mt-space-3 text-caption text-ink-muted">
                {t('Source: Accounts book,')} {date(financialYearStart)} —{' '}
                {date(reportEnd)}
              </p>
            </Card>
          ) : null}

          {draft.sections.comparison ? (
            <Card title={t('Multi-year comparison')}>
              <ul className="grid gap-space-2">
                {comparison.years.map((year) => (
                  <li
                    className="flex flex-wrap justify-between gap-space-3"
                    key={year.financial_year_start}
                  >
                    <span>{labelYear(year.financial_year_start)}</span>
                    <span>
                      {year.not_available
                        ? t('Not available')
                        : `${money(year.income_paise)} / ${money(year.expense_paise)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {draft.sections.funds ? (
            <Card title={t('Funds')}>
              {position.funds_enabled ? (
                <ul className="grid gap-space-2">
                  {position.funds.map((fund) => (
                    <li
                      className="flex justify-between gap-space-3"
                      key={fund.fund}
                    >
                      <span>{fund.fund}</span>
                      <span>{money(fund.balance_paise)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('Fund tracking is not active.')}</p>
              )}
            </Card>
          ) : null}

          {draft.sections.audit ? (
            <Card title={t('Audit status and opinion')}>
              <p>
                {audit.year?.opinion_text ?? t('No audit opinion recorded.')}
              </p>
              <ul className="mt-space-3 grid gap-space-2">
                {audit.checks.map((check) => (
                  <li
                    className="flex justify-between gap-space-3"
                    key={check.key}
                  >
                    <span>{check.detail}</span>
                    <strong
                      className={
                        check.status === 'pass'
                          ? 'text-success'
                          : 'text-warning'
                      }
                    >
                      {check.status === 'pass' ? t('Pass') : t('Attention')}
                    </strong>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {draft.sections.position ? (
            <Card title={t('Financial position summary at year end')}>
              <p>
                {t('Accounts total')} · {money(position.accounts_total_paise)}
              </p>
              <p className="mt-space-2 text-caption text-ink-muted">
                {t('As at')} {date(position.as_of)} · {t('not a balance sheet')}
              </p>
            </Card>
          ) : null}

          {draft.sections.written ? (
            <Card title={t('Admin-written sections')}>
              {draft.can_manage ? (
                <ExpenseAgmDraftForm
                  key={`${financialYearStart}-${draft.draft?.version ?? 0}`}
                  draft={draft.draft}
                  financialYearStart={financialYearStart}
                />
              ) : draft.draft?.written_sections.length ? (
                <div className="grid gap-space-4">
                  {draft.draft.written_sections.map((section, index) => (
                    <article key={`${section.title}-${index}`}>
                      <h3 className="text-heading font-semibold">
                        {section.title}
                      </h3>
                      <p className="mt-space-2 whitespace-pre-wrap">
                        {section.body}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p>{t('No written sections saved.')}</p>
              )}
            </Card>
          ) : null}
        </>
      )}
    </section>
  );
}
