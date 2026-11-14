// Render contract renewals, audited service-visit edits and administrator request links.
'use client';
import { useId } from 'react';
import { TextInput } from '@/components/ui/text-input';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { NoticeAttachmentUpload } from '@/components/notices/attachment-upload';
import {
  saveAmcContractAction,
  saveAmcVisitAction,
  linkAmcRequestAction,
} from '@/app/(admin)/admin/amc/actions';
import type { AmcContract, AmcVisit } from '@/core/amc/validation';
import { rupeesFromPaise } from '@/core/billing/validation';

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
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={
        renew
          ? 'Create successor contract'
          : contract
            ? 'Save contract details'
            : 'Add AMC contract'
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
        label="Asset / service label"
        name="assetLabel"
        required
        maxLength={120}
        defaultValue={contract?.asset_label ?? ''}
      />
      <TextInput
        id={`${id}-vendor`}
        label="Vendor name"
        name="vendorName"
        required
        maxLength={120}
        defaultValue={contract?.vendor_name ?? ''}
      />
      <TextInput
        id={`${id}-contact`}
        label="Vendor contact"
        name="vendorContact"
        required
        maxLength={120}
        defaultValue={contract?.vendor_contact ?? ''}
      />
      <TextInput
        id={`${id}-start`}
        label="Contract start"
        name="startDate"
        type="date"
        required
        defaultValue={renew ? today : (contract?.start_date ?? today)}
      />
      <TextInput
        id={`${id}-end`}
        label="Contract end"
        name="endDate"
        type="date"
        required
        defaultValue={renew ? '' : (contract?.end_date ?? '')}
      />
      <TextInput
        id={`${id}-cost`}
        label="Contract cost in rupees"
        name="costRupees"
        inputMode="decimal"
        required
        defaultValue={contract ? rupeesFromPaise(contract.cost_paise) : '0'}
      />
      <TextInput
        id={`${id}-terms`}
        label="Payment terms"
        name="paymentTerms"
        maxLength={1000}
        defaultValue={contract?.payment_terms ?? ''}
      />
      <TextInput
        id={`${id}-frequency`}
        label="Service visit frequency"
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
          Renewal creates a linked successor. The previous contract, document
          and visits remain unchanged.
        </p>
      ) : null}
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
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={visit ? 'Save visit correction' : 'Add service visit'}
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
        label="Service visit date"
        type="date"
        required
        max={today}
        defaultValue={visit?.visit_date ?? today}
      />
      <TextInput
        id={`${id}-summary`}
        name="summary"
        label="Visit summary"
        required
        maxLength={2000}
        defaultValue={visit?.summary ?? ''}
      />
      <TextInput
        id={`${id}-technician`}
        name="technician"
        label="Technician name"
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
        Administrator corrections are recorded in the audit history.
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
  const id = useId();
  return (
    <ModuleActionForm
      action={linkAmcRequestAction}
      submitLabel="Save AMC link"
      input={(data) => ({
        requestId,
        contractId: data.get('contractId') || null,
      })}
    >
      <label htmlFor={id} className="grid min-w-0 gap-space-2">
        AMC contract
        <select
          id={id}
          name="contractId"
          defaultValue={contractId ?? ''}
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3"
        >
          <option value="">Remove link</option>
          {contracts.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.asset_label} · {contract.end_date}
            </option>
          ))}
        </select>
      </label>
    </ModuleActionForm>
  );
}
