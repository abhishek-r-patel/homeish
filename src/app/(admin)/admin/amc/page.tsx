// Show administrator AMC management and committee read-only contract history.
import { Card, StatusChip } from '@/components/ui/data-display';
import {
  AmcContractForm,
  AmcExpirySettingsForm,
  AmcScheduleForm,
  AmcVisitForm,
} from '@/components/amc/controls';
import { getAssetFormOptions } from '@/core/asset/operations';
import { AppError } from '@/core/errors';
import { getAmcWorkspace, filterAmcContracts } from '@/core/amc/operations';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
export const metadata = {
  title: 'AMC | Homeish',
  robots: { index: false, follow: false },
};
export default async function AmcPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vendor?: string; asset?: string }>;
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
  const w = await getAmcWorkspace();
  const contracts = filterAmcContracts(w.contracts, search);
  let categories: { id: string; name: string; active: boolean }[] = [];
  if (w.can_manage) {
    try {
      categories = (await getAssetFormOptions()).categories;
    } catch (error) {
      // Asset types are optional for the schedule; keep the page usable when assets are off.
      if (!(error instanceof AppError)) throw error;
    }
  }
  const amcTypeLabel = (value: (typeof contracts)[number]['amc_type']) =>
    value === 'comprehensive'
      ? t('Comprehensive')
      : value === 'non_comprehensive'
        ? t('Non-comprehensive')
        : t('Not set');
  const query = new URLSearchParams(
    Object.entries(search).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('AMC contracts')}</h1>
      <Card title={t('AMC expiry windows')}>
        {w.can_manage ? (
          <AmcExpirySettingsForm settings={w.settings} />
        ) : (
          <div className="grid gap-space-2">
            <p>
              {t('Due Soon: {days} days', {
                days: w.settings.due_soon_days,
              })}
            </p>
            <p>
              {t('Urgent: {days} days', {
                days: w.settings.urgent_days,
              })}
            </p>
          </div>
        )}
      </Card>
      {!w.can_manage ? (
        <p>{t('Read-only committee access.')}</p>
      ) : (
        <Card title={t('Add contract')}>
          <AmcContractForm today={w.today} />
        </Card>
      )}
      <Card title={t('Filter and export')}>
        <form method="get" className="grid min-w-0 gap-space-3">
          <label htmlFor="amc-status">{t('Status')}</label>
          <select
            id="amc-status"
            name="status"
            defaultValue={search.status ?? ''}
            className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
          >
            <option value="">{t('All statuses')}</option>
            <option value="upcoming">{t('Upcoming')}</option>
            <option value="active">{t('Active')}</option>
            <option value="due_soon">{t('Due Soon')}</option>
            <option value="urgent">{t('Urgent')}</option>
            <option value="expired">{t('Expired')}</option>
          </select>
          <label htmlFor="amc-asset">{t('Asset')}</label>
          <input
            id="amc-asset"
            name="asset"
            defaultValue={search.asset}
            className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
          />
          <label htmlFor="amc-vendor">{t('Vendor')}</label>
          <input
            id="amc-vendor"
            name="vendor"
            defaultValue={search.vendor}
            className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
          />
          <button
            type="submit"
            className="min-h-12 rounded-md border border-rule"
          >
            {t('Show contracts')}
          </button>
        </form>
        <div className="mt-space-3 flex flex-wrap gap-space-3">
          {['contracts', 'visits'].map((type) => (
            <a
              key={type}
              className="text-brand underline"
              href={`/api/amc/export?${query}&type=${type}`}
            >
              {t('Download {type} CSV', {
                type: t(type === 'contracts' ? 'contracts' : 'visits'),
              })}
            </a>
          ))}
        </div>
      </Card>
      {contracts.length ? (
        contracts.map((c) => (
          <Card key={c.id} title={c.asset_label}>
            <div className="grid min-w-0 gap-space-3">
              <StatusChip status={`amc.${c.status}`} />
              <p>
                {c.vendor_name} · {c.vendor_contact}
              </p>
              <p>
                {formatDate(c.start_date)} {t('to')} {formatDate(c.end_date)} ·{' '}
                {formatLocalizedCurrency(c.cost_paise, locale)}
              </p>
              <p>
                {t('Payment terms:')} {c.payment_terms || t('Not specified')} ·{' '}
                {t('Visits:')} {c.visit_frequency}
              </p>
              <p>
                {t('AMC type:')} {amcTypeLabel(c.amc_type)} · {t('Asset type:')}{' '}
                {c.asset_category_name ?? t('Not set')} ·{' '}
                {t('Services per year:')} {c.services_per_year ?? t('Not set')}
              </p>
              <div className="flex flex-wrap items-center gap-space-2">
                <p>
                  {t('Last visit:')}{' '}
                  {c.last_visit_date
                    ? formatDate(c.last_visit_date)
                    : t('None yet')}{' '}
                  · {t('Next service:')}{' '}
                  {c.next_service_date
                    ? formatDate(c.next_service_date)
                    : t('Unscheduled')}
                </p>
                {c.service_overdue ? (
                  <StatusChip status="amc.service_overdue" />
                ) : null}
              </div>
              {c.predecessor_id ? (
                <p>
                  {t('Renewal of contract')} {c.predecessor_id}
                </p>
              ) : null}
              {c.successor_id ? (
                <p>
                  {t('A successor contract preserves this contract history.')}
                </p>
              ) : null}
              {c.documentUrl ? (
                <a
                  href={c.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  {t('View private contract document')}
                </a>
              ) : null}
              {w.can_manage ? (
                <details>
                  <summary className="cursor-pointer">
                    {t('Edit contract')}
                  </summary>
                  <AmcContractForm
                    key={c.updated_at}
                    contract={c}
                    today={w.today}
                  />
                </details>
              ) : null}
              {w.can_manage ? (
                <details>
                  <summary className="cursor-pointer">
                    {t('Edit service schedule')}
                  </summary>
                  <AmcScheduleForm
                    key={c.updated_at}
                    contract={c}
                    categories={categories}
                  />
                </details>
              ) : null}
              {w.can_manage && !c.successor_id ? (
                <details>
                  <summary className="cursor-pointer">
                    {t('Renew contract')}
                  </summary>
                  <AmcContractForm contract={c} renew today={w.today} />
                </details>
              ) : null}
              <h2 className="text-body-strong">{t('Service visits')}</h2>
              {w.visits
                .filter((v) => v.contract_id === c.id)
                .map((v) => (
                  <div
                    key={v.id}
                    className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
                  >
                    <p>
                      {formatDate(v.visit_date)} · {v.technician}
                    </p>
                    <p className="break-words">{v.summary}</p>
                    {v.documentUrl ? (
                      <a
                        href={v.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline"
                      >
                        {t('View private visit report')}
                      </a>
                    ) : null}
                    {w.can_manage ? (
                      <details>
                        <summary className="cursor-pointer">
                          {t('Correct visit')}
                        </summary>
                        <AmcVisitForm
                          key={v.updated_at}
                          contractId={c.id}
                          visit={v}
                          today={w.today}
                        />
                      </details>
                    ) : null}
                  </div>
                ))}
              {w.can_manage ? (
                <details>
                  <summary className="cursor-pointer">
                    {t('Record service visit')}
                  </summary>
                  <AmcVisitForm contractId={c.id} today={w.today} />
                </details>
              ) : null}
            </div>
          </Card>
        ))
      ) : (
        <p>{t('No contracts match these filters.')}</p>
      )}
    </section>
  );
}
