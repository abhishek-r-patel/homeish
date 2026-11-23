// Show P50.4 developer offers side by side with private evidence and stages.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import {
  MajorWorksProposalFileForm,
  MajorWorksProposalForm,
  MajorWorksProposalArchiveForm,
  MajorWorksProposalStageForm,
  STAGE_LABELS,
} from '@/components/major-works/proposal-forms';
import { listMajorWorksProposals } from '@/core/major-works/operations';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Redevelopment | Major works | Homeish',
  robots: { index: false, follow: false },
};

export default async function MajorWorksRedevelopmentPage() {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const data = await listMajorWorksProposals();
  const money = (amount: number | null) =>
    amount === null
      ? t('Not stated')
      : formatLocalizedCurrency(BigInt(amount), locale);
  const date = (value: string | null) =>
    value
      ? formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : t('Not stated');
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <Link className="text-brand underline" href="/admin/major-works">
          {t('Back to major works')}
        </Link>
        <h1 className="text-title font-semibold">
          {t('Redevelopment proposals')}
        </h1>
        <p className="text-ink-muted">
          {t(
            'Compare developer-stated offers without treating them as verified or endorsed.',
          )}
        </p>
      </header>
      <Banner
        title={t('As stated by the developer - not verified by Homeish')}
        tone="warning"
      >
        {t(
          'Evidence files are private and available only to authorized admins and committee members.',
        )}
      </Banner>
      {data.proposals.length ? (
        <Card title={t('Offer comparison')}>
          <div
            aria-label={t('Redevelopment offer comparison')}
            className="max-w-full overflow-x-auto"
            role="region"
            tabIndex={0}
          >
            <table className="min-w-224 border-collapse">
              <thead>
                <tr>
                  <th className="px-space-2 py-space-2 text-left">
                    {t('Term')}
                  </th>
                  {data.proposals.map((proposal) => (
                    <th
                      className="px-space-2 py-space-2 text-left"
                      key={proposal.id}
                    >
                      {proposal.developer_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    t('Stage'),
                    (proposal: (typeof data.proposals)[number]) =>
                      t(STAGE_LABELS[proposal.stage]),
                  ],
                  [
                    t('Received date'),
                    (proposal: (typeof data.proposals)[number]) =>
                      date(proposal.received_on),
                  ],
                  [
                    t('Decision due'),
                    (proposal: (typeof data.proposals)[number]) =>
                      date(proposal.decision_due_on),
                  ],
                  [
                    t('Extra area'),
                    (proposal: (typeof data.proposals)[number]) =>
                      proposal.extra_area_bp === null
                        ? t('Not stated')
                        : `${proposal.extra_area_bp / 100}%`,
                  ],
                  [
                    t('Monthly rent per unit'),
                    (proposal: (typeof data.proposals)[number]) =>
                      money(proposal.monthly_rent_paise),
                  ],
                  [
                    t('Corpus per unit'),
                    (proposal: (typeof data.proposals)[number]) =>
                      money(proposal.corpus_paise),
                  ],
                  [
                    t('Timeline'),
                    (proposal: (typeof data.proposals)[number]) =>
                      proposal.timeline_months === null
                        ? t('Not stated')
                        : t('{months} months', {
                            months: proposal.timeline_months,
                          }),
                  ],
                  [
                    t('Bank guarantee'),
                    (proposal: (typeof data.proposals)[number]) =>
                      money(proposal.bank_guarantee_paise),
                  ],
                  [
                    t('Other terms'),
                    (proposal: (typeof data.proposals)[number]) =>
                      proposal.other_terms ?? t('Not stated'),
                  ],
                ].map(([label, read]) => (
                  <tr className="border-t border-rule" key={label as string}>
                    <th className="px-space-2 py-space-2 text-left">
                      {label as string}
                    </th>
                    {data.proposals.map((proposal) => (
                      <td
                        className="px-space-2 py-space-2 align-top"
                        key={proposal.id}
                      >
                        {(
                          read as (
                            value: (typeof data.proposals)[number],
                          ) => string
                        )(proposal)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card title={t('Redevelopment proposals')}>
          <p>{t('No redevelopment proposals have been recorded.')}</p>
        </Card>
      )}
      {data.proposals.map((proposal) => (
        <Card
          description={t(STAGE_LABELS[proposal.stage])}
          key={proposal.id}
          title={proposal.developer_name}
        >
          <div className="grid gap-space-3">
            {proposal.stage_reason ? (
              <p className="text-caption text-ink-muted">
                {proposal.stage_reason}
              </p>
            ) : null}
            {proposal.files.map((file) => (
              <a className="text-brand underline" href={file.url} key={file.id}>
                {t('Open private evidence file')}
              </a>
            ))}
            <Link
              className="text-brand underline"
              href={`/admin/major-works/redevelopment/${proposal.id}`}
            >
              {t('Consent and milestones')}
            </Link>
            {data.can_manage && !proposal.archived_at ? (
              <details className="rounded-md border border-rule p-space-3">
                <summary className="cursor-pointer">
                  {t('Manage proposal')}
                </summary>
                <div className="mt-space-3 grid gap-space-4">
                  <MajorWorksProposalForm proposal={proposal} />
                  <MajorWorksProposalStageForm proposal={proposal} />
                  <MajorWorksProposalFileForm proposal={proposal} />
                  <MajorWorksProposalArchiveForm proposal={proposal} />
                </div>
              </details>
            ) : null}
          </div>
        </Card>
      ))}
      {data.can_manage ? (
        <Card title={t('Add redevelopment proposal')}>
          <MajorWorksProposalForm />
        </Card>
      ) : null}
    </section>
  );
}
