// Show one asset with its details, AMC link and combined maintenance history.
'use client';
import { useId, useState } from 'react';
import { ValidationError } from '@/core/errors';
import {
  ASSET_STATUS_LABELS,
  assetHistory,
  rupeesToPaise,
} from '@/core/asset/presentation';
import {
  assetMaintenanceInputSchema,
  type AssetDetail,
} from '@/core/asset/validation';
import { Card } from '@/components/ui/data-display';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  ASSET_ACTIONS,
  ASSET_BASE_HREF,
  ASSET_LINK_CLASS,
  AssetQuickAction,
  assetDisplayDate,
  assetDisplayMoney,
  assetWarrantyText,
  useAssetCopy,
  type AssetActions,
} from './shared';

function MaintenanceForm({
  detail,
  actions,
}: {
  detail: AssetDetail;
  actions: AssetActions;
}) {
  const { t } = useAssetCopy();
  const id = useId();
  const [performedOn, setPerformedOn] = useState(detail.today);
  return (
    <ModuleActionForm
      action={actions.addMaintenance}
      idempotent
      submitLabel={t('Add maintenance entry')}
      onSaved={() => setPerformedOn(detail.today)}
      input={(form, clientRequestId) => {
        const rawCost = String(form.get('cost') ?? '').trim();
        const costPaise = rawCost ? rupeesToPaise(rawCost) : null;
        if (rawCost && costPaise === null) {
          throw new ValidationError({
            costPaise: t(
              'Enter an amount in rupees, for example 2500 or 1250.50.',
            ),
          });
        }
        return assetMaintenanceInputSchema.parse({
          assetId: detail.asset.id,
          performedOn,
          description: String(form.get('description') ?? ''),
          costPaise,
          doneBy: String(form.get('doneBy') ?? ''),
          clientRequestId,
        });
      }}
    >
      <DatePicker
        id={`${id}-date`}
        label={t('Date of work')}
        required
        value={performedOn}
        onChange={setPerformedOn}
        max={detail.today}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Work done')}
        required
        maxLength={1000}
      />
      <TextInput
        id={`${id}-done-by`}
        name="doneBy"
        label={t('Done by')}
        helpText={t('A technician, company or staff member.')}
        required
        maxLength={120}
        autoComplete="off"
      />
      <AmountInput id={`${id}-cost`} name="cost" label={t('Cost (optional)')} />
    </ModuleActionForm>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-space-1">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="text-body break-words">{value}</dd>
    </div>
  );
}

export function AssetDetailView({
  detail,
  actions = ASSET_ACTIONS,
}: {
  detail: AssetDetail;
  actions?: AssetActions;
}) {
  const { locale, t } = useAssetCopy();
  const { asset } = detail;
  const history = assetHistory(detail);
  const contract = detail.amc_contract;
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <a href={ASSET_BASE_HREF} className={ASSET_LINK_CLASS}>
          {t('Back to the register')}
        </a>
        <h1 className="text-title font-semibold break-words">{asset.name}</h1>
        <p className="text-body break-words text-ink-muted">
          {asset.category_name} · {asset.location} ·{' '}
          {t(ASSET_STATUS_LABELS[asset.status])}
        </p>
        {detail.can_manage ? (
          <a
            href={`${ASSET_BASE_HREF}/${asset.id}/edit`}
            className={ASSET_LINK_CLASS}
          >
            {t('Edit asset details')}
          </a>
        ) : null}
      </header>
      {asset.status === 'retired' ? (
        <Banner tone="info">
          {t('This asset is retired. Its history is kept for reference.')}
        </Banner>
      ) : null}
      <Card title={t('Details')}>
        <dl className="grid min-w-0 gap-space-3 medium:grid-cols-2">
          <Fact
            label={t('Warranty')}
            value={assetWarrantyText(
              asset.warranty_end_date,
              detail.today,
              locale,
              t,
            )}
          />
          <Fact label={t('Make')} value={asset.make ?? t('Not recorded')} />
          <Fact label={t('Model')} value={asset.model ?? t('Not recorded')} />
          <Fact
            label={t('Serial number')}
            value={asset.serial_number ?? t('Not recorded')}
          />
          <Fact
            label={t('Purchase date')}
            value={
              asset.purchase_date
                ? assetDisplayDate(asset.purchase_date, locale)
                : t('Not recorded')
            }
          />
          <Fact
            label={t('Purchase cost')}
            value={
              asset.purchase_cost_paise != null
                ? assetDisplayMoney(asset.purchase_cost_paise, locale)
                : t('Not recorded')
            }
          />
          <Fact
            label={t('Supplier')}
            value={asset.supplier ?? t('Not recorded')}
          />
          <Fact label={t('Notes')} value={asset.notes ?? t('None')} />
        </dl>
      </Card>
      {detail.amc_enabled ? (
        <Card
          title={t('Annual maintenance contract')}
          description={t('Read-only. Contracts and visits are managed in AMC.')}
        >
          {contract ? (
            <p className="text-body break-words">
              {contract.asset_label} {t('with')} {contract.vendor_name},{' '}
              {assetDisplayDate(contract.start_date, locale)} {t('to')}{' '}
              {assetDisplayDate(contract.end_date, locale)}
              {contract.renewed
                ? ` (${t('renewed; visits from all terms shown')})`
                : ''}
              .
            </p>
          ) : (
            <p className="text-body text-ink-muted">
              {t('No AMC contract is linked.')}
              {detail.can_manage
                ? ` ${t('Link one by editing the asset.')}`
                : ''}
            </p>
          )}
        </Card>
      ) : null}
      <Card
        title={t('Maintenance history')}
        description={
          detail.amc_enabled
            ? t('Manual entries and AMC service visits, newest first.')
            : t('Manual entries, newest first.')
        }
      >
        {history.length === 0 ? (
          <EmptyState
            title={t('No maintenance recorded')}
            description={
              detail.can_manage
                ? t('Add the first entry below.')
                : t('An admin records maintenance work.')
            }
          />
        ) : (
          <ol className="grid gap-space-3">
            {history.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="grid min-w-0 gap-space-1 rounded-md border border-rule p-space-4"
              >
                <p className="text-body-strong">
                  {assetDisplayDate(item.date, locale)} ·{' '}
                  {t(item.kind === 'amc_visit' ? 'AMC visit' : 'Manual entry')}
                </p>
                <p className="text-body break-words whitespace-pre-line">
                  {item.description}
                </p>
                <p className="text-caption break-words text-ink-muted">
                  {item.kind === 'amc_visit'
                    ? `${t('Technician:')} ${item.technician}`
                    : `${t('Done by')} ${item.doneBy}${
                        item.costPaise != null
                          ? ` · ${assetDisplayMoney(item.costPaise, locale)}`
                          : ''
                      }`}
                </p>
                {item.kind === 'maintenance' && detail.can_manage ? (
                  <AssetQuickAction
                    action={actions.removeMaintenance}
                    input={{ entryId: item.id }}
                    label={t('Remove entry')}
                    confirmMessage={t(
                      'Remove this maintenance entry? It stays in the audit log.',
                    )}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
      {detail.can_manage ? (
        <Card title={t('Record maintenance')}>
          <MaintenanceForm detail={detail} actions={actions} />
        </Card>
      ) : null}
    </section>
  );
}
