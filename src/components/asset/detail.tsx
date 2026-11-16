// Show one asset with its details, AMC link and combined maintenance history.
'use client';
import { useId, useState } from 'react';
import { ValidationError } from '@/core/errors';
import {
  ASSET_STATUS_LABELS,
  assetHistory,
  formatAssetDate,
  formatPaise,
  rupeesToPaise,
  warrantyText,
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
  type AssetActions,
} from './shared';

function MaintenanceForm({
  detail,
  actions,
}: {
  detail: AssetDetail;
  actions: AssetActions;
}) {
  const id = useId();
  const [performedOn, setPerformedOn] = useState(detail.today);
  return (
    <ModuleActionForm
      action={actions.addMaintenance}
      idempotent
      submitLabel="Add maintenance entry"
      onSaved={() => setPerformedOn(detail.today)}
      input={(form, clientRequestId) => {
        const rawCost = String(form.get('cost') ?? '').trim();
        const costPaise = rawCost ? rupeesToPaise(rawCost) : null;
        if (rawCost && costPaise === null) {
          throw new ValidationError({
            costPaise:
              'Enter an amount in rupees, for example 2500 or 1250.50.',
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
        label="Date of work"
        required
        value={performedOn}
        onChange={setPerformedOn}
        max={detail.today}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label="Work done"
        required
        maxLength={1000}
      />
      <TextInput
        id={`${id}-done-by`}
        name="doneBy"
        label="Done by"
        helpText="A technician, company or staff member."
        required
        maxLength={120}
        autoComplete="off"
      />
      <AmountInput id={`${id}-cost`} name="cost" label="Cost (optional)" />
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
  const { asset } = detail;
  const history = assetHistory(detail);
  const contract = detail.amc_contract;
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <a href={ASSET_BASE_HREF} className={ASSET_LINK_CLASS}>
          Back to the register
        </a>
        <h1 className="text-title font-semibold break-words">{asset.name}</h1>
        <p className="text-body break-words text-ink-muted">
          {asset.category_name} · {asset.location} ·{' '}
          {ASSET_STATUS_LABELS[asset.status]}
        </p>
        {detail.can_manage ? (
          <a
            href={`${ASSET_BASE_HREF}/${asset.id}/edit`}
            className={ASSET_LINK_CLASS}
          >
            Edit asset details
          </a>
        ) : null}
      </header>
      {asset.status === 'retired' ? (
        <Banner tone="info">
          This asset is retired. Its history is kept for reference.
        </Banner>
      ) : null}
      <Card title="Details">
        <dl className="grid min-w-0 gap-space-3 medium:grid-cols-2">
          <Fact
            label="Warranty"
            value={warrantyText(asset.warranty_end_date, detail.today)}
          />
          <Fact label="Make" value={asset.make ?? 'Not recorded'} />
          <Fact label="Model" value={asset.model ?? 'Not recorded'} />
          <Fact
            label="Serial number"
            value={asset.serial_number ?? 'Not recorded'}
          />
          <Fact
            label="Purchase date"
            value={
              asset.purchase_date
                ? formatAssetDate(asset.purchase_date)
                : 'Not recorded'
            }
          />
          <Fact
            label="Purchase cost"
            value={
              asset.purchase_cost_paise != null
                ? formatPaise(asset.purchase_cost_paise)
                : 'Not recorded'
            }
          />
          <Fact label="Supplier" value={asset.supplier ?? 'Not recorded'} />
          <Fact label="Notes" value={asset.notes ?? 'None'} />
        </dl>
      </Card>
      {detail.amc_enabled ? (
        <Card
          title="Annual maintenance contract"
          description="Read-only. Contracts and visits are managed in AMC."
        >
          {contract ? (
            <p className="text-body break-words">
              {contract.asset_label} with {contract.vendor_name},{' '}
              {formatAssetDate(contract.start_date)} to{' '}
              {formatAssetDate(contract.end_date)}
              {contract.renewed
                ? ' (renewed; visits from all terms shown)'
                : ''}
              .
            </p>
          ) : (
            <p className="text-body text-ink-muted">
              No AMC contract is linked.
              {detail.can_manage ? ' Link one by editing the asset.' : ''}
            </p>
          )}
        </Card>
      ) : null}
      <Card
        title="Maintenance history"
        description={
          detail.amc_enabled
            ? 'Manual entries and AMC service visits, newest first.'
            : 'Manual entries, newest first.'
        }
      >
        {history.length === 0 ? (
          <EmptyState
            title="No maintenance recorded"
            description={
              detail.can_manage
                ? 'Add the first entry below.'
                : 'An admin records maintenance work.'
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
                  {formatAssetDate(item.date)} ·{' '}
                  {item.kind === 'amc_visit' ? 'AMC visit' : 'Manual entry'}
                </p>
                <p className="text-body break-words whitespace-pre-line">
                  {item.description}
                </p>
                <p className="text-caption break-words text-ink-muted">
                  {item.kind === 'amc_visit'
                    ? `Technician: ${item.technician}`
                    : `Done by ${item.doneBy}${
                        item.costPaise != null
                          ? ` · ${formatPaise(item.costPaise)}`
                          : ''
                      }`}
                </p>
                {item.kind === 'maintenance' && detail.can_manage ? (
                  <AssetQuickAction
                    action={actions.removeMaintenance}
                    input={{ entryId: item.id }}
                    label="Remove entry"
                    confirmMessage="Remove this maintenance entry? It stays in the audit log."
                  />
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
      {detail.can_manage ? (
        <Card title="Record maintenance">
          <MaintenanceForm detail={detail} actions={actions} />
        </Card>
      ) : null}
    </section>
  );
}
