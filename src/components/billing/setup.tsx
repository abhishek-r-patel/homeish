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
  type ChargeType,
  type PaymentDetails,
} from '@/core/billing/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { TextInput } from '@/components/ui/text-input';
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
  if (!result) return null;
  return (
    <Banner tone={result.ok ? 'success' : 'danger'}>
      <p>{result.message}</p>
      {!result.ok && result.fieldErrors ? (
        <ul className="mt-space-2 list-inside list-disc">
          {Object.entries(result.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      ) : null}
      {!result.ok && result.code === 'CONFLICT' ? (
        <p>
          These details changed or the charge name already exists. Refresh and
          review before saving again.
        </p>
      ) : null}
      {!result.ok && result.referenceId ? (
        <p>
          Reference ID: <code>{result.referenceId}</code>
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
  onDirtyChange,
  onPendingChange,
  onSaved,
}: {
  action: ChargeAction;
  charge: ChargeType | null;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onSaved: () => void;
}) {
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
      amountRupees: method === 'custom' ? '' : data.get('amountRupees'),
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
    data.set(
      'amountRupees',
      method === 'custom' ? '' : String(data.get('amountRupees')),
    );
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
          error={result && !result.ok ? result.fieldErrors?.name : undefined}
          id="billing-charge-name"
          label="Charge name"
          maxLength={120}
          minLength={2}
          name="name"
          required
        />
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="billing-charge-method"
        >
          Calculation method
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            id="billing-charge-method"
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (next === 'fixed' || next === 'per_sqft' || next === 'custom')
                setMethod(next);
            }}
            value={method}
          >
            {Object.entries(methodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {method === 'custom' ? (
          <p className="text-body text-ink-muted">
            Enter each unit&apos;s amount when generating bills.
          </p>
        ) : (
          <TextInput
            defaultValue={
              charge?.amount_paise ? rupeesFromPaise(charge.amount_paise) : ''
            }
            error={
              result && !result.ok
                ? result.fieldErrors?.amountRupees
                : undefined
            }
            helpText="Use up to two decimal places. Amounts are stored exactly in paise."
            id="billing-charge-amount"
            inputMode="decimal"
            label={
              method === 'per_sqft'
                ? 'Rate per square foot (INR)'
                : 'Amount per unit (INR)'
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
          Active for future bill generation
        </label>
        <p className="text-caption text-ink-muted">
          Changes apply to future bills only. Published bills are never edited.
        </p>
        <Button loading={pending} type="submit">
          {charge ? 'Save Charge Type' : 'Create Charge Type'}
        </Button>
      </fieldset>
    </form>
  );
}

function SocietyBillingPreferencesForm({
  action,
  settings,
  settingsUpdatedAt,
  onDirtyChange,
  onSaved,
}: {
  action: SettingsAction;
  settings: BillingSettings;
  settingsUpdatedAt: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (message: string) => void;
}) {
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
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="billing-due-day"
        >
          Monthly due date
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
                  {ordinal(day)} of each month
                </option>
              );
            })}
            <option value="last_day">Last day of each month</option>
          </select>
        </label>
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="billing-rounding"
        >
          Per-square-foot rounding
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            defaultValue={settings.rounding}
            id="billing-rounding"
            name="rounding"
          >
            <option value="rupee">Nearest rupee, half up</option>
            <option value="paise">Nearest paise, half up</option>
          </select>
        </label>
        <p className="text-caption text-ink-muted">
          A numeric due day past the end of a shorter month falls on that
          month&apos;s last day. These preferences affect future bills only.
        </p>
        <Button loading={pending} type="submit">
          Save Society Preferences
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
            error={result && !result.ok ? result.fieldErrors?.upiId : undefined}
            helpText="Format: name@handle, for example society@bank. Check the account in your banking app."
            id="billing-upi-id"
            label="Society UPI ID"
            maxLength={100}
            minLength={5}
            name="upiId"
            required
            spellCheck={false}
          />
          <TextInput
            defaultValue={details?.payee_name ?? ''}
            error={
              result && !result.ok ? result.fieldErrors?.payeeName : undefined
            }
            id="billing-payee-name"
            label="Payee name"
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
            Review Payment Details
          </Button>
        </fieldset>
      </form>
      <ConfirmDialog
        actionLabel="Save Payment Details"
        description={
          <div className="grid gap-space-2">
            <p>
              Residents will pay this society account directly. Check the UPI
              ID, payee name and QR image carefully.
            </p>
            <p className="break-all font-semibold">
              {String(confirmation?.get('upiId') ?? '')}
            </p>
            <p>{String(confirmation?.get('payeeName') ?? '')}</p>
            <p>
              Every change is recorded. All administrators and committee members
              will be notified.
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
        title="Change society payment details?"
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
  settingsUpdatedAt: string;
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
  settingsUpdatedAt,
  societyId,
  suspended,
  timezone,
  chargeAction = saveBillingChargeAction,
  embedded = false,
  paymentAction = updateBillingPaymentDetailsAction,
  settingsAction = updateBillingSettingsAction,
}: BillingSetupProps) {
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
    <Card
      description="Configure charges before generating bills. Deactivating a charge keeps its history."
      title="Charge types"
    >
      {savedMessage ? <Banner tone="success">{savedMessage}</Banner> : null}
      {canManage ? (
        <div className="mb-space-4 flex flex-wrap gap-space-2">
          <Button onClick={() => setEditing(null)}>Add Charge Type</Button>
          <Button
            onClick={() => router.push('/admin/billing/generate')}
            variant="secondary"
          >
            Generate Bills
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
                <h3 className="break-words text-body-strong">{charge.name}</h3>
                <p className="text-caption text-ink-muted">
                  {methodLabels[charge.method]}
                  {charge.amount_paise !== null
                    ? ` - INR ${rupeesFromPaise(charge.amount_paise)}`
                    : ''}
                </p>
                <p className="text-caption">
                  {charge.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              {canManage ? (
                <Button
                  aria-label={`Edit ${charge.name}`}
                  onClick={() => setEditing(charge)}
                  variant="secondary"
                >
                  Edit
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-muted">
          No charge types yet. An administrator can add the society&apos;s first
          charge.
        </p>
      )}
    </Card>
  );

  const paymentPanel = (
    <Card
      description="Residents pay the society directly. Homeish never receives or holds the money."
      title="Payment settings"
    >
      {paymentMessage ? <Banner tone="success">{paymentMessage}</Banner> : null}
      {paymentDetails ? (
        <div className="mb-space-4 grid gap-space-2">
          <p className="break-all text-body-strong">{paymentDetails.upi_id}</p>
          <p className="text-body">{paymentDetails.payee_name}</p>
          <p className="text-caption text-ink-muted">
            UPI details last changed on{' '}
            <time dateTime={paymentDetails.updated_at}>
              {new Intl.DateTimeFormat('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: timezone,
              }).format(new Date(paymentDetails.updated_at))}
            </time>{' '}
            by {paymentDetails.updated_by_name}
          </p>
          {qrUrl ? (
            <Image
              alt="Society UPI QR image"
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
          The society has not added payment details. Do not send money until an
          administrator configures and verifies the account.
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
            Unattached QR uploads are not used for payments. Remove an unused
            upload before uploading another.
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
              Remove Unused QR Image {index + 1}
            </Button>
          ))}
        </div>
      ) : null}
    </Card>
  );

  const rulesPanel = (
    <>
      <Card
        description="Configured by the platform developer. These rules will apply when bills and reminders are processed."
        title="Billing rules"
      >
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="inline font-semibold">Grace period: </dt>
            <dd className="inline">{settings.grace_days} days</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Late fee: </dt>
            <dd className="inline">
              {settings.late_fee
                ? settings.late_fee.type === 'flat'
                  ? `INR ${rupeesFromPaise(settings.late_fee.value)}`
                  : `${settings.late_fee.value}%`
                : 'Off'}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Reminders: </dt>
            <dd className="inline">
              {settings.reminders.before_due_days} days before due,{' '}
              {settings.reminders.on_due ? 'on the due date, ' : ''}then every{' '}
              {settings.reminders.overdue_every_days} days overdue
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Review alert: </dt>
            <dd className="inline">
              After {settings.pending_confirmation_alert_days} days awaiting
              confirmation
            </dd>
          </div>
        </dl>
      </Card>
      <Card
        description="Choose when future bills are due and how per-square-foot charges are rounded."
        title="Society billing preferences"
      >
        {settingsMessage ? (
          <Banner tone="success">{settingsMessage}</Banner>
        ) : null}
        {canManage ? (
          <SocietyBillingPreferencesForm
            action={settingsAction}
            key={settingsUpdatedAt}
            onDirtyChange={setDirty}
            onSaved={(message) => {
              setSettingsMessage(message);
              router.refresh();
            }}
            settings={settings}
            settingsUpdatedAt={settingsUpdatedAt}
          />
        ) : (
          <dl className="grid gap-space-2 text-body">
            <div>
              <dt className="inline font-semibold">Monthly due date: </dt>
              <dd className="inline">
                {settings.due_day_of_month === 'last_day'
                  ? 'Last day of each month'
                  : `Day ${settings.due_day_of_month} of each month`}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">
                Per-square-foot rounding:{' '}
              </dt>
              <dd className="inline">Nearest {settings.rounding}, half up</dd>
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
            <h1 className="text-title font-semibold">Billing setup</h1>
            <p className="text-body text-ink-muted">
              Manage charge types and the society&apos;s payment details.
            </p>
          </header>
          {!canManage ? (
            <Banner tone="info">
              {suspended
                ? 'This society is suspended. Billing information is read-only.'
                : 'Read-only access. Only administrators can change billing setup.'}
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
                label: 'Charge Types',
                panel: chargesPanel,
              },
              {
                id: 'payment-settings',
                label: 'Payment Settings',
                panel: paymentPanel,
              },
            ]}
            label="Billing setup"
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
        title={editing ? 'Edit charge type' : 'Add charge type'}
      >
        {editing !== undefined ? (
          <ChargeForm
            action={chargeAction}
            charge={editing}
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
        actionLabel="Leave Without Saving"
        description="Your payment-setting changes will be discarded."
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
        title="Leave without saving?"
      />
      <ConfirmDialog
        actionLabel="Discard Changes"
        description="Your unsaved charge-type changes will be discarded."
        id="billing-charge-discard"
        onConfirm={() => {
          setChargeDirty(false);
          setDiscardCharge(false);
          setEditing(undefined);
        }}
        onOpenChange={setDiscardCharge}
        open={discardCharge}
        title="Discard charge changes?"
      />
      <ConfirmDialog
        actionLabel="Remove Unused Image"
        description="This removes an image that is not saved in the current society payment settings. Another administrator may still be preparing it."
        error={cleanupError}
        id="billing-qr-cleanup"
        loading={cleaning}
        onConfirm={removeUnusedQr}
        onOpenChange={(open) => {
          if (!open) setCleanupPath(null);
        }}
        open={cleanupPath !== null}
        title="Remove unused QR image?"
      />
    </section>
  );
}
