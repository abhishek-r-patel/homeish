// Show the vendor directory, purchase requests and approval settings to the admin and committee.
'use client';
import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ValidationError } from '@/core/errors';
import {
  VENDOR_REQUEST_STATUS_LABELS,
  paiseToRupeesInput,
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
import { useVendorPresentation } from './presentation';

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
  const { t } = useVendorPresentation();
  const id = useId();
  const text = (form: FormData, name: string) => String(form.get(name) ?? '');
  return (
    <ModuleActionForm
      action={actions.saveVendor}
      idempotent
      submitLabel={t(vendor ? 'Save vendor' : 'Add vendor')}
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
        label={t('Vendor name')}
        required
        maxLength={120}
        defaultValue={vendor?.name}
        autoComplete="organization"
      />
      <TextInput
        id={`${id}-category`}
        name="category"
        label={t('Category')}
        helpText={t('For example Plumbing, Electrical or Housekeeping.')}
        required
        maxLength={60}
        defaultValue={vendor?.category}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-contact`}
        name="contactPerson"
        label={t('Contact person (optional)')}
        maxLength={120}
        defaultValue={vendor?.contact_person ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-phone`}
        name="phone"
        label={t('Phone (optional)')}
        type="tel"
        inputMode="tel"
        maxLength={20}
        defaultValue={vendor?.phone ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-email`}
        name="email"
        label={t('Email (optional)')}
        type="email"
        maxLength={254}
        defaultValue={vendor?.email ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-gstin`}
        name="gstin"
        label={t('GSTIN (optional)')}
        helpText={t('15 characters, for example 27ABCDE1234F1Z5.')}
        maxLength={20}
        defaultValue={vendor?.gstin ?? ''}
        autoComplete="off"
        className="uppercase"
      />
      <TextAreaInput
        id={`${id}-notes`}
        name="notes"
        label={t('Notes (optional)')}
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
  const { t } = useVendorPresentation();
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
      submitLabel={t('Save approval settings')}
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
        label={t('Quote threshold')}
        helpText={t('Below this amount one quote is enough.')}
        required
        defaultValue={paiseToRupeesInput(settings.quote_threshold_paise)}
      />
      <SelectInput
        id={`${id}-quotes`}
        name="quotes"
        label={t('Quotes needed at or above the threshold')}
        required
        defaultValue={String(settings.quotes_above_threshold)}
        options={counts(1, VENDOR_QUOTES_MAX)}
      />
      <SelectInput
        id={`${id}-approvals`}
        name="approvals"
        label={t('Approvals needed')}
        helpText={t(
          'Distinct admin or committee members. With 0, an admin approves alone. The person who raised a request never approves it.',
        )}
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
  const { t } = useVendorPresentation();
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveRequest}
      idempotent
      submitLabel={t(request ? 'Save request' : 'Create draft request')}
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
        label={t('What do you want to buy?')}
        required
        maxLength={120}
        defaultValue={request?.title}
        autoComplete="off"
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Details (optional)')}
        maxLength={2000}
        defaultValue={request?.description ?? ''}
      />
      <TextInput
        id={`${id}-category`}
        name="category"
        label={t('Category (optional)')}
        helpText={t(
          'Used to pick the expense category when the request is approved.',
        )}
        maxLength={60}
        defaultValue={request?.category ?? ''}
        autoComplete="off"
      />
      <AmountInput
        id={`${id}-estimate`}
        name="estimate"
        label={t('Estimated amount')}
        required
        defaultValue={
          request ? paiseToRupeesInput(request.estimated_amount_paise) : ''
        }
      />
    </ModuleActionForm>
  );
}

function VendorList({ workspace }: { workspace: VendorWorkspace }) {
  const { t, rating } = useVendorPresentation();
  if (workspace.vendors.length === 0) {
    return (
      <EmptyState
        title={t('No vendors yet')}
        description={t(
          workspace.can_manage
            ? 'Add the first vendor below.'
            : 'An admin adds vendors to the directory.',
        )}
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
            {vendor.active ? '' : t(' · Inactive')}
            {vendor.contact_person ? ` · ${vendor.contact_person}` : ''}
            {vendor.phone ? ` · ${vendor.phone}` : ''}
          </p>
          <p className="text-caption">
            {rating(vendor.rating_average, vendor.rating_count)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function RequestList({ workspace }: { workspace: VendorWorkspace }) {
  const { t, money, quoteRule, approvals } = useVendorPresentation();
  if (workspace.requests.length === 0) {
    return (
      <EmptyState
        title={t('No purchase requests yet')}
        description={t(
          'Create a draft request below, add quotes and submit it for approval.',
        )}
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
            {t(VENDOR_REQUEST_STATUS_LABELS[request.status])} ·{' '}
            {money(
              request.selected_amount_paise ?? request.estimated_amount_paise,
            )}
            {request.selected_vendor_name
              ? ` · ${request.selected_vendor_name}`
              : ''}
            {request.created_by_name
              ? t(' · Raised by {name}', {
                  name: request.mine ? t('you') : request.created_by_name,
                })
              : ''}
          </p>
          <p className="text-caption">
            {quoteRule(request.rule)}
            {request.status === 'submitted'
              ? ` · ${approvals(request.approvals, request.approvals_required)}`
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
  const { t, money } = useVendorPresentation();
  const router = useRouter();
  const settings = workspace.settings;
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Vendors & Purchases')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Below {threshold} one quote is enough; at or above it, {count} quotes are needed.',
            {
              threshold: money(settings.quote_threshold_paise),
              count: settings.quotes_above_threshold,
            },
          )}{' '}
          {settings.approvals_required === 0
            ? t('An admin approves requests alone.')
            : t(
                settings.approvals_required === 1
                  ? '{count} approval is needed.'
                  : '{count} approvals are needed.',
                { count: settings.approvals_required },
              )}{' '}
          {t(
            'Ratings and vendor documents are visible to the admin and committee only.',
          )}
        </p>
      </header>
      {workspace.expense_enabled ? null : (
        <Banner tone="info">
          {t(
            'Expenses is off, so approved requests do not create expense drafts.',
          )}
        </Banner>
      )}
      <Card
        title={t('Purchase requests')}
        description={t('Draft, submitted and decided requests, newest first.')}
      >
        <RequestList workspace={workspace} />
      </Card>
      <Card title={t('New purchase request')}>
        <PurchaseRequestForm
          request={null}
          actions={actions}
          onSaved={(id) => router.push(`${VENDOR_BASE_HREF}/requests/${id}`)}
        />
      </Card>
      <Card title={t('Vendors')}>
        <VendorList workspace={workspace} />
      </Card>
      {workspace.can_manage ? (
        <>
          <Card title={t('Add a vendor')}>
            <VendorForm
              vendor={null}
              actions={actions}
              onSaved={(id) => router.push(`${VENDOR_BASE_HREF}/${id}`)}
            />
          </Card>
          <Card
            title={t('Approval settings')}
            description={t('Changes apply to requests submitted from now on.')}
          >
            <SettingsForm workspace={workspace} actions={actions} />
          </Card>
        </>
      ) : null}
    </section>
  );
}
