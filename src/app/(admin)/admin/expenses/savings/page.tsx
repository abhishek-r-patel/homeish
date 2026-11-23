// List P42 savings initiatives and their evidence without changing the books.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, StatTile } from '@/components/ui/data-display';
import { ExpenseNav } from '@/components/expense/nav';
import {
  ExpenseSavingsEvidenceForm,
  ExpenseSavingsEvidenceVoidForm,
  ExpenseSavingsForm,
  ExpenseSavingsStatusForm,
} from '@/components/expense/savings-controls';
import {
  getExpenseSavings,
  getExpenseWorkspace,
  listExpenseSavings,
} from '@/core/expense/operations';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Savings | Homeish',
  robots: { index: false, follow: false },
};

const KIND_LABELS = {
  renegotiation: 'Renegotiation',
  energy_saving: 'Energy saving',
  reduced_consumption: 'Reduced consumption',
  vendor_change: 'Vendor change',
  process_change: 'Process change',
  other: 'Other',
} as const;
const STATUS_LABELS = {
  idea: 'Idea',
  approved: 'Approved',
  implementing: 'Implementing',
  realised: 'Realised',
  dropped: 'Dropped',
} as const;

export default async function ExpenseSavingsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const [{ id }, workspace, list] = await Promise.all([
    searchParams,
    getExpenseWorkspace(),
    listExpenseSavings(),
  ]);
  const selected = id ? await getExpenseSavings(id) : null;
  if (id && selected?.id !== id) notFound();
  const formatDate = (value: string) =>
    formatLocalizedDate(
      new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
      locale,
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      },
    );
  const totalExpected = list.initiatives
    .filter((initiative) => initiative.status !== 'dropped')
    .reduce((total, initiative) => total + initiative.expected_annual_paise, 0);
  const totalRealised = list.initiatives.reduce(
    (total, initiative) => total + initiative.realised_to_date_paise,
    0,
  );
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Savings')}</h1>
      <ExpenseNav
        current="savings"
        canManage={workspace.can_manage}
        locale={locale}
      />
      <p className="text-caption text-ink-muted">
        {t(
          'Expected savings and tracker statuses are estimates. Only evidenced realised amounts count in Realised to date. Neither changes the books, budgets or contracts.',
        )}
      </p>
      <div className="grid gap-space-3 medium:grid-cols-2">
        <StatTile
          label={t('Expected annual savings')}
          value={formatLocalizedCurrency(totalExpected, locale)}
        />
        <StatTile
          label={t('Realised to date')}
          value={formatLocalizedCurrency(totalRealised, locale)}
        />
      </div>

      <div className="grid min-w-0 gap-space-5 wide:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card title={t('Initiatives')}>
          {list.initiatives.length ? (
            <ul className="grid gap-space-2">
              {list.initiatives.map((initiative) => (
                <li
                  key={initiative.id}
                  className={`rounded-md border p-space-3 ${
                    initiative.id === selected?.id
                      ? 'border-brand bg-surface-muted'
                      : 'border-rule'
                  }`}
                >
                  <Link
                    className="grid gap-space-1 text-brand underline"
                    href={`/admin/expenses/savings?id=${initiative.id}`}
                  >
                    <span className="font-semibold">{initiative.title}</span>
                    <span className="text-caption text-ink-muted">
                      {t(STATUS_LABELS[initiative.status])} ·{' '}
                      {t(KIND_LABELS[initiative.kind])}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {t('Expected')}{' '}
                      {formatLocalizedCurrency(
                        initiative.expected_annual_paise,
                        locale,
                      )}
                      {' · '}
                      {t('Realised')}{' '}
                      {formatLocalizedCurrency(
                        initiative.realised_to_date_paise,
                        locale,
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('No savings initiatives have been added.')}</p>
          )}
          {list.can_manage ? (
            <details className="mt-space-4 rounded-md border border-rule p-space-3">
              <summary className="cursor-pointer">
                {t('Add initiative')}
              </summary>
              <ExpenseSavingsForm workspace={list} />
            </details>
          ) : null}
        </Card>

        {selected ? (
          <div className="grid min-w-0 gap-space-5">
            <Card title={selected.title}>
              <dl className="grid gap-space-2 medium:grid-cols-2">
                <div>
                  <dt className="text-caption text-ink-muted">{t('Status')}</dt>
                  <dd>{t(STATUS_LABELS[selected.status])}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Saving type')}
                  </dt>
                  <dd>{t(KIND_LABELS[selected.kind])}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">{t('Owner')}</dt>
                  <dd>
                    {selected.owner_name ?? t('Not set')}
                    {selected.owner_user_id && !selected.owner_is_current
                      ? ` (${t('no longer an admin or committee member')})`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Category / vendor')}
                  </dt>
                  <dd>
                    {selected.category_name ?? t('No category')}
                    {' / '}
                    {selected.vendor_name ?? t('No vendor')}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Baseline annual cost')}
                  </dt>
                  <dd>
                    {formatLocalizedCurrency(
                      selected.baseline_annual_paise,
                      locale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">
                    {t('Expected / realised')}
                  </dt>
                  <dd>
                    {formatLocalizedCurrency(
                      selected.expected_annual_paise,
                      locale,
                    )}
                    {' / '}
                    {formatLocalizedCurrency(
                      selected.realised_to_date_paise,
                      locale,
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-space-3 whitespace-pre-wrap">
                {selected.description}
              </p>
              {list.can_manage ? (
                <details className="mt-space-4 rounded-md border border-rule p-space-3">
                  <summary className="cursor-pointer">
                    {t('Edit initiative')}
                  </summary>
                  <ExpenseSavingsForm workspace={list} initiative={selected} />
                </details>
              ) : null}
            </Card>

            {list.can_manage ? (
              <Card title={t('Status')}>
                <ExpenseSavingsStatusForm initiative={selected} />
              </Card>
            ) : null}

            <Card title={t('Evidence')}>
              <p className="mb-space-3 text-caption text-ink-muted">
                {t(
                  'Wrong evidence is voided with a reason, never deleted. The total above includes only records that are not voided.',
                )}
              </p>
              {selected.evidence.length ? (
                <ul className="grid gap-space-3">
                  {selected.evidence.map((evidence) => (
                    <li
                      key={evidence.id}
                      className="rounded-md border border-rule p-space-3"
                    >
                      <p className="font-semibold">
                        {formatLocalizedCurrency(evidence.amount_paise, locale)}{' '}
                        · {formatDate(evidence.evidenced_on)}
                        {evidence.voided_at ? ` · ${t('Voided')}` : ''}
                      </p>
                      <p className="whitespace-pre-wrap">{evidence.note}</p>
                      {evidence.source_label ? (
                        <p className="text-caption text-ink-muted">
                          {t('Source')}: {evidence.source_label}
                        </p>
                      ) : null}
                      <p className="mt-space-2 text-caption text-ink-muted">
                        {t('Recorded by {name} on {date}', {
                          name: evidence.created_by_name,
                          date: formatDate(evidence.created_at),
                        })}
                      </p>
                      {evidence.fileUrl ? (
                        <a
                          className="text-brand underline"
                          href={evidence.fileUrl}
                        >
                          {t('Open private evidence')}
                        </a>
                      ) : null}
                      {evidence.voided_at ? (
                        <p className="text-caption text-ink-muted">
                          {t('Void reason')}: {evidence.void_reason}
                        </p>
                      ) : list.can_manage ? (
                        <details className="mt-space-2">
                          <summary className="cursor-pointer">
                            {t('Void evidence')}
                          </summary>
                          <ExpenseSavingsEvidenceVoidForm
                            evidenceId={evidence.id}
                          />
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No evidence has been added.')}</p>
              )}
              {list.can_manage ? (
                <details className="mt-space-4 rounded-md border border-rule p-space-3">
                  <summary className="cursor-pointer">
                    {t('Add evidence')}
                  </summary>
                  <ExpenseSavingsEvidenceForm
                    initiative={selected}
                    workspace={list}
                    today={workspace.today}
                  />
                </details>
              ) : null}
            </Card>

            <Card title={t('Status history')}>
              {selected.status_events.length ? (
                <ul className="grid gap-space-2">
                  {selected.status_events.map((event) => (
                    <li key={event.id}>
                      {t('{from} to {to} by {name} on {date}', {
                        from: t(STATUS_LABELS[event.from_status]),
                        to: t(STATUS_LABELS[event.to_status]),
                        name: event.created_by_name,
                        date: formatDate(event.created_at),
                      })}
                      {event.reason ? ` — ${event.reason}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No status changes yet.')}</p>
              )}
            </Card>
          </div>
        ) : (
          <Card title={t('Select an initiative')}>
            <p>
              {t(
                'Choose an initiative to see its evidence and status history, or add one if you are an admin.',
              )}
            </p>
          </Card>
        )}
      </div>
    </section>
  );
}
