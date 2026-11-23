// Show P50.2 quote spread, criteria and privacy-safe private scoring.
import Link from 'next/link';
import { Banner } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import { formatLocalizedCurrency } from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { getMajorWorksScoring } from '@/core/major-works/operations';
import {
  MajorWorksChosenQuoteForm,
  MajorWorksQuoteForm,
  MajorWorksQuoteRemoveForm,
} from '@/components/major-works/quote-forms';
import {
  MajorWorksCriteriaForm,
  MajorWorksScoresForm,
  MajorWorksScoringTransitionForm,
} from '@/components/major-works/scoring-forms';

export const metadata = {
  title: 'Quotes and scoring | Major works | Homeish',
  robots: { index: false, follow: false },
};

export default async function MajorWorksScoringPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const { projectId } = await params;
  const data = await getMajorWorksScoring(projectId);
  const liveQuotes = data.quotes.filter((quote) => !quote.removed_at);
  const included = liveQuotes.filter((quote) => !quote.excluded_at);
  const lowest = included.length
    ? Math.min(...included.map((quote) => quote.amount_paise))
    : null;
  const highest = included.length
    ? Math.max(...included.map((quote) => quote.amount_paise))
    : null;
  const money = (amount: number) =>
    formatLocalizedCurrency(BigInt(amount), locale);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <Link
          className="text-caption text-brand underline"
          href="/admin/major-works"
        >
          {t('Back to major works')}
        </Link>
        <h1 className="text-title font-semibold">{t('Quotes and scoring')}</h1>
        <p className="text-ink-muted">
          {t(
            'Compare quotes and record private committee scores. Homeish never recommends or ranks a winner.',
          )}
        </p>
      </header>
      <Banner title={t('Decision remains with the society')} tone="warning">
        {t(
          'A weighted average and quote spread are factual aids only. The chosen quote and reason are recorded separately.',
        )}
      </Banner>
      <div className="grid gap-space-3 medium:grid-cols-2">
        <Card title={t('Lowest quote')}>
          <p>{lowest === null ? t('No included quote') : money(lowest)}</p>
        </Card>
        <Card title={t('Highest quote')}>
          <p>{highest === null ? t('No included quote') : money(highest)}</p>
        </Card>
      </div>
      <Card
        title={t('Quotes')}
        description={t('At most three live quotes are kept per project.')}
      >
        {liveQuotes.length ? (
          <div className="grid gap-space-3">
            {liveQuotes.map((quote) => (
              <div
                className="grid gap-space-3 rounded-md border border-rule p-space-3"
                key={quote.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-space-2">
                  <div>
                    <h2 className="font-semibold">{quote.vendor_name}</h2>
                    <p className="text-caption text-ink-muted">
                      {quote.source === 'vendor_quote'
                        ? t('Vendor purchase-request quote')
                        : t('Typed quote')}
                      {quote.like_for_like
                        ? ` · ${t('Like-for-like scope')}`
                        : ''}
                      {quote.excluded_at ? ` · ${t('Excluded')}` : ''}
                    </p>
                  </div>
                  <strong>{money(quote.amount_paise)}</strong>
                </div>
                <p>{quote.scope_note}</p>
                {lowest !== null ? (
                  <p className="text-caption text-ink-muted">
                    {t('{percent}% above the lowest quote', {
                      percent:
                        Math.round(
                          ((quote.amount_paise - lowest) / lowest) * 1000,
                        ) / 10,
                    })}
                  </p>
                ) : null}
                {data.scoring_state === 'closed' ? (
                  <p className="text-caption">
                    {t(
                      'Weighted average: {average}/10 from {count} scorer(s)',
                      {
                        average: quote.weighted_average ?? 0,
                        count: quote.scorer_count ?? 0,
                      },
                    )}
                  </p>
                ) : null}
                {quote.file_url ? (
                  <a className="text-brand underline" href={quote.file_url}>
                    {t('Open private quote file')}
                  </a>
                ) : null}
                {quote.exclusion_reason ? (
                  <p className="text-caption text-ink-muted">
                    {t('Excluded: {reason}', {
                      reason: quote.exclusion_reason,
                    })}
                  </p>
                ) : null}
                {data.can_manage && data.scoring_state === 'setup' ? (
                  <details>
                    <summary className="cursor-pointer">
                      {t('Change quote availability')}
                    </summary>
                    <div className="mt-space-3 grid gap-space-4 medium:grid-cols-2">
                      <MajorWorksQuoteRemoveForm exclude quote={quote} />
                      <MajorWorksQuoteRemoveForm
                        exclude={false}
                        quote={quote}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p>{t('No quotes have been added.')}</p>
        )}
        {data.can_manage && data.scoring_state === 'setup' ? (
          <details className="mt-space-4 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">{t('Add quote')}</summary>
            <div className="mt-space-3">
              <MajorWorksQuoteForm
                projectId={projectId}
                vendorQuotes={data.vendor_quotes}
              />
            </div>
          </details>
        ) : null}
      </Card>
      <Card
        title={t('Scoring criteria')}
        description={t('Use 2 to 8 criteria with weights totalling 100%.')}
      >
        {data.criteria.length ? (
          <ul className="grid gap-space-2">
            {data.criteria.map((criterion) => (
              <li key={criterion.id}>
                {criterion.name} — {criterion.weight}%
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No criteria have been set.')}</p>
        )}
        {data.can_manage && data.scoring_state === 'setup' ? (
          <div className="mt-space-4">
            <MajorWorksCriteriaForm data={data} />
          </div>
        ) : null}
      </Card>
      {data.scoring_state === 'open' ? (
        <Card
          title={t('My private scores')}
          description={t(
            'Only you can see your scores while scoring is open. Other members see only their own scores.',
          )}
        >
          <MajorWorksScoresForm data={data} />
        </Card>
      ) : null}
      {data.can_manage ? (
        <Card title={t('Scoring state')}>
          <MajorWorksScoringTransitionForm data={data} />
          {data.scoring_state === 'closed' ? (
            <div className="mt-space-4">
              <MajorWorksChosenQuoteForm data={data} />
            </div>
          ) : null}
          {data.scoring_state === 'not_scored' ? (
            <p className="mt-space-3 text-ink-muted">
              {t('Not scored: {reason}', {
                reason: data.not_scored_reason ?? t('Reason not recorded'),
              })}
            </p>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
