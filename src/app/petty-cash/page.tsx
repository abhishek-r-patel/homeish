// Petty cash for its custodian, admins and committee: book amount, counts and custody history.
import Link from 'next/link';
import { Card, StatTile } from '@/components/ui/data-display';
import { LanguageProvider } from '@/components/language-provider';
import { CashCountForm } from '@/components/expense/reconciliation-controls';
import { getPettyCash } from '@/core/expense/operations';
import { cashDifferenceKind } from '@/core/expense/validation';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { createRequestId } from '@/core/errors';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Petty cash | Homeish',
  robots: { index: false, follow: false },
};

export default async function PettyCashPage() {
  const context = await buildRequestContext(createRequestId());
  const view = await getPettyCash();
  const locale = context.languagePreference;
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const formatDate = (value: string) =>
    formatLocalizedDate(
      new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
      locale,
      { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
    );
  const formatSigned = (paise: number) =>
    `${paise < 0 ? '-' : ''}${formatLocalizedCurrency(Math.abs(paise), locale)}`;
  const difference = (paise: number) => {
    const amount = formatLocalizedCurrency(Math.abs(paise), locale);
    const kind = cashDifferenceKind(paise);
    if (kind === 'matches') return t('Matches the book');
    return kind === 'short'
      ? t('{amount} short', { amount })
      : t('{amount} over', { amount });
  };
  const staffView =
    context.roles.includes('admin') || context.roles.includes('committee');

  return (
    <LanguageProvider
      hindiEnabled={context.isHindiEnabled}
      initialLocale={context.languagePreference}
      mode="account"
    >
      <main className="mx-auto grid min-h-dvh max-w-content-default min-w-0 content-start gap-space-5 px-space-4 py-space-6 [overflow-wrap:anywhere]">
        <Link
          href={staffView ? '/admin/expenses' : '/'}
          className="text-brand underline"
        >
          {staffView ? t('Back to accounts') : t('Back to home')}
        </Link>
        <h1 className="text-title font-semibold">{t('Petty cash')}</h1>
        <p>
          {t(
            'Counts are compared with the book. Differences are shown, never posted.',
          )}
        </p>
        {!view.account ? (
          <Card title={t('Petty cash is not set up')}>
            <p>
              {t(
                'An administrator marks the cash account as petty cash and names a custodian in accounts setup.',
              )}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid min-w-0 gap-space-3 medium:grid-cols-2">
              <StatTile
                label={t('Book amount today')}
                value={formatSigned(view.book_paise ?? 0)}
                context={view.account.name}
              />
              <StatTile
                label={t('Custodian')}
                value={view.custodian?.full_name ?? t('Not named')}
              />
            </div>
            {view.can_record ? (
              <Card title={t('Record a count')}>
                <CashCountForm
                  today={view.today}
                  openingOn={view.account.opening_on}
                />
              </Card>
            ) : null}
            <Card title={t('Cash counts')}>
              {view.counts.length ? (
                <ul className="grid min-w-0 gap-space-3">
                  {view.counts.map((count) => (
                    <li
                      key={count.id}
                      className="grid min-w-0 gap-space-1 rounded-md border border-rule p-space-3"
                    >
                      <p className="flex flex-wrap justify-between gap-space-2 text-body-strong">
                        <span>
                          {formatDate(count.count_date)}
                          {count.kind === 'handover'
                            ? ` · ${t('Handover')}`
                            : ''}
                        </span>
                        <span>{difference(count.difference_paise)}</span>
                      </p>
                      <p>
                        {t('Counted {counted} · Book {book}', {
                          counted: formatLocalizedCurrency(
                            count.counted_paise,
                            locale,
                          ),
                          book: formatSigned(count.book_paise),
                        })}
                      </p>
                      {count.note ? <p>{count.note}</p> : null}
                      <p className="text-caption text-ink-muted">
                        {t('Counted by {name}', {
                          name: count.counted_by_name,
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No counts recorded yet.')}</p>
              )}
            </Card>
            <Card title={t('Custodian history')}>
              {view.history.length ? (
                <ul className="grid min-w-0 gap-space-2">
                  {view.history.map((row) => (
                    <li key={row.id}>
                      {row.full_name} · {formatDate(row.started_at)}
                      {' – '}
                      {row.ended_at ? formatDate(row.ended_at) : t('Current')}
                      {row.handover_counted_paise !== null &&
                      row.handover_book_paise !== null
                        ? ` · ${t('Handover {difference}', {
                            difference: difference(
                              row.handover_counted_paise -
                                row.handover_book_paise,
                            ),
                          })}`
                        : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No custodian named yet.')}</p>
              )}
            </Card>
          </>
        )}
      </main>
    </LanguageProvider>
  );
}
