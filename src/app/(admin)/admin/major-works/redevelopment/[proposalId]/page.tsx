// Show P50.5 per-unit consent and redevelopment milestones.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banner } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import {
  MajorWorksConsentMethodForm,
  MajorWorksConsentPollForm,
  MajorWorksConsentRecordForm,
  MajorWorksMilestoneForm,
} from '@/components/major-works/consent-forms';
import {
  getMajorWorksConsents,
  listMajorWorksMilestones,
  listMajorWorksProposals,
} from '@/core/major-works/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { formatLocalizedDate } from '@/core/i18n/format';

export const metadata = {
  title: 'Consent and milestones | Major works | Homeish',
  robots: { index: false, follow: false },
};

export default async function MajorWorksProposalPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const { proposalId } = await params;
  const [proposals, consent, milestones] = await Promise.all([
    listMajorWorksProposals(),
    getMajorWorksConsents(proposalId),
    listMajorWorksMilestones(proposalId),
  ]);
  const proposal = proposals.proposals.find((item) => item.id === proposalId);
  if (!proposal) notFound();
  const eligible = consent.records.length;
  const counts = {
    pending: consent.records.filter((record) => record.status === 'pending')
      .length,
    consents: consent.records.filter((record) => record.status === 'consents')
      .length,
    does_not_consent: consent.records.filter(
      (record) => record.status === 'does_not_consent',
    ).length,
  };
  const percent = (count: number) =>
    eligible ? Math.round((count / eligible) * 1000) / 10 : 0;
  const date = (value: string | null) =>
    value
      ? formatLocalizedDate(new Date(`${value}T00:00:00.000Z`), locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : t('Not set');
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <Link
          className="text-brand underline"
          href="/admin/major-works/redevelopment"
        >
          {t('Back to redevelopment')}
        </Link>
        <h1 className="text-title font-semibold">{proposal.developer_name}</h1>
        <p className="text-ink-muted">
          {t('Owner-unit consent and the proposal milestone checklist.')}
        </p>
      </header>
      <Banner title={t('No statutory threshold claim')} tone="warning">
        {t(
          'The counts are eligible-unit records only. Homeish does not state whether any legal or statutory threshold is met.',
        )}
      </Banner>
      <Card
        title={t('Consent method')}
        description={t('Current method: {method}', {
          method:
            consent.method === 'poll'
              ? t('Poll answer counts as consent')
              : t('Admin-recorded consent only'),
        })}
      >
        {proposals.can_manage ? (
          <MajorWorksConsentMethodForm data={consent} />
        ) : null}
      </Card>
      <div className="grid gap-space-3 medium:grid-cols-3">
        <Card title={t('Pending')}>
          <p>{counts.pending}</p>
          <p className="text-caption text-ink-muted">
            {percent(counts.pending)}%
          </p>
        </Card>
        <Card title={t('Consents')}>
          <p>{counts.consents}</p>
          <p className="text-caption text-ink-muted">
            {percent(counts.consents)}%
          </p>
        </Card>
        <Card title={t('Does not consent')}>
          <p>{counts.does_not_consent}</p>
          <p className="text-caption text-ink-muted">
            {percent(counts.does_not_consent)}%
          </p>
        </Card>
      </div>
      {consent.poll_id ? (
        <Banner title={t('Consent poll exists')} tone="info">
          <Link
            className="text-brand underline"
            href={`/admin/polls/${consent.poll_id}/edit`}
          >
            {consent.poll_applied_at
              ? t('Open completed consent poll')
              : t('Schedule the draft consent poll')}
          </Link>
        </Banner>
      ) : proposals.can_manage && consent.method === 'poll' ? (
        <Card title={t('Create consent poll')}>
          <MajorWorksConsentPollForm data={consent} proposalId={proposalId} />
        </Card>
      ) : null}
      {consent.indicative_poll_answers.length ? (
        <Banner title={t('Indicative only')} tone="info">
          {t(
            'The poll answers below did not change admin-recorded consent records.',
          )}
        </Banner>
      ) : null}
      <Card title={t('Owner-unit consent records')}>
        {consent.records.length ? (
          <div className="grid gap-space-3">
            {consent.records.map((record) => {
              const indicative = consent.indicative_poll_answers.find(
                (answer) => answer.unit_id === record.unit_id,
              );
              return (
                <div
                  className="grid gap-space-3 rounded-md border border-rule p-space-3"
                  key={record.unit_id}
                >
                  <div className="flex flex-wrap justify-between gap-space-2">
                    <strong>{record.unit_number}</strong>
                    <span>
                      {record.status === 'consents'
                        ? t('Consents')
                        : record.status === 'does_not_consent'
                          ? t('Does not consent')
                          : t('Pending')}
                    </span>
                  </div>
                  <p className="text-caption text-ink-muted">
                    {record.method
                      ? t('Method: {method}, recorded {date}', {
                          method:
                            record.method === 'poll'
                              ? t('Poll')
                              : t('Admin record'),
                          date: date(record.recorded_on),
                        })
                      : t('No response recorded')}
                  </p>
                  {indicative ? (
                    <p className="text-caption text-ink-muted">
                      {t('Indicative poll answer: {answer}', {
                        answer: indicative.label,
                      })}
                    </p>
                  ) : null}
                  {record.signed_form_url ? (
                    <a
                      className="text-brand underline"
                      href={record.signed_form_url}
                    >
                      {t('Open private signed form')}
                    </a>
                  ) : null}
                  {proposals.can_manage ? (
                    <details>
                      <summary className="cursor-pointer">
                        {t('Record admin consent')}
                      </summary>
                      <div className="mt-space-3">
                        <MajorWorksConsentRecordForm
                          proposalId={proposalId}
                          record={record}
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p>{t('No eligible owner units have been found.')}</p>
        )}
      </Card>
      <Card title={t('Milestones')}>
        {milestones.milestones.length ? (
          <ol className="grid gap-space-3">
            {milestones.milestones.map((milestone) => (
              <li
                className="rounded-md border border-rule p-space-3"
                key={milestone.id}
              >
                <strong>{milestone.title}</strong>
                <p className="text-caption text-ink-muted">
                  {milestone.status === 'done'
                    ? t('Done')
                    : milestone.status === 'not_needed'
                      ? t('Not needed')
                      : t('To do')}
                  {` · ${date(milestone.planned_on)} · ${date(milestone.actual_on)}`}
                </p>
                {milestone.note ? <p>{milestone.note}</p> : null}
                {milestones.can_manage ? (
                  <details className="mt-space-2">
                    <summary className="cursor-pointer">
                      {t('Edit milestone')}
                    </summary>
                    <div className="mt-space-3">
                      <MajorWorksMilestoneForm
                        milestone={milestone}
                        proposalId={proposalId}
                      />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('No milestones have been added.')}</p>
        )}
        {milestones.can_manage ? (
          <details className="mt-space-4 rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">{t('Add milestone')}</summary>
            <div className="mt-space-3">
              <MajorWorksMilestoneForm proposalId={proposalId} />
            </div>
          </details>
        ) : null}
      </Card>
    </section>
  );
}
