// Show the P43.2 monthly collection report and the P43.3 admin-only dues follow-up list.
'use client';

import { useState } from 'react';
import { ReportPeriodLinks } from '@/components/analytics/report-period-links';
import {
  billingDate,
  billingMoney,
  billingPeriod,
} from '@/components/billing/presentation';
import { textLinkClass } from '@/components/billing/styles';
import { Button } from '@/components/ui/button';
import { Card, StatTile } from '@/components/ui/data-display';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { DataTable } from '@/components/ui/table-controls';
import type { ReportPeriod } from '@/core/analytics/report-period';
import {
  billingMonthlyCollectionTotals,
  type BillingDuesFollowUp,
  type BillingMonthlyCollection,
  type BillingMonthlyCollectionRow,
  type BillingDuesFollowUpRow,
} from '@/core/billing/collection-validation';
import type { Locale } from '@/core/i18n/locale';

function percent(value: number | null, locale: Locale | null) {
  if (value === null) return null;
  return `${new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function MonthlyCollectionPanel({
  canExport,
  periodHrefs,
  report,
}: {
  canExport: boolean;
  periodHrefs: Readonly<Record<ReportPeriod, string>>;
  report: BillingMonthlyCollection & { period: ReportPeriod };
}) {
  const { locale, translate: t } = useUiTranslator();
  const totals = billingMonthlyCollectionTotals(report.rows);
  const money = (paise: string) => billingMoney(paise, locale);
  return (
    <Card
      description={t(
        'Bills are grouped by bill month. Collected counts confirmed payments applied to those bills, so earlier months rise as late payments arrive.',
      )}
      title={t('Monthly collection')}
    >
      <div className="grid gap-space-4">
        <ReportPeriodLinks current={report.period} hrefs={periodHrefs} />
        <div className="grid gap-space-3 medium:grid-cols-3">
          <StatTile
            context={t('{amount} waived', {
              amount: money(totals.waived_paise),
            })}
            label={t('Net billed')}
            value={money(totals.net_billed_paise)}
          />
          <StatTile
            context={t('Confirmed payments applied to these bills')}
            label={t('Collected')}
            value={money(totals.collected_paise)}
          />
          <StatTile
            context={t('Collected ÷ net billed')}
            label={t('Collected %')}
            value={
              percent(totals.collection_percent, locale) ?? t('Not available')
            }
          />
        </div>
        <DataTable<BillingMonthlyCollectionRow>
          caption={t('Monthly collection')}
          columns={[
            {
              id: 'month',
              header: t('Bill month'),
              render: (row) => billingPeriod(row.month, locale),
            },
            {
              id: 'billed',
              header: t('Billed'),
              align: 'right',
              render: (row) => money(row.billed_paise),
            },
            {
              id: 'waived',
              header: t('Waived'),
              align: 'right',
              render: (row) => money(row.waived_paise),
            },
            {
              id: 'net',
              header: t('Net billed'),
              align: 'right',
              render: (row) => money(row.net_billed_paise),
            },
            {
              id: 'collected',
              header: t('Collected'),
              align: 'right',
              render: (row) => money(row.collected_paise),
            },
            {
              id: 'percent',
              header: t('Collected %'),
              align: 'right',
              render: (row) => percent(row.collection_percent, locale) ?? '—',
            },
          ]}
          getRowId={(row) => row.month}
          getRowLabel={(row) => billingPeriod(row.month, locale)}
          mobilePrimary={(row) => billingPeriod(row.month, locale)}
          mobileSecondary={(row) =>
            t('{collected} of {billed} · {percent}', {
              collected: money(row.collected_paise),
              billed: money(row.net_billed_paise),
              percent: percent(row.collection_percent, locale) ?? '—',
            })
          }
          rows={report.rows}
        />
        {canExport ? (
          <p className="text-body">
            <a
              className={textLinkClass}
              download
              href={`/api/billing/monthly-collection?period=${report.period}`}
            >
              {t('Download monthly collection CSV')}
            </a>{' '}
            <span className="text-caption text-ink-muted">
              {t('Exports are recorded in the audit log.')}
            </span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export function DuesFollowUpPanel({ report }: { report: BillingDuesFollowUp }) {
  const { locale, translate: t } = useUiTranslator();
  const [confirming, setConfirming] = useState(false);
  const money = (paise: string) => billingMoney(paise, locale);
  return (
    <div className="grid gap-space-5">
      <Banner tone="info">
        {t(
          'Purpose: dues follow-up by the admin. Contact details are shown only to administrators and every view and download is recorded in the audit log. Nothing is sent from this page.',
        )}
      </Banner>
      {report.rows.length === 0 ? (
        <Card title={t('Dues follow-up')}>
          <EmptyState
            description={t('Every unit is fully paid as of {date}.', {
              date: billingDate(report.today, locale),
            })}
            title={t('No unpaid dues')}
          />
        </Card>
      ) : (
        <Card
          description={t(
            '{count} units with unpaid dues as of {date}, largest first.',
            {
              count: report.rows.length,
              date: billingDate(report.today, locale),
            },
          )}
          title={t('Dues follow-up')}
        >
          <div className="grid gap-space-4">
            <DataTable<BillingDuesFollowUpRow>
              caption={t('Dues follow-up')}
              columns={[
                {
                  id: 'unit',
                  header: t('Unit'),
                  render: (row) => row.unit_number,
                },
                {
                  id: 'person',
                  header: t('Contact'),
                  render: (row) => <FollowUpContact row={row} />,
                },
                {
                  id: 'outstanding',
                  header: t('Outstanding'),
                  align: 'right',
                  render: (row) => money(row.outstanding_paise),
                },
                {
                  id: 'oldest',
                  header: t('Oldest due'),
                  render: (row) => (
                    <>
                      {billingDate(row.oldest_due_date, locale)}
                      <br />
                      <span className="text-caption text-ink-muted">
                        {t(
                          row.months_overdue === 1
                            ? '{count} month overdue'
                            : '{count} months overdue',
                          { count: row.months_overdue },
                        )}
                      </span>
                    </>
                  ),
                },
                {
                  id: 'last-payment',
                  header: t('Last payment'),
                  render: (row) => <LastPayment row={row} />,
                },
              ]}
              getRowHref={(row) => `/admin/billing/units/${row.unit_id}`}
              getRowId={(row) => row.unit_id}
              getRowLabel={(row) => row.unit_number}
              mobilePrimary={(row) =>
                `${row.unit_number} · ${money(row.outstanding_paise)}`
              }
              mobileSecondary={(row) => (
                <>
                  <FollowUpContact links={false} row={row} />
                  <LastPayment row={row} />
                </>
              )}
              rows={report.rows}
              scrollable
            />
            <div>
              <Button onClick={() => setConfirming(true)} variant="secondary">
                {t('Download follow-up list CSV')}
              </Button>
            </div>
          </div>
        </Card>
      )}
      <ConfirmDialog
        actionLabel={t('Download CSV')}
        description={t(
          'The file contains names, phone numbers and email addresses. Keep it private, use it only to follow up dues and delete it when you are done. The download is recorded in the audit log.',
        )}
        id="dues-follow-up-export"
        onConfirm={() => {
          setConfirming(false);
          window.location.assign('/api/billing/dues-follow-up');
        }}
        onOpenChange={setConfirming}
        open={confirming}
        title={t('Download contact details?')}
        variant="primary"
      />
    </div>
  );
}

// Inside the mobile row the whole row is already a link, so contact details stay plain text there.
function FollowUpContact({
  links = true,
  row,
}: {
  links?: boolean;
  row: BillingDuesFollowUpRow;
}) {
  const { translate: t } = useUiTranslator();
  if (!row.name) {
    return (
      <span className="text-ink-muted">{t('No active owner or tenant')}</span>
    );
  }
  return (
    <span className="grid">
      <span className="text-body-strong">
        {row.name}{' '}
        <span className="text-caption text-ink-muted">
          ({t(row.relationship === 'tenant' ? 'Tenant' : 'Owner')})
        </span>
      </span>
      {row.phone ? (
        links ? (
          <a className={textLinkClass} href={`tel:${row.phone}`}>
            {row.phone}
          </a>
        ) : (
          <span>{row.phone}</span>
        )
      ) : null}
      {row.email ? (
        links ? (
          <a className={textLinkClass} href={`mailto:${row.email}`}>
            {row.email}
          </a>
        ) : (
          <span>{row.email}</span>
        )
      ) : null}
    </span>
  );
}

function LastPayment({ row }: { row: BillingDuesFollowUpRow }) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <span className="grid">
      <span>
        {row.last_payment_on && row.last_payment_paise
          ? t('{amount} on {date}', {
              amount: billingMoney(row.last_payment_paise, locale),
              date: billingDate(row.last_payment_on, locale),
            })
          : t('No confirmed payment')}
      </span>
      {row.awaiting_confirmation ? (
        <span className="text-caption text-ink-muted">
          {t('A payment is awaiting confirmation')}
        </span>
      ) : null}
    </span>
  );
}
