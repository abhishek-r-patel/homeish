// Show the vendor directory, purchase requests and approval settings to the admin and committee.
'use client';
import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ValidationError } from '@/core/errors';
import {
  VENDOR_REQUEST_STATUS_LABELS,
  approvalsText,
  formatPaise,
  paiseToRupeesInput,
  quoteRuleText,
  ratingText,
  rupeesToPaise,
} from '@/core/vendor/presentation';
import {
  VENDOR_APPROVALS_MAX,
  VENDOR_QUOTES_MAX,
  vendorInputSchema,
  vendorRequestInputSchema,
  vendorSettingsInputSchema,
  type VendorDetail,
  type VendorWorkspace,
} from '@/core/vendor/validation';
import { Card } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { VENDOR_ACTIONS, VENDOR_BASE_HREF, type VendorActions } from './shared';

/** Reads a rupee field and returns paise, or explains the expected format. */
export function readRupees(form: FormData, name: string, field: string) {
  const paise = rupeesToPaise(String(form.get(name) ?? ''));
  if (paise === null || paise < 1) {
    throw new ValidationError({
      [field]: 'Enter an amount in rupees, for example 25000 or 1250.50.',
    });
  }
  return paise;
}

export function VendorForm({
  vendor,
  actions,
  onSaved,
}: {
  vendor: VendorDetail['vendor'] | null;
  actions: VendorActions;
  onSaved?: (id: string) => void;
}) {
  const id = useId();
  const text = (form: FormData, name: string) => String(form.get(name) ?? '');
  return (
    <ModuleActionForm
      action={actions.saveVendor}
      idempotent
      submitLabel={vendor ? 'Save vendor' : 'Add vendor'}
      onSaved={(data) => {
        const saved = z.uuid().safeParse(data);
        if (saved.success) onSaved?.(saved.data);
      }}
      input={(form, clientRequestId) =>
        vendorInputSchema.parse({
          vendorId: vendor?.id ?? null,
          name: text(form, 'name'),
          category: text(form, 'category'),
          contactPerson: text(form, 'contactPerson'),
          phone: text(form, 'phone'),
          email: text(form, 'email'),
          gstin: text(form, 'gstin'),
          notes: text(form, 'notes'),
          expectedVersion: vendor?.version ?? null,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-name`}
        name="name"
        label="Vendor name"
        required
        maxLength={120}
        defaultValue={vendor?.name}
        autoComplete="organization"
      />
      <TextInput
        id={`${id}-category`}
        name="category"
        label="Category"
        helpText="For example Plumbing, Electrical or Housekeeping."
        required
        maxLength={60}
        defaultValue={vendor?.category}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-contact`}
        name="contactPerson"
        label="Contact person (optional)"
        maxLength={120}
        defaultValue={vendor?.contact_person ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-phone`}
        name="phone"
        label="Phone (optional)"
        type="tel"
        inputMode="tel"
        maxLength={20}
        defaultValue={vendor?.phone ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-email`}
        name="email"
        label="Email (optional)"
        type="email"
        maxLength={254}
        defaultValue={vendor?.email ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-gstin`}
        name="gstin"
        label="GSTIN (optional)"
        helpText="15 characters, for example 27ABCDE1234F1Z5."
        maxLength={20}
        defaultValue={vendor?.gstin ?? ''}
        autoComplete="off"
        className="uppercase"
      />
      <TextAreaInput
        id={`${id}-notes`}
        name="notes"
        label="Notes (optional)"
        maxLength={1000}
        defaultValue={vendor?.notes ?? ''}
      />
    </ModuleActionForm>
  );
}

function SettingsForm({
  workspace,
  actions,
}: {
  workspace: VendorWorkspace;
  actions: VendorActions;
}) {
  const id = useId();
  const settings = workspace.settings;
  const counts = (min: number, max: number) =>
    Array.from({ length: max - min + 1 }, (_, index) => {
      const value = String(min + index);
      return { value, label: value };
    });
  return (
    <ModuleActionForm
      action={actions.saveSettings}
      submitLabel="Save approval settings"
      input={(form) =>
        vendorSettingsInputSchema.parse({
          quoteThresholdPaise:
            String(form.get('threshold') ?? '').trim() === '0'
              ? 0
              : readRupees(form, 'threshold', 'quoteThresholdPaise'),
          quotesAboveThreshold: Number(form.get('quotes')),
          approvalsRequired: Number(form.get('approvals')),
        })
      }
    >
      <AmountInput
        id={`${id}-threshold`}
        name="threshold"
        label="Quote threshold"
        helpText="Below this amount one quote is enough."
        required
        defaultValue={paiseToRupeesInput(settings.quote_threshold_paise)}
      />
      <SelectInput
        id={`${id}-quotes`}
        name="quotes"
        label="Quotes needed at or above the threshold"
        required
        defaultValue={String(settings.quotes_above_threshold)}
        options={counts(1, VENDOR_QUOTES_MAX)}
      />
      <SelectInput
        id={`${id}-approvals`}
        name="approvals"
        label="Approvals needed"
        helpText="Distinct admin or committee members. With 0, an admin approves alone. The person who raised a request never approves it."
        required
        defaultValue={String(settings.approvals_required)}
        options={counts(0, VENDOR_APPROVALS_MAX)}
      />
    </ModuleActionForm>
  );
}

export function PurchaseRequestForm({
  request,
  actions,
  onSaved,
}: {
  request: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    estimated_amount_paise: number;
    version: number;
  } | null;
  actions: VendorActions;
  onSaved?: (id: string) => void;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveRequest}
      idempotent
      submitLabel={request ? 'Save request' : 'Create draft request'}
      onSaved={(data) => {
        const saved = z.uuid().safeParse(data);
        if (saved.success) onSaved?.(saved.data);
      }}
      input={(form, clientRequestId) =>
        vendorRequestInputSchema.parse({
          purchaseRequestId: request?.id ?? null,
          title: String(form.get('title') ?? ''),
          description: String(form.get('description') ?? ''),
          category: String(form.get('category') ?? ''),
          estimatedAmountPaise: readRupees(
            form,
            'estimate',
            'estimatedAmountPaise',
          ),
          expectedVersion: request?.version ?? null,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label="What do you want to buy?"
        required
        maxLength={120}
        defaultValue={request?.title}
        autoComplete="off"
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label="Details (optional)"
        maxLength={2000}
        defaultValue={request?.description ?? ''}
      />
      <TextInput
        id={`${id}-category`}
        name="category"
        label="Category (optional)"
        helpText="Used to pick the expense category when the request is approved."
        maxLength={60}
        defaultValue={request?.category ?? ''}
        autoComplete="off"
      />
      <AmountInput
        id={`${id}-estimate`}
        name="estimate"
        label="Estimated amount"
        required
        defaultValue={
          request ? paiseToRupeesInput(request.estimated_amount_paise) : ''
        }
      />
    </ModuleActionForm>
  );
}

function VendorList({ workspace }: { workspace: VendorWorkspace }) {
  if (workspace.vendors.length === 0) {
    return (
      <EmptyState
        title="No vendors yet"
        description={
          workspace.can_manage
            ? 'Add the first vendor below.'
            : 'An admin adds vendors to the directory.'
        }
      />
    );
  }
  return (
    <ul className="grid gap-space-3">
      {workspace.vendors.map((vendor) => (
        <li
          key={vendor.id}
          className="grid gap-space-1 rounded-md border border-rule p-space-4"
        >
          <a
            href={`${VENDOR_BASE_HREF}/${vendor.id}`}
            className="inline-flex min-h-12 items-center text-body-strong text-brand underline"
          >
            {vendor.name}
          </a>
          <p className="text-caption text-ink-muted">
            {vendor.category}
            {vendor.active ? '' : ' · Inactive'}
            {vendor.contact_person ? ` · ${vendor.contact_person}` : ''}
            {vendor.phone ? ` · ${vendor.phone}` : ''}
          </p>
          <p className="text-caption">
            {ratingText(vendor.rating_average, vendor.rating_count)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function RequestList({ workspace }: { workspace: VendorWorkspace }) {
  if (workspace.requests.length === 0) {
    return (
      <EmptyState
        title="No purchase requests yet"
        description="Create a draft request below, add quotes and submit it for approval."
      />
    );
  }
  return (
    <ul className="grid gap-space-3">
      {workspace.requests.map((request) => (
        <li
          key={request.id}
          className="grid gap-space-1 rounded-md border border-rule p-space-4"
        >
          <a
            href={`${VENDOR_BASE_HREF}/requests/${request.id}`}
            className="inline-flex min-h-12 items-center text-body-strong text-brand underline"
          >
            {request.title}
          </a>
          <p className="text-caption text-ink-muted">
            {VENDOR_REQUEST_STATUS_LABELS[request.status]} ·{' '}
            {formatPaise(
              request.selected_amount_paise ?? request.estimated_amount_paise,
            )}
            {request.selected_vendor_name
              ? ` · ${request.selected_vendor_name}`
              : ''}
            {request.created_by_name
              ? ` · Raised by ${request.mine ? 'you' : request.created_by_name}`
              : ''}
          </p>
          <p className="text-caption">
            {quoteRuleText(request.rule)}
            {request.status === 'submitted'
              ? ` · ${approvalsText(request.approvals, request.approvals_required)}`
              : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function VendorWorkspaceView({
  workspace,
  actions = VENDOR_ACTIONS,
}: {
  workspace: VendorWorkspace;
  actions?: VendorActions;
}) {
  const router = useRouter();
  const settings = workspace.settings;
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Vendors & Purchases</h1>
        <p className="text-body text-ink-muted">
          Below {formatPaise(settings.quote_threshold_paise)} one quote is
          enough; at or above it, {settings.quotes_above_threshold} quotes are
          needed.{' '}
          {settings.approvals_required === 0
            ? 'An admin approves requests alone.'
            : `${settings.approvals_required} ${settings.approvals_required === 1 ? 'approval is' : 'approvals are'} needed.`}{' '}
          Ratings and vendor documents are visible to the admin and committee
          only.
        </p>
      </header>
      {workspace.expense_enabled ? null : (
        <Banner tone="info">
          Expenses is off, so approved requests do not create expense drafts.
        </Banner>
      )}
      <Card
        title="Purchase requests"
        description="Draft, submitted and decided requests, newest first."
      >
        <RequestList workspace={workspace} />
      </Card>
      <Card title="New purchase request">
        <PurchaseRequestForm
          request={null}
          actions={actions}
          onSaved={(id) => router.push(`${VENDOR_BASE_HREF}/requests/${id}`)}
        />
      </Card>
      <Card title="Vendors">
        <VendorList workspace={workspace} />
      </Card>
      {workspace.can_manage ? (
        <>
          <Card title="Add a vendor">
            <VendorForm
              vendor={null}
              actions={actions}
              onSaved={(id) => router.push(`${VENDOR_BASE_HREF}/${id}`)}
            />
          </Card>
          <Card
            title="Approval settings"
            description="Changes apply to requests submitted from now on."
          >
            <SettingsForm workspace={workspace} actions={actions} />
          </Card>
        </>
      ) : null}
    </section>
  );
}
