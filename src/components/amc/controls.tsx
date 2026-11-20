// Render contract renewals, audited service-visit edits and administrator request links.
'use client';
import { useId } from 'react';
import { useOptionalLanguage } from '@/components/language-context';
import { TextInput } from '@/components/ui/text-input';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { NoticeAttachmentUpload } from '@/components/notices/attachment-upload';
import {
  saveAmcExpirySettingsAction,
  saveAmcContractAction,
  saveAmcScheduleAction,
  saveAmcVisitAction,
  linkAmcRequestAction,
} from '@/app/(admin)/admin/amc/actions';
import {
  amcScheduleInputSchema,
  type AmcContract,
  type AmcVisit,
} from '@/core/amc/validation';
import { rupeesFromPaise } from '@/core/billing/validation';
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';
import { formatLocalizedDate } from '@/core/i18n/format';

function useAmcCopy() {
  const language = useOptionalLanguage();
  const locale = language?.locale ?? 'en';
  return {
    locale,
    t: createComponentTranslator(
      locale,
      language?.translate ?? ((source) => source),
    ),
  };
}

export function AmcExpirySettingsForm({
  settings,
  action = saveAmcExpirySettingsAction,
}: {
  settings: { due_soon_days: number; urgent_days: number };
  action?: ModuleFormAction;
}) {
  const { t } = useAmcCopy();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save settings')}
      input={(data) => ({
        dueSoonDays: Number(data.get('dueSoonDays')),
        urgentDays: Number(data.get('urgentDays')),
      })}
    >
      <TextInput
        id={`${id}-due-soon`}
        label={t('Due Soon window (days)')}
        name="dueSoonDays"
        type="number"
        min={2}
        max={365}
        step={1}
        required
        defaultValue={settings.due_soon_days}
      />
      <TextInput
        id={`${id}-urgent`}
        label={t('Urgent window (days)')}
        name="urgentDays"
        type="number"
        min={1}
        max={364}
        step={1}
        required
        defaultValue={settings.urgent_days}
      />
      <p className="text-caption text-ink-muted">
        {t('Urgent must be shorter than Due Soon.')}
      </p>
    </ModuleActionForm>
  );
}

export function AmcContractForm({
  contract,
  renew = false,
  today,
  action = saveAmcContractAction,
}: {
  contract?: AmcContract;
  renew?: boolean;
  today: string;
  action?: ModuleFormAction;
}) {
  const { t } = useAmcCopy();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={
        renew
          ? t('Create successor contract')
          : contract
            ? t('Save contract details')
            : t('Add AMC contract')
      }
      input={(data) => ({
        contractId: renew ? null : (contract?.id ?? null),
        predecessorId: renew
          ? (contract?.id ?? null)
          : (contract?.predecessor_id ?? null),
        expectedUpdatedAt: renew ? null : (contract?.updated_at ?? null),
        assetLabel: data.get('assetLabel'),
        vendorName: data.get('vendorName'),
        vendorContact: data.get('vendorContact'),
        startDate: data.get('startDate'),
        endDate: data.get('endDate'),
        costRupees: data.get('costRupees'),
        paymentTerms: data.get('paymentTerms'),
        visitFrequency: data.get('visitFrequency'),
        documentPath: data.get('attachmentPath') || null,
      })}
    >
      <TextInput
        id={`${id}-asset`}
        label={t('Asset / service label')}
        name="assetLabel"
        required
        maxLength={120}
        defaultValue={contract?.asset_label ?? ''}
      />
      <TextInput
        id={`${id}-vendor`}
        label={t('Vendor name')}
        name="vendorName"
        required
        maxLength={120}
        defaultValue={contract?.vendor_name ?? ''}
      />
      <TextInput
        id={`${id}-contact`}
        label={t('Vendor contact')}
        name="vendorContact"
        required
        maxLength={120}
        defaultValue={contract?.vendor_contact ?? ''}
      />
      <TextInput
        id={`${id}-start`}
        label={t('Contract start')}
        name="startDate"
        type="date"
        required
        defaultValue={renew ? today : (contract?.start_date ?? today)}
      />
      <TextInput
        id={`${id}-end`}
        label={t('Contract end')}
        name="endDate"
        type="date"
        required
        defaultValue={renew ? '' : (contract?.end_date ?? '')}
      />
      <TextInput
        id={`${id}-cost`}
        label={t('Contract cost in rupees')}
        name="costRupees"
        inputMode="decimal"
        required
        defaultValue={contract ? rupeesFromPaise(contract.cost_paise) : '0'}
      />
      <TextInput
        id={`${id}-terms`}
        label={t('Payment terms')}
        name="paymentTerms"
        maxLength={1000}
        defaultValue={contract?.payment_terms ?? ''}
      />
      <TextInput
        id={`${id}-frequency`}
        label={t('Service visit frequency')}
        name="visitFrequency"
        required
        maxLength={120}
        defaultValue={contract?.visit_frequency ?? ''}
      />
      <NoticeAttachmentUpload
        id={`${id}-document`}
        bucket="amc-files"
        initialPath={renew ? null : (contract?.document_path ?? null)}
      />
      {renew ? (
        <p className="text-caption text-ink-muted">
          {t(
            'Renewal creates a linked successor. The previous contract, document and visits remain unchanged.',
          )}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}
export function AmcScheduleForm({
  contract,
  categories,
  action = saveAmcScheduleAction,
}: {
  contract: AmcContract;
  categories: { id: string; name: string; active: boolean }[];
  action?: ModuleFormAction;
}) {
  const { t } = useAmcCopy();
  const id = useId();
  const choices = categories.filter(
    (category) => category.active || category.id === contract.asset_category_id,
  );
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save service schedule')}
      input={(data) => {
        const services = String(data.get('servicesPerYear') ?? '').trim();
        return amcScheduleInputSchema.parse({
          contractId: contract.id,
          amcType: data.get('amcType') || null,
          assetCategoryId: data.get('assetCategoryId') || null,
          servicesPerYear: services === '' ? null : Number(services),
          expectedUpdatedAt: contract.updated_at,
        });
      }}
    >
      <label htmlFor={`${id}-type`} className="grid min-w-0 gap-space-2">
        {t('AMC type')}
        <select
          id={`${id}-type`}
          name="amcType"
          defaultValue={contract.amc_type ?? ''}
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3"
        >
          <option value="">{t('Not set')}</option>
          <option value="comprehensive">{t('Comprehensive')}</option>
          <option value="non_comprehensive">{t('Non-comprehensive')}</option>
        </select>
      </label>
      <label htmlFor={`${id}-category`} className="grid min-w-0 gap-space-2">
        {t('Asset type')}
        <select
          id={`${id}-category`}
          name="assetCategoryId"
          defaultValue={contract.asset_category_id ?? ''}
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3"
        >
          <option value="">{t('Not set')}</option>
          {choices.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <TextInput
        id={`${id}-services`}
        label={t('Services per year (optional)')}
        name="servicesPerYear"
        type="number"
        min={1}
        max={12}
        step={1}
        defaultValue={contract.services_per_year ?? ''}
      />
      <p className="text-caption text-ink-muted">
        {t(
          'The next service date is worked out from the last visit. Until the first visit it shows as Unscheduled.',
        )}
      </p>
    </ModuleActionForm>
  );
}
export function AmcVisitForm({
  contractId,
  visit,
  today,
  action = saveAmcVisitAction,
}: {
  contractId: string;
  visit?: AmcVisit;
  today: string;
  action?: ModuleFormAction;
}) {
  const { t } = useAmcCopy();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t(visit ? 'Save visit correction' : 'Add service visit')}
      input={(data) => ({
        contractId,
        visitId: visit?.id ?? null,
        expectedUpdatedAt: visit?.updated_at ?? null,
        visitDate: data.get('visitDate'),
        summary: data.get('summary'),
        technician: data.get('technician'),
        documentPath: data.get('attachmentPath') || null,
      })}
    >
      <TextInput
        id={`${id}-date`}
        name="visitDate"
        label={t('Service visit date')}
        type="date"
        required
        max={today}
        defaultValue={visit?.visit_date ?? today}
      />
      <TextInput
        id={`${id}-summary`}
        name="summary"
        label={t('Visit summary')}
        required
        maxLength={2000}
        defaultValue={visit?.summary ?? ''}
      />
      <TextInput
        id={`${id}-technician`}
        name="technician"
        label={t('Technician name')}
        required
        maxLength={120}
        defaultValue={visit?.technician ?? ''}
      />
      <NoticeAttachmentUpload
        id={`${id}-document`}
        bucket="amc-files"
        initialPath={visit?.document_path ?? null}
      />
      <p className="text-caption text-ink-muted">
        {t('Administrator corrections are recorded in the audit history.')}
      </p>
    </ModuleActionForm>
  );
}
export function AmcRequestLinkForm({
  requestId,
  contracts,
  contractId,
}: {
  requestId: string;
  contracts: AmcContract[];
  contractId: string | null;
}) {
  const { locale, t } = useAmcCopy();
  const id = useId();
  return (
    <ModuleActionForm
      action={linkAmcRequestAction}
      submitLabel={t('Save AMC link')}
      input={(data) => ({
        requestId,
        contractId: data.get('contractId') || null,
      })}
    >
      <label htmlFor={id} className="grid min-w-0 gap-space-2">
        {t('AMC contract')}
        <select
          id={id}
          name="contractId"
          defaultValue={contractId ?? ''}
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3"
        >
          <option value="">{t('Remove link')}</option>
          {contracts.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.asset_label} ·{' '}
              {formatLocalizedDate(
                new Date(`${contract.end_date}T00:00:00.000Z`),
                locale,
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'UTC',
                },
              )}
            </option>
          ))}
        </select>
      </label>
    </ModuleActionForm>
  );
}
