// Create or edit an asset, with an optional read-only AMC contract link when AMC is on.
'use client';
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ValidationError } from '@/core/errors';
import {
  ASSET_STATUS_LABELS,
  paiseToRupeesInput,
  rupeesToPaise,
} from '@/core/asset/presentation';
import {
  ASSET_STATUSES,
  assetInputSchema,
  type AssetFormOptions,
  type AssetRecord,
} from '@/core/asset/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { EmptyState } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  ASSET_ACTIONS,
  ASSET_BASE_HREF,
  ASSET_LINK_CLASS,
  assetDisplayDate,
  useAssetCopy,
  type AssetActions,
} from './shared';

/** Reads an optional rupee field: blank is null, otherwise paise. */
export function readOptionalRupees(
  form: FormData,
  name: string,
  field: string,
  invalidMessage = 'Enter an amount in rupees, for example 25000 or 1250.50.',
): number | null {
  const raw = String(form.get(name) ?? '').trim();
  if (!raw) return null;
  const paise = rupeesToPaise(raw);
  if (paise === null) {
    throw new ValidationError({
      [field]: invalidMessage,
    });
  }
  return paise;
}

function OptionalDate({
  id,
  label,
  value,
  onChange,
  min,
  max,
  helpText,
  clearLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  helpText?: string;
  clearLabel: string;
}) {
  const { t } = useAssetCopy();
  return (
    <div className="grid min-w-0 gap-space-2">
      <DatePicker
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        helpText={helpText}
      />
      {value ? (
        <Button variant="secondary" onClick={() => onChange('')}>
          {t('Clear {field}', { field: clearLabel })}
        </Button>
      ) : null}
    </div>
  );
}

export function AssetForm({
  asset,
  options,
  actions,
  onSaved,
}: {
  asset: AssetRecord | null;
  options: AssetFormOptions;
  actions: AssetActions;
  onSaved?: (id: string) => void;
}) {
  const { locale, t } = useAssetCopy();
  const id = useId();
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchase_date ?? '');
  const [warrantyEndDate, setWarrantyEndDate] = useState(
    asset?.warranty_end_date ?? '',
  );
  const text = (form: FormData, name: string) => String(form.get(name) ?? '');
  const categories = options.categories.filter(
    (category) => category.active || category.id === asset?.category_id,
  );
  return (
    <ModuleActionForm
      action={actions.saveAsset}
      idempotent
      submitLabel={t(asset ? 'Save asset' : 'Add asset')}
      onSaved={(data) => {
        const saved = z.uuid().safeParse(data);
        if (saved.success) onSaved?.(saved.data);
      }}
      input={(form, clientRequestId) =>
        assetInputSchema.parse({
          assetId: asset?.id ?? null,
          categoryId: text(form, 'categoryId'),
          name: text(form, 'name'),
          location: text(form, 'location'),
          make: text(form, 'make'),
          model: text(form, 'model'),
          serialNumber: text(form, 'serialNumber'),
          purchaseDate: purchaseDate || null,
          purchaseCostPaise: readOptionalRupees(
            form,
            'purchaseCost',
            'purchaseCostPaise',
            t('Enter an amount in rupees, for example 25000 or 1250.50.'),
          ),
          supplier: text(form, 'supplier'),
          warrantyEndDate: warrantyEndDate || null,
          status: text(form, 'status'),
          notes: text(form, 'notes'),
          amcContractId: options.amc_enabled
            ? text(form, 'amcContractId') || null
            : (asset?.amc_contract_id ?? null),
          expectedAmcEnabled: options.amc_enabled,
          expectedVersion: asset?.version ?? null,
          clientRequestId,
        })
      }
    >
      <SelectInput
        id={`${id}-category`}
        name="categoryId"
        label={t('Category')}
        required
        defaultValue={asset?.category_id ?? ''}
        options={[
          { value: '', label: t('Choose a category') },
          ...categories.map((category) => ({
            value: category.id,
            label: category.active
              ? category.name
              : t('{name} (inactive)', { name: category.name }),
          })),
        ]}
      />
      <TextInput
        id={`${id}-name`}
        name="name"
        label={t('Asset name')}
        helpText={t('For example Lift A1 or Borewell pump 2.')}
        required
        maxLength={120}
        defaultValue={asset?.name}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-location`}
        name="location"
        label={t('Location')}
        helpText={t('Where the asset is, for example Tower A lobby.')}
        required
        maxLength={120}
        defaultValue={asset?.location}
        autoComplete="off"
      />
      <SelectInput
        id={`${id}-status`}
        name="status"
        label={t('Status')}
        required
        defaultValue={asset?.status ?? 'active'}
        options={ASSET_STATUSES.map((status) => ({
          value: status,
          label: t(ASSET_STATUS_LABELS[status]),
        }))}
      />
      <TextInput
        id={`${id}-make`}
        name="make"
        label={t('Make (optional)')}
        maxLength={80}
        defaultValue={asset?.make ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-model`}
        name="model"
        label={t('Model (optional)')}
        maxLength={80}
        defaultValue={asset?.model ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-serial`}
        name="serialNumber"
        label={t('Serial number (optional)')}
        maxLength={80}
        defaultValue={asset?.serial_number ?? ''}
        autoComplete="off"
      />
      <OptionalDate
        id={`${id}-purchase-date`}
        label={t('Purchase date (optional)')}
        clearLabel={t('purchase date')}
        value={purchaseDate}
        onChange={setPurchaseDate}
        max={options.today}
      />
      <AmountInput
        id={`${id}-cost`}
        name="purchaseCost"
        label={t('Purchase cost (optional)')}
        defaultValue={
          asset?.purchase_cost_paise != null
            ? paiseToRupeesInput(asset.purchase_cost_paise)
            : ''
        }
      />
      <TextInput
        id={`${id}-supplier`}
        name="supplier"
        label={t('Supplier (optional)')}
        maxLength={120}
        defaultValue={asset?.supplier ?? ''}
        autoComplete="off"
      />
      <OptionalDate
        id={`${id}-warranty`}
        label={t('Warranty end date (optional)')}
        clearLabel={t('warranty end date')}
        helpText={t('The register flags warranties ending within 30 days.')}
        value={warrantyEndDate}
        onChange={setWarrantyEndDate}
        min={purchaseDate || undefined}
      />
      {options.amc_enabled ? (
        <SelectInput
          id={`${id}-amc`}
          name="amcContractId"
          label={t('AMC contract (optional)')}
          helpText={t(
            "Linking shows the contract's service visits in this asset's history. Contracts are managed in AMC.",
          )}
          defaultValue={asset?.amc_contract_id ?? ''}
          options={[
            { value: '', label: t('No AMC contract') },
            ...options.amc_contracts.map((contract) => ({
              value: contract.id,
              label: t('{asset} – {vendor} (ends {date})', {
                asset: contract.asset_label,
                vendor: contract.vendor_name,
                date: assetDisplayDate(contract.end_date, locale),
              }),
            })),
          ]}
        />
      ) : null}
      <TextAreaInput
        id={`${id}-notes`}
        name="notes"
        label={t('Notes (optional)')}
        maxLength={1000}
        defaultValue={asset?.notes ?? ''}
      />
    </ModuleActionForm>
  );
}

export function AssetFormView({
  asset,
  options,
  actions = ASSET_ACTIONS,
}: {
  asset: AssetRecord | null;
  options: AssetFormOptions;
  actions?: AssetActions;
}) {
  const { t } = useAssetCopy();
  const router = useRouter();
  const backHref = asset ? `${ASSET_BASE_HREF}/${asset.id}` : ASSET_BASE_HREF;
  const hasCategory = options.categories.some(
    (category) => category.active || category.id === asset?.category_id,
  );
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <a href={backHref} className={ASSET_LINK_CLASS}>
          {t(asset ? 'Back to the asset' : 'Back to the register')}
        </a>
        <h1 className="text-title font-semibold break-words">
          {asset ? t('Edit {name}', { name: asset.name }) : t('Add an asset')}
        </h1>
      </header>
      <Card title={t('Asset details')}>
        {hasCategory ? (
          <AssetForm
            asset={asset}
            options={options}
            actions={actions}
            onSaved={(id) => router.push(`${ASSET_BASE_HREF}/${id}`)}
          />
        ) : (
          <EmptyState
            title={t('Add a category first')}
            description={t(
              'Every asset belongs to a category, such as Lifts or Pumps.',
            )}
            action={
              <a
                href={`${ASSET_BASE_HREF}/categories`}
                className={ASSET_LINK_CLASS}
              >
                {t('Manage categories')}
              </a>
            }
          />
        )}
      </Card>
    </section>
  );
}
