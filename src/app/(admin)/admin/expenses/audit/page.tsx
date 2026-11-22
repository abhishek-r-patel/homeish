// Show and manage the P41 non-certifying Accounts audit tracker.
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import {
  ExpenseAuditObjectionForm,
  ExpenseAuditQueryForm,
  ExpenseAuditWarningForm,
  ExpenseAuditYearForm,
} from '@/components/expense/audit';
import { ExpenseNav } from '@/components/expense/nav';
import {
  getExpenseAudit,
  getExpenseWorkspace,
} from '@/core/expense/operations';
import { expenseFinancialYearStart } from '@/core/expense/validation';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { z } from 'zod';

export const metadata = {
  title: 'Accounts audit tracker | Homeish',
  robots: { index: false, follow: false },
};

export default async function ExpenseAuditPage({
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
  const audit = await getExpenseAudit(financialYearStart);
  const auditYear = audit.year;
  const yearOptions = Array.from({ length: 5 }, (_, index) => {
    const year = Number(currentStart.slice(0, 4)) - index;
    return `${year}-04-01`;
  });
  const labelYear = (value: string) => {
    const year = Number(value.slice(0, 4));
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  };

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">
        {t('Accounts audit tracker')}
      </h1>
      <ExpenseNav
        current="audit"
        canManage={workspace.can_manage}
        locale={locale}
      />
      <Banner
        tone="warning"
        title={t('Tracker only — not an audit or certification')}
      >
        {t(
          'This records society-entered facts. It does not generate an opinion, certify completion or submit anything.',
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
            {t('Show year')}
          </button>
        </form>
      </Card>

      {!audit.warning_acknowledged_at ? (
        audit.can_manage ? (
          <Card title={t('Acknowledge the warning')}>
            <ExpenseAuditWarningForm />
          </Card>
        ) : (
          <Card title={t('Waiting for an administrator')}>
            <p>
              {t(
                'An administrator must acknowledge the audit and AGM warning before this tracker can be used.',
              )}
            </p>
          </Card>
        )
      ) : (
        <>
          <Card
            title={t('Appointment, report and opinion')}
            description={t(
              'Keep the recorded opinion exactly as copied from the source report.',
            )}
          >
            {audit.can_manage ? (
              <ExpenseAuditYearForm
                financialYearStart={financialYearStart}
                year={audit.year}
                documents={audit.documents}
              />
            ) : audit.year ? (
              <dl className="grid gap-space-2">
                <div>
                  <dt>{t('Auditor')}</dt>
                  <dd>{audit.year.auditor_name}</dd>
                </div>
                <div>
                  <dt>{t('Firm')}</dt>
                  <dd>{audit.year.auditor_firm}</dd>
                </div>
                <div>
                  <dt>{t('Appointed')}</dt>
                  <dd>{audit.year.appointed_on}</dd>
                </div>
                <div>
                  <dt>{t('Opinion')}</dt>
                  <dd>{audit.year.opinion_text ?? t('Not recorded')}</dd>
                </div>
              </dl>
            ) : (
              <p>{t('No audit year has been recorded.')}</p>
            )}
          </Card>

          {auditYear ? (
            <>
              <Card title={t('Year-end checks')}>
                <ul className="grid gap-space-2">
                  {audit.checks.map((check) => (
                    <li
                      className="flex min-w-0 items-start gap-space-3 rounded-md border border-rule p-space-3"
                      key={check.key}
                    >
                      <strong
                        className={
                          check.status === 'pass'
                            ? 'text-success'
                            : 'text-warning'
                        }
                      >
                        {check.status === 'pass' ? t('Pass') : t('Attention')}
                      </strong>
                      <span>{check.detail}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title={t('Auditor queries')}>
                {audit.queries.length === 0 ? (
                  <p className="mb-space-3 text-ink-muted">
                    {t('No queries recorded.')}
                  </p>
                ) : (
                  <ul className="mb-space-4 grid gap-space-3">
                    {audit.queries.map((query) => (
                      <li
                        className="rounded-md border border-rule p-space-3"
                        key={query.id}
                      >
                        <p className="font-semibold">
                          #{query.query_number} · {query.area} ·{' '}
                          {t(query.status)}
                        </p>
                        <p className="mt-space-2">{query.question}</p>
                        <p className="mt-space-2 text-caption text-ink-muted">
                          {query.assignee_name} · {t('Due')} {query.due_date}
                        </p>
                        {audit.can_manage ? (
                          <details className="mt-space-3">
                            <summary className="cursor-pointer">
                              {t('Edit query')}
                            </summary>
                            <ExpenseAuditQueryForm
                              auditYearId={auditYear.id}
                              query={query}
                              staff={audit.staff}
                              today={workspace.today}
                            />
                          </details>
                        ) : query.response ? (
                          <p className="mt-space-3">{query.response}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {audit.can_manage ? (
                  <details>
                    <summary className="cursor-pointer">
                      {t('Add query')}
                    </summary>
                    <ExpenseAuditQueryForm
                      auditYearId={auditYear.id}
                      query={null}
                      staff={audit.staff}
                      today={workspace.today}
                    />
                  </details>
                ) : null}
              </Card>

              <Card title={t('Objections and corrections')}>
                {audit.objections.length === 0 ? (
                  <p className="mb-space-3 text-ink-muted">
                    {t('No objections recorded.')}
                  </p>
                ) : (
                  <ul className="mb-space-4 grid gap-space-3">
                    {audit.objections.map((objection) => (
                      <li
                        className="rounded-md border border-rule p-space-3"
                        key={objection.id}
                      >
                        <p className="font-semibold">
                          {objection.owner_name} · {t(objection.status)}
                        </p>
                        <p className="mt-space-2">{objection.description}</p>
                        <p className="mt-space-2 text-caption text-ink-muted">
                          {t('Due')} {objection.due_date}
                        </p>
                        {audit.can_manage ? (
                          <details className="mt-space-3">
                            <summary className="cursor-pointer">
                              {t('Edit objection')}
                            </summary>
                            <ExpenseAuditObjectionForm
                              auditYearId={auditYear.id}
                              objection={objection}
                              staff={audit.staff}
                              today={workspace.today}
                              documents={audit.documents}
                            />
                          </details>
                        ) : objection.correction_note ? (
                          <p className="mt-space-3">
                            {objection.correction_note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {audit.can_manage ? (
                  <details>
                    <summary className="cursor-pointer">
                      {t('Add objection')}
                    </summary>
                    <ExpenseAuditObjectionForm
                      auditYearId={auditYear.id}
                      objection={null}
                      staff={audit.staff}
                      today={workspace.today}
                      documents={audit.documents}
                    />
                  </details>
                ) : null}
              </Card>

              <Card title={t('Change history')}>
                {audit.revisions.length === 0 ? (
                  <p>{t('No changes yet.')}</p>
                ) : (
                  <ul className="grid gap-space-2">
                    {audit.revisions.map((revision) => (
                      <li key={revision.id}>
                        {revision.created_by_name} · {t(revision.entity_type)} ·{' '}
                        {t('revision')} {revision.revision_number}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          ) : (
            <Card title={t('Year not started')}>
              <p>
                {t(
                  'Save the appointment, report and opinion details first. Queries, objections and checks follow.',
                )}
              </p>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
