// Provide charge configuration and confirmed, audited payment-detail changes.
'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import type { z } from 'zod';
import {
  saveBillingChargeAction,
  updateBillingSettingsAction,
  updateBillingPaymentDetailsAction,
} from '@/app/(admin)/admin/billing/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  billingSettingsSchema,
  chargeFormSchema,
  paymentDetailsInputSchema,
  rupeesFromPaise,
  type BillingSettings,
  type BillingInterestSettings,
  type ChargeType,
  type PaymentDetails,
} from '@/core/billing/validation';
import { BillingInterestSettings as InterestSettings } from './interest-settings';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import { billingMoney, billingTimestamp } from './presentation';
import { BillingQrUpload } from './qr-upload';

type ChargeAction = (data: FormData) => Promise<ServerActionResult<ChargeType>>;
type PaymentAction = (
  data: FormData,
) => Promise<ServerActionResult<PaymentDetails>>;
type SettingsAction = (data: FormData) => Promise<
  ServerActionResult<{
    settings: z.infer<typeof billingSettingsSchema>;
    updated_at: string;
  }>
>;
type SetupTab = 'charge-types' | 'payment-settings';

const methodLabels = {
  fixed: 'Fixed per unit',
  per_sqft: 'Per square foot',
  custom: 'Custom per unit',
  percent_of_charge: 'Percentage of Maintenance',
} as const;
const eligibilityLabels = {
  all: 'All units',
  owner: 'Owner-occupied',
  tenant: 'Tenant-occupied',
} as const;

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function ActionMessage({
  result,
}: {
  result: ServerActionResult<unknown> | null;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (!result) return null;
  return (
    <Banner tone={result.ok ? 'success' : 'danger'}>
      <p>{result.message ? translateFeedback(result.message) : null}</p>
      {!result.ok && result.fieldErrors ? (
        <ul className="mt-space-2 list-inside list-disc">
          {Object.entries(result.fieldErrors).map(([field, message]) => (
            <li key={field}>{translateFeedback(message)}</li>
          ))}
        </ul>
      ) : null}
      {!result.ok && result.code === 'CONFLICT' ? (
        <p>
          {t(
            'These details changed or the charge name already exists. Refresh and review before saving again.',
          )}
        </p>
      ) : null}
      {!result.ok && result.referenceId ? (
        <p>
          {t('Reference ID')}: <code>{result.referenceId}</code>
        </p>
      ) : null}
    </Banner>
  );
}

function validationResult(error: z.ZodError): ServerActionResult<never> {
  return {
    ok: false,
    code: 'VALIDATION_FAILED',
    message: 'Check the highlighted details before saving.',
    fieldErrors: Object.fromEntries(
      error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  };
}

function ChargeForm({
  action,
  charge,
  charges,
  onDirtyChange,
  onPendingChange,
  onSaved,
}: {
  action: ChargeAction;
  charge: ChargeType | null;
  charges: ChargeType[];
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onSaved: () => void;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const [method, setMethod] = useState<ChargeType['method']>(
    charge?.method ?? 'fixed',
  );
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const feedbackRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const input = {
      id: charge?.id ?? null,
      name: data.get('name'),
      method,
      amountRupees: data.get('amountRupees') ?? '',
      eligibility: data.get('eligibility'),
      percentRate: data.get('percentRate') ?? '',
      baseChargeTypeId: data.get('baseChargeTypeId') || null,
      active: data.get('active') === 'on',
      expectedUpdatedAt: charge?.updated_at ?? null,
    };
    const parsed = chargeFormSchema.safeParse(input);
    if (!parsed.success) {
      setResult(validationResult(parsed.error));
      requestAnimationFrame(() => feedbackRef.current?.focus());
      return;
    }
    data.set('id', charge?.id ?? '');
    data.set('expectedUpdatedAt', charge?.updated_at ?? '');
    data.set('method', method);
    data.set('amountRupees', String(input.amountRupees));
    data.set('active', String(input.active));
    onPendingChange(true);
    startTransition(async () => {
      try {
        const next = await action(data);
        setResult(next);
        if (next.ok) onSaved();
        else requestAnimationFrame(() => feedbackRef.current?.focus());
      } catch {
        setResult({
          ok: false,
          code: 'INTEGRATION_FAILED',
          message:
            'Could not reach the server. Your charge details remain here; reconnect and retry.',
        });
        requestAnimationFrame(() => feedbackRef.current?.focus());
      } finally {
        onPendingChange(false);
      }
    });
  }

  return (
    <form
      className="grid gap-space-4"
      onChange={() => onDirtyChange(true)}
      onSubmit={submit}
    >
      <div ref={feedbackRef} tabIndex={-1}>
        <ActionMessage result={result} />
      </div>
      <fieldset className="grid gap-space-4" disabled={pending}>
        <TextInput
          defaultValue={charge?.name ?? ''}
          error={
            result && !result.ok && result.fieldErrors?.name
              ? translateFeedback(result.fieldErrors.name)
              : undefined
          }
          id="billing-charge-name"
          label={t('Charge name')}
          maxLength={120}
          minLength={2}
          name="name"
          required
        />
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="billing-charge-method"
        >
          {t('Calculation method')}
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            id="billing-charge-method"
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (
                next === 'fixed' ||
                next === 'per_sqft' ||
                next === 'custom' ||
                next === 'percent_of_charge'
              )
                setMethod(next);
            }}
            value={method}
          >
            {Object.entries(methodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-space-1 text-body-strong">
          {t('Apply to')}
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            defaultValue={charge?.eligibility ?? 'all'}
            name="eligibility"
          >
            {Object.entries(eligibilityLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        {method === 'percent_of_charge' ? (
          <>
            <label className="grid gap-space-1 text-body-strong">
              {t('Base charge')}
              <select
                className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                defaultValue={charge?.base_charge_type_id ?? ''}
                name="baseChargeTypeId"
                required
              >
                <option value="">{t('Choose a base charge')}</option>
                {charges
                  .filter(
                    (base) =>
                      base.id !== charge?.id &&
                      base.method !== 'percent_of_charge' &&
                      (base.active || base.id === charge?.base_charge_type_id),
                  )
                  .map((base) => (
                    <option key={base.id} value={base.id}>
                      {base.name}
                    </option>
                  ))}
              </select>
            </label>
            <TextInput
              id="billing-charge-percent"
              name="percentRate"
              label={t('Percentage rate (%)')}
              inputMode="decimal"
              maxLength={6}
              required
              defaultValue={
                charge?.percent_basis_points
                  ? rupeesFromPaise(charge.percent_basis_points)
                  : ''
              }
            />
          </>
        ) : method === 'custom' ? (
          <p className="text-body text-ink-muted">
            {t("Enter each unit's amount when generating bills.")}
          </p>
        ) : (
          <TextInput
            defaultValue={
              charge?.amount_paise ? rupeesFromPaise(charge.amount_paise) : ''
            }
            error={
              result && !result.ok
                ? result.fieldErrors?.amountRupees
                  ? translateFeedback(result.fieldErrors.amountRupees)
                  : undefined
                : undefined
            }
            helpText={t(
              'Use up to two decimal places. Amounts are stored exactly in paise.',
            )}
            id="billing-charge-amount"
            inputMode="decimal"
            label={
              method === 'per_sqft'
                ? t('Rate per square foot (INR)')
                : t('Amount per unit (INR)')
            }
            maxLength={32}
            name="amountRupees"
            required
          />
        )}
        <label className="flex min-h-12 items-center gap-space-2 text-body">
          <input
            defaultChecked={charge?.active ?? true}
            name="active"
            type="checkbox"
          />
          {t('Active for future bill generation')}
        </label>
        <p className="text-caption text-ink-muted">
          {t(
            'Changes apply to future bills only. Published bills are never edited.',
          )}
        </p>
        <Button loading={pending} type="submit">
          {t(charge ? 'Save Charge Type' : 'Create Charge Type')}
        </Button>
      </fieldset>
    </form>
  );
}

function SocietyBillingPreferencesForm({
  action,
  settings,
  settingsAccess,
  settingsUpdatedAt,
  onDirtyChange,
  onSaved,
}: {
  action: SettingsAction;
  settings: BillingSettings;
  settingsAccess: Readonly<Record<string, boolean>>;
  settingsUpdatedAt: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const { locale, translate: t } = useUiTranslator();
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const feedbackRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    data.set('expectedUpdatedAt', settingsUpdatedAt);
    startTransition(async () => {
      try {
        const next = await action(data);
        if (next.ok) {
          setResult(null);
          onDirtyChange(false);
          onSaved(next.message ?? 'Society billing preferences saved.');
        } else {
          setResult(next);
          requestAnimationFrame(() => feedbackRef.current?.focus());
        }
      } catch {
        setResult({
          ok: false,
          code: 'INTEGRATION_FAILED',
          message:
            'Could not reach the server. Your preferences remain here; reconnect and retry.',
        });
        requestAnimationFrame(() => feedbackRef.current?.focus());
      }
    });
  }

  return (
    <form
      className="grid gap-space-4"
      onChange={() => {
        onDirtyChange(true);
      }}
      onSubmit={submit}
    >
      <div ref={feedbackRef} tabIndex={-1}>
        <ActionMessage result={result} />
      </div>
      <fieldset className="grid gap-space-4" disabled={pending}>
        {settingsAccess.due_day_of_month ? (
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="billing-due-day"
          >
            {t('Monthly due date')}
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
              defaultValue={String(settings.due_day_of_month)}
              id="billing-due-day"
              name="dueDay"
            >
              {Array.from({ length: 31 }, (_, index) => {
                const day = index + 1;
                return (
                  <option key={day} value={day}>
                    {locale === 'hi'
                      ? t('Day {day} of each month', { day })
                      : `${ordinal(day)} of each month`}
                  </option>
                );
              })}
              <option value="last_day">{t('Last day of each month')}</option>
            </select>
          </label>
        ) : (
          <input
            name="dueDay"
            type="hidden"
            value={String(settings.due_day_of_month)}
          />
        )}
        {settingsAccess.rounding ? (
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor="billing-rounding"
          >
            {t('Per-square-foot rounding')}
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
              defaultValue={settings.rounding}
              id="billing-rounding"
              name="rounding"
            >
              <option value="rupee">{t('Nearest rupee, half up')}</option>
              <option value="paise">{t('Nearest paise, half up')}</option>
            </select>
          </label>
        ) : (
          <input name="rounding" type="hidden" value={settings.rounding} />
        )}
        {settingsAccess.bill_email_on_publish ? (
          <label
            className="flex items-start gap-space-3 text-body-strong"
            htmlFor="billing-email-on-publish"
          >
            <input
              className="mt-space-1 size-5"
              defaultChecked={settings.bill_email_on_publish}
              id="billing-email-on-publish"
              name="billEmailOnPublish"
              type="checkbox"
              value="true"
            />
            <span className="grid gap-space-1">
              {t('Email bill PDF when published')}
              <span className="text-caption font-normal text-ink-muted">
                {t(
                  'Email the bill summary and PDF to active unit occupants. Failed delivery is never shown as sent.',
                )}
              </span>
            </span>
          </label>
        ) : (
          <input
            name="billEmailOnPublish"
            type="hidden"
            value={String(settings.bill_email_on_publish)}
          />
        )}
        <p className="text-caption text-ink-muted">
          {t(
            "A numeric due day past the end of a shorter month falls on that month's last day. These preferences affect future bills only.",
          )}
        </p>
        <Button loading={pending} type="submit">
          {t('Save Society Preferences')}
        </Button>
      </fieldset>
    </form>
  );
}

function PaymentSettingsForm({
  action,
  details,
  onDirtyChange,
  onSaved,
  societyId,
}: {
  action: PaymentAction;
  details: PaymentDetails | null;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (message: string) => void;
  societyId: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const [qrPath, setQrPath] = useState(details?.qr_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<FormData | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading || uploadError) return;
    const data = new FormData(event.currentTarget);
    const parsed = paymentDetailsInputSchema.safeParse({
      upiId: data.get('upiId'),
      payeeName: data.get('payeeName'),
      qrPath,
      expectedUpdatedAt: details?.updated_at ?? null,
    });
    if (!parsed.success) {
      setResult(validationResult(parsed.error));
      requestAnimationFrame(() => feedbackRef.current?.focus());
      return;
    }
    data.set('qrPath', qrPath ?? '');
    data.set('expectedUpdatedAt', details?.updated_at ?? '');
    setConfirmation(data);
  }

  function save() {
    if (!confirmation || pending) return;
    const data = confirmation;
    startTransition(async () => {
      try {
        const next = await action(data);
        if (next.ok) {
          setResult(null);
          setConfirmation(null);
          onDirtyChange(false);
          onSaved(next.message ?? 'Payment details saved.');
        } else {
          setResult(next);
          setConfirmation(null);
          requestAnimationFrame(() => feedbackRef.current?.focus());
        }
      } catch {
        setConfirmation(null);
        setResult({
          ok: false,
          code: 'INTEGRATION_FAILED',
          message:
            'Could not reach the server. The save may have completed; refresh and review before retrying. Your entered details remain here.',
        });
        requestAnimationFrame(() => feedbackRef.current?.focus());
      }
    });
  }

  return (
    <>
      <form
        className="grid gap-space-4"
        onChange={() => onDirtyChange(true)}
        onSubmit={submit}
      >
        <div ref={feedbackRef} tabIndex={-1}>
          <ActionMessage result={result} />
        </div>
        <fieldset
          className="grid gap-space-4"
          disabled={pending || confirmation !== null}
        >
          <TextInput
            autoCapitalize="none"
            autoComplete="off"
            defaultValue={details?.upi_id ?? ''}
            error={
              result && !result.ok && result.fieldErrors?.upiId
                ? translateFeedback(result.fieldErrors.upiId)
                : undefined
            }
            helpText={t(
              'Format: name@handle, for example society@bank. Check the account in your banking app.',
            )}
            id="billing-upi-id"
            label={t('Society UPI ID')}
            maxLength={100}
            minLength={5}
            name="upiId"
            required
            spellCheck={false}
          />
          <TextInput
            defaultValue={details?.payee_name ?? ''}
            error={
              result && !result.ok && result.fieldErrors?.payeeName
                ? translateFeedback(result.fieldErrors.payeeName)
                : undefined
            }
            id="billing-payee-name"
            label={t('Payee name')}
            maxLength={100}
            minLength={2}
            name="payeeName"
            required
          />
          <BillingQrUpload
            initialPath={details?.qr_path ?? null}
            onChange={(path) => {
              setQrPath(path);
              onDirtyChange(true);
            }}
            onErrorChange={setUploadError}
            onUploadingChange={(active) => {
              setUploading(active);
              if (active) onDirtyChange(true);
            }}
            societyId={societyId}
          />
          <Button
            disabled={uploading || uploadError}
            loading={pending || uploading}
            type="submit"
          >
            {t('Review Payment Details')}
          </Button>
        </fieldset>
      </form>
      <ConfirmDialog
        actionLabel={t('Save Payment Details')}
        description={
          <div className="grid gap-space-2">
            <p>
              {t(
                'Residents will pay this society account directly. Check the UPI ID, payee name and QR image carefully.',
              )}
            </p>
            <p className="break-all font-semibold">
              {String(confirmation?.get('upiId') ?? '')}
            </p>
            <p>{String(confirmation?.get('payeeName') ?? '')}</p>
            <p>
              {t(
                'Every change is recorded. All administrators and committee members will be notified.',
              )}
            </p>
          </div>
        }
        id="billing-payment-details-confirm"
        loading={pending}
        onConfirm={save}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        open={confirmation !== null}
        title={t('Change society payment details?')}
        variant="primary"
      />
    </>
  );
}

export type BillingSetupProps = {
  canManage: boolean;
  charges: ChargeType[];
  paymentDetails: PaymentDetails | null;
  pendingQrPaths: string[];
  qrUrl: string | null;
  settings: BillingSettings;
  settingsAccess?: Readonly<Record<string, boolean>>;
  settingsUpdatedAt: string;
  interest: BillingInterestSettings;
  societyId: string;
  suspended: boolean;
  timezone: string;
  chargeAction?: ChargeAction;
  embedded?: boolean;
  paymentAction?: PaymentAction;
  settingsAction?: SettingsAction;
};

export function BillingSetup({
  canManage,
  charges,
  paymentDetails,
  pendingQrPaths,
  qrUrl,
  settings,
  settingsAccess = {
    due_day_of_month: true,
    rounding: true,
    bill_email_on_publish: true,
  },
  settingsUpdatedAt,
  interest,
  societyId,
  suspended,
  timezone,
  chargeAction = saveBillingChargeAction,
  embedded = false,
  paymentAction = updateBillingPaymentDetailsAction,
  settingsAction = updateBillingSettingsAction,
}: BillingSetupProps) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: SetupTab =
    searchParams.get('tab') === 'payment-settings'
      ? 'payment-settings'
      : 'charge-types';
  const [editing, setEditing] = useState<ChargeType | null | undefined>(
    undefined,
  );
  const [dirty, setDirty] = useState(false);
  const [chargeDirty, setChargeDirty] = useState(false);
  const [chargePending, setChargePending] = useState(false);
  const [discardCharge, setDiscardCharge] = useState(false);
  const [navigation, setNavigation] = useState<{
    href: string;
    replace: boolean;
  } | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [cleanupPath, setCleanupPath] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | undefined>();
  const [cleaning, startCleanup] = useTransition();

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty && !chargeDirty) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function beforeLink(event: MouseEvent) {
      if (
        !dirty ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const target = event.target;
      const anchor = target instanceof Element ? target.closest('a') : null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      if (!['http:', 'https:'].includes(url.protocol)) return;
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      event.preventDefault();
      event.stopPropagation();
      setNavigation({
        href:
          url.origin === location.origin
            ? `${url.pathname}${url.search}${url.hash}`
            : url.href,
        replace: false,
      });
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', beforeLink, true);
    };
  }, [chargeDirty, dirty]);

  function changeTab(id: string) {
    if (id !== 'charge-types' && id !== 'payment-settings') return;
    if (id === tab) return;
    const query = new URLSearchParams(searchParams);
    query.set('tab', id);
    const href = `${pathname}?${query.toString()}`;
    if (dirty) {
      setNavigation({ href, replace: true });
      return;
    }
    router.replace(href, { scroll: false });
  }

  function removeUnusedQr() {
    if (!cleanupPath) return;
    const path = cleanupPath;
    setCleanupError(undefined);
    startCleanup(async () => {
      try {
        const response = await fetch('/api/files/upload-url', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bucket: 'society-assets', path }),
        });
        if (!response.ok)
          throw new Error(
            'The unused QR image could not be removed. It may now be in use; refresh and review.',
          );
        setCleanupPath(null);
        router.refresh();
      } catch {
        setCleanupError(
          'The unused QR image could not be removed. Check your connection, then refresh and review before retrying.',
        );
      }
    });
  }

  const chargesPanel = (
    <>
      <Card
        description={t(
          'Configure charges before generating bills. Deactivating a charge keeps its history.',
        )}
        title={t('Charge types')}
      >
        {savedMessage ? (
          <Banner tone="success">{translateFeedback(savedMessage)}</Banner>
        ) : null}
        {canManage ? (
          <div className="mb-space-4 flex flex-wrap gap-space-2">
            <Button onClick={() => setEditing(null)}>
              {t('Add Charge Type')}
            </Button>
            <Button
              onClick={() => router.push('/admin/billing/generate')}
              variant="secondary"
            >
              {t('Generate Bills')}
            </Button>
          </div>
        ) : null}
        {charges.length ? (
          <ul className="grid gap-space-3">
            {charges.map((charge) => (
              <li
                className="flex flex-wrap items-center justify-between gap-space-3 rounded-md border border-rule p-space-4"
                key={charge.id}
              >
                <div className="grid min-w-0 gap-space-1">
                  <h3 className="break-words text-body-strong">
                    {charge.name}
                  </h3>
                  <p className="text-caption text-ink-muted">
                    {t(methodLabels[charge.method])}
                    {charge.percent_basis_points !== null
                      ? ` (${rupeesFromPaise(charge.percent_basis_points)}%)`
                      : ''}
                    {charge.amount_paise !== null
                      ? ` - ${locale === 'hi' ? billingMoney(charge.amount_paise, locale) : `INR ${rupeesFromPaise(charge.amount_paise)}`}`
                      : ''}
                  </p>
                  <p className="text-caption">
                    <span>{t(charge.active ? 'Active' : 'Inactive')}</span> ·{' '}
                    <span>{t(eligibilityLabels[charge.eligibility])}</span>
                  </p>
                </div>
                {canManage ? (
                  <Button
                    aria-label={t('Edit {name}', { name: charge.name })}
                    onClick={() => setEditing(charge)}
                    variant="secondary"
                  >
                    {t('Edit')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t(
              "No charge types yet. An administrator can add the society's first charge.",
            )}
          </p>
        )}
      </Card>
      <InterestSettings interest={interest} />
    </>
  );

  const paymentPanel = (
    <Card
      description={t(
        'Residents pay the society directly. Homeish never receives or holds the money.',
      )}
      title={t('Payment settings')}
    >
      {paymentMessage ? (
        <Banner tone="success">{translateFeedback(paymentMessage)}</Banner>
      ) : null}
      {paymentDetails ? (
        <div className="mb-space-4 grid gap-space-2">
          <p className="break-all text-body-strong">{paymentDetails.upi_id}</p>
          <p className="text-body">{paymentDetails.payee_name}</p>
          <p className="text-caption text-ink-muted">
            {t('UPI details last changed on')}{' '}
            <time dateTime={paymentDetails.updated_at}>
              {billingTimestamp(paymentDetails.updated_at, timezone, locale)}
            </time>{' '}
            {t('by {name}', { name: paymentDetails.updated_by_name })}
          </p>
          {qrUrl ? (
            <Image
              alt={t('Society UPI QR image')}
              className="size-48 rounded-md border border-rule object-contain p-space-2"
              height={192}
              src={qrUrl}
              unoptimized
              width={192}
            />
          ) : null}
        </div>
      ) : (
        <p className="mb-space-4 text-body text-ink-muted">
          {t(
            'The society has not added payment details. Do not send money until an administrator configures and verifies the account.',
          )}
        </p>
      )}
      {canManage ? (
        <PaymentSettingsForm
          action={paymentAction}
          details={paymentDetails}
          key={paymentDetails?.updated_at ?? 'new'}
          onDirtyChange={(value) => {
            setDirty(value);
            if (value) setPaymentMessage(null);
          }}
          onSaved={(message) => {
            setPaymentMessage(message);
            router.refresh();
          }}
          societyId={societyId}
        />
      ) : null}
      {canManage && pendingQrPaths.length > 0 ? (
        <div className="mt-space-4 grid gap-space-2">
          <p className="text-caption text-ink-muted">
            {t(
              'Unattached QR uploads are not used for payments. Remove an unused upload before uploading another.',
            )}
          </p>
          {pendingQrPaths.map((path, index) => (
            <Button
              key={path}
              onClick={() => {
                setCleanupError(undefined);
                setCleanupPath(path);
              }}
              variant="secondary"
            >
              {t('Remove Unused QR Image {number}', { number: index + 1 })}
            </Button>
          ))}
        </div>
      ) : null}
    </Card>
  );

  const rulesPanel = (
    <>
      <Card
        description={t(
          'Configured by the platform developer. These rules will apply when bills and reminders are processed.',
        )}
        title={t('Billing rules')}
      >
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="inline font-semibold">{t('Grace period')}: </dt>
            <dd className="inline">
              {t(settings.grace_days === 1 ? '{count} day' : '{count} days', {
                count: settings.grace_days,
              })}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t('Late fee')}: </dt>
            <dd className="inline">
              {settings.late_fee
                ? settings.late_fee.type === 'flat'
                  ? locale === 'hi'
                    ? billingMoney(settings.late_fee.value, locale)
                    : `INR ${rupeesFromPaise(settings.late_fee.value)}`
                  : `${settings.late_fee.value}%`
                : t('Off')}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t('Reminders')}: </dt>
            <dd className="inline">
              {t(
                '{before} days before due, {onDue}then every {after} days overdue',
                {
                  before: settings.reminders.before_due_days,
                  onDue: settings.reminders.on_due
                    ? t('on the due date, ')
                    : '',
                  after: settings.reminders.overdue_every_days,
                },
              )}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t('Review alert')}: </dt>
            <dd className="inline">
              {t('After {count} days awaiting confirmation', {
                count: settings.pending_confirmation_alert_days,
              })}
            </dd>
          </div>
        </dl>
      </Card>
      <Card
        description={t(
          'Choose when future bills are due and how per-square-foot charges are rounded.',
        )}
        title={t('Society billing preferences')}
      >
        {settingsMessage ? (
          <Banner tone="success">{translateFeedback(settingsMessage)}</Banner>
        ) : null}
        {canManage &&
        Object.values(settingsAccess).some((allowed) => allowed) ? (
          <SocietyBillingPreferencesForm
            action={settingsAction}
            key={settingsUpdatedAt}
            onDirtyChange={setDirty}
            onSaved={(message) => {
              setSettingsMessage(message);
              router.refresh();
            }}
            settings={settings}
            settingsAccess={settingsAccess}
            settingsUpdatedAt={settingsUpdatedAt}
          />
        ) : (
          <dl className="grid gap-space-2 text-body">
            <div>
              <dt className="inline font-semibold">
                {t('Monthly due date')}:{' '}
              </dt>
              <dd className="inline">
                {settings.due_day_of_month === 'last_day'
                  ? t('Last day of each month')
                  : t('Day {day} of each month', {
                      day: settings.due_day_of_month,
                    })}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">
                {t('Per-square-foot rounding')}:{' '}
              </dt>
              <dd className="inline">
                {t(
                  settings.rounding === 'rupee'
                    ? 'Nearest rupee, half up'
                    : 'Nearest paise, half up',
                )}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">
                {t('Email bill PDF when published')}:{' '}
              </dt>
              <dd className="inline">
                {settings.bill_email_on_publish ? t('Enabled') : t('Disabled')}
              </dd>
            </div>
          </dl>
        )}
      </Card>
    </>
  );

  return (
    <section className="grid gap-space-5">
      {embedded ? null : (
        <>
          <header className="grid gap-space-2">
            <h1 className="text-title font-semibold">{t('Billing setup')}</h1>
            <p className="text-body text-ink-muted">
              {t("Manage charge types and the society's payment details.")}
            </p>
          </header>
          {!canManage ? (
            <Banner tone="info">
              {t(
                suspended
                  ? 'This society is suspended. Billing information is read-only.'
                  : 'Read-only access. Only administrators can change billing setup.',
              )}
            </Banner>
          ) : null}
        </>
      )}
      {embedded ? (
        tab === 'payment-settings' ? (
          paymentPanel
        ) : (
          <>
            {chargesPanel}
            {rulesPanel}
          </>
        )
      ) : (
        <>
          {' '}
          <Tabs
            items={[
              {
                id: 'charge-types',
                label: t('Charge Types'),
                panel: chargesPanel,
              },
              {
                id: 'payment-settings',
                label: t('Payment Settings'),
                panel: paymentPanel,
              },
            ]}
            label={t('Billing setup')}
            onChange={changeTab}
            value={tab}
          />
          {rulesPanel}
        </>
      )}
      <Dialog
        closeDisabled={chargePending}
        id="billing-charge-edit"
        onOpenChange={(open) => {
          if (!open) {
            if (chargeDirty) setDiscardCharge(true);
            else setEditing(undefined);
          }
        }}
        open={editing !== undefined}
        title={t(editing ? 'Edit charge type' : 'Add charge type')}
      >
        {editing !== undefined ? (
          <ChargeForm
            action={chargeAction}
            charge={editing}
            charges={charges}
            key={editing?.id ?? 'new'}
            onDirtyChange={setChargeDirty}
            onPendingChange={setChargePending}
            onSaved={() => {
              setChargeDirty(false);
              setEditing(undefined);
              setSavedMessage(
                'Charge type saved. Published bills are unchanged.',
              );
              router.refresh();
            }}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        actionLabel={t('Leave Without Saving')}
        description={t('Your payment-setting changes will be discarded.')}
        id="billing-leave-unsaved"
        onConfirm={() => {
          if (navigation) {
            setDirty(false);
            if (navigation.replace)
              router.replace(navigation.href, { scroll: false });
            else router.push(navigation.href);
            setNavigation(null);
          }
        }}
        onOpenChange={(open) => {
          if (!open) setNavigation(null);
        }}
        open={navigation !== null}
        title={t('Leave without saving?')}
      />
      <ConfirmDialog
        actionLabel={t('Discard Changes')}
        description={t('Your unsaved charge-type changes will be discarded.')}
        id="billing-charge-discard"
        onConfirm={() => {
          setChargeDirty(false);
          setDiscardCharge(false);
          setEditing(undefined);
        }}
        onOpenChange={setDiscardCharge}
        open={discardCharge}
        title={t('Discard charge changes?')}
      />
      <ConfirmDialog
        actionLabel={t('Remove Unused Image')}
        description={t(
          'This removes an image that is not saved in the current society payment settings. Another administrator may still be preparing it.',
        )}
        error={cleanupError ? translateFeedback(cleanupError) : undefined}
        id="billing-qr-cleanup"
        loading={cleaning}
        onConfirm={removeUnusedQr}
        onOpenChange={(open) => {
          if (!open) setCleanupPath(null);
        }}
        open={cleanupPath !== null}
        title={t('Remove unused QR image?')}
      />
    </section>
  );
}
