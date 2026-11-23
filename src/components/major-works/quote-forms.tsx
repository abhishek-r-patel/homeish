// Render P50.2 typed/vendor quotes, exclusions and chosen-quote records.
'use client';
import { useId, useState } from 'react';
import {
  addMajorWorksQuoteAction,
  chooseMajorWorksQuoteAction,
  removeMajorWorksQuoteAction,
} from '@/app/(admin)/admin/major-works/actions';
import type { MajorWorksScoring } from '@/core/major-works/validation';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { TextInput } from '@/components/ui/text-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';
import { MajorWorksAuditFileUpload } from './audit-file-upload';

export function MajorWorksQuoteForm({
  action = addMajorWorksQuoteAction,
  refresh = true,
  projectId,
  vendorQuotes,
}: {
  action?: ModuleFormAction;
  refresh?: boolean;
  projectId: string;
  vendorQuotes: MajorWorksScoring['vendor_quotes'];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [vendorQuoteId, setVendorQuoteId] = useState('');
  const selected = vendorQuotes.find((quote) => quote.id === vendorQuoteId);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitLabel={t('Add quote')}
      input={(data) => ({
        projectId,
        vendorQuoteId: vendorQuoteId || null,
        vendorName: selected?.vendor_name ?? data.get('vendorName'),
        amountRupees: selected
          ? selected.amount_paise / 100
          : data.get('amountRupees'),
        scopeNote: selected?.scope_note ?? data.get('scopeNote'),
        filePath: vendorQuoteId ? '' : data.get('filePath') || '',
        likeForLike: data.get('likeForLike') === 'on',
      })}
    >
      {vendorQuotes.length ? (
        <SelectInput
          id={`${id}-source`}
          label={t('Vendor purchase-request quote')}
          name="vendorQuoteId"
          onChange={(event) => setVendorQuoteId(event.currentTarget.value)}
          options={[
            { value: '', label: t('Type a quote instead') },
            ...vendorQuotes.map((quote) => ({
              value: quote.id,
              label: `${quote.request_title} - ${quote.vendor_name}`,
            })),
          ]}
          value={vendorQuoteId}
        />
      ) : null}
      {!vendorQuoteId ? (
        <>
          <TextInput
            id={`${id}-vendor`}
            label={t('Vendor name')}
            maxLength={120}
            name="vendorName"
            required
          />
          <AmountInput
            id={`${id}-amount`}
            label={t('Quote amount')}
            name="amountRupees"
            required
          />
          <TextAreaInput
            id={`${id}-scope`}
            label={t('Scope note')}
            maxLength={500}
            name="scopeNote"
            required
            rows={3}
          />
          <MajorWorksAuditFileUpload
            fieldName="filePath"
            kind="quote"
            label="Private quote file (optional: JPEG, PNG or PDF up to 10 MB)"
          />
        </>
      ) : (
        <div className="grid gap-space-1 rounded-md bg-surface-sunken p-space-3">
          <strong>{selected?.vendor_name}</strong>
          <span>{selected?.request_title}</span>
          <span>{selected?.scope_note ?? t('No scope note')}</span>
        </div>
      )}
      <CheckboxInput
        id={`${id}-like`}
        label={t('Like-for-like scope')}
        name="likeForLike"
      />
    </ModuleActionForm>
  );
}

export function MajorWorksQuoteRemoveForm({
  action = removeMajorWorksQuoteAction,
  exclude,
  quote,
}: {
  action?: ModuleFormAction;
  exclude: boolean;
  quote: MajorWorksScoring['quotes'][number];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={exclude ? t('Exclude from scoring') : t('Remove quote')}
      input={(data) => ({
        quoteId: quote.id,
        reason: data.get('reason'),
        exclude,
      })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Reason')}
        maxLength={500}
        minLength={5}
        name="reason"
        required
        rows={2}
      />
    </ModuleActionForm>
  );
}

export function MajorWorksChosenQuoteForm({
  action = chooseMajorWorksQuoteAction,
  refresh = true,
  data,
}: {
  action?: ModuleFormAction;
  refresh?: boolean;
  data: MajorWorksScoring;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const available = data.quotes.filter(
    (quote) => !quote.removed_at && !quote.excluded_at,
  );
  if (!available.length) return null;
  return (
    <ModuleActionForm
      action={action}
      refresh={refresh}
      submitLabel={t('Record chosen quote')}
      input={(form) => ({
        projectId: data.project_id,
        quoteId: form.get('quoteId'),
        reason: form.get('reason'),
        resolutionId: form.get('resolutionId') || null,
        expectedUpdatedAt: data.updated_at,
      })}
    >
      <SelectInput
        defaultValue={data.chosen_quote_id ?? ''}
        id={`${id}-quote`}
        label={t('Chosen quote')}
        name="quoteId"
        options={available.map((quote) => ({
          value: quote.id,
          label: `${quote.vendor_name} - ${quote.amount_paise / 100}`,
        }))}
        placeholder={t('Choose quote')}
        required
      />
      <TextAreaInput
        defaultValue={data.chosen_quote_reason ?? ''}
        id={`${id}-reason`}
        label={t('Society decision reason')}
        maxLength={500}
        minLength={5}
        name="reason"
        required
        rows={3}
      />
    </ModuleActionForm>
  );
}
