// Accessible forms and confirmations for the developer console.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import {
  createFirstAdminAction,
  createSocietyAction,
  setErrorStatusAction,
  setSocietyStatusAction,
  toggleModuleAction,
  updateModuleSettingAccessAction,
  updateModuleSettingsAction,
  updateQuickActionDefaultsAction,
  updateSocietyAction,
  resetQuickActionDefaultsAction,
  saveDeveloperOnboardingAction,
  setDeveloperFeatureRequestStatusAction,
  setResidentsJoinedPercentAction,
  deleteWebsiteEnquiryAction,
  handleWebsiteEnquiryAction,
  saveDeveloperWebsiteSettingsAction,
} from '@/app/developer/actions';
import type { DeveloperActionResult } from '@/core/developer/console';
import type { Database } from '@/core/db/database.types';
import { MODULE_KEYS, type ModuleKey } from '@/core/modules';
import {
  societyStatusSchema,
  type DeveloperSocietyStatus,
} from '@/core/developer/status';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { SocietyLogoUpload } from './society-logo-upload';
import { QUICK_ACTIONS, type QuickActionKey } from '@/core/home/quick-actions';
import type { SocietyRole } from '@/core/permissions';

type SocietyRow = Omit<
  Database['public']['Tables']['societies']['Row'],
  'join_code' | 'slug'
>;

function ActionMessage({ state }: { state: DeveloperActionResult | null }) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? 'success' : 'danger'}>
      <p>{state.message ?? 'Could not complete the request.'}</p>
      {!state.ok && state.referenceId ? (
        <p className="mt-space-2 text-caption">
          Reference ID: <code>{state.referenceId}</code>
        </p>
      ) : null}
      {!state.ok && state.fieldErrors ? (
        <ul className="mt-space-2 list-inside list-disc text-caption">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>
              {field === 'form' ? message : `${field}: ${message}`}
            </li>
          ))}
        </ul>
      ) : null}
    </Banner>
  );
}

export function SocietyForm({
  initial,
  successHref,
}: {
  initial?: SocietyRow;
  successHref?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const isEditing = initial !== undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadingLogo) return;
    const formData = new FormData(event.currentTarget);
    setState(null);
    startTransition(async () => {
      const result = isEditing
        ? await updateSocietyAction(formData)
        : await createSocietyAction(formData);
      setState(result);
      if (result.ok) {
        if (successHref) router.push(successHref);
        else router.refresh();
      }
    });
  }

  return (
    <form className="grid gap-space-5" onSubmit={submit}>
      {initial ? (
        <input name="societyId" type="hidden" value={initial.id} />
      ) : null}
      <ActionMessage state={state} />
      {initial ? (
        <SocietyLogoUpload
          initialPath={initial.logo_path}
          onUploadingChange={setUploadingLogo}
          societyId={initial.id}
        />
      ) : null}
      <TextInput
        autoComplete="organization"
        defaultValue={initial?.name ?? ''}
        id="society-name"
        label="Society name"
        maxLength={120}
        minLength={2}
        name="name"
        required
      />
      <TextInput
        autoComplete="street-address"
        defaultValue={initial?.address ?? ''}
        id="society-address"
        label="Address"
        maxLength={120}
        name="address"
      />
      <TextInput
        autoComplete="address-level2"
        defaultValue={initial?.city ?? ''}
        id="society-city"
        label="City"
        maxLength={120}
        name="city"
      />
      <TextInput
        autoComplete="email"
        defaultValue={initial?.contact_email ?? ''}
        id="society-contact-email"
        label="Contact email"
        maxLength={254}
        name="contactEmail"
        type="email"
      />
      <TextInput
        autoComplete="tel"
        defaultValue={initial?.contact_phone ?? ''}
        id="society-contact-phone"
        label="Contact phone"
        maxLength={16}
        name="contactPhone"
        pattern="^\+?[0-9]{10,15}$"
        type="tel"
      />
      <p className="text-body">Time zone: India Standard Time (IST)</p>
      <TextInput
        defaultValue={initial?.currency ?? 'INR'}
        id="society-currency"
        label="Currency code"
        maxLength={3}
        minLength={3}
        name="currency"
        pattern="[A-Z]{3}"
        required
      />
      <TextInput
        defaultValue={initial?.unit_label ?? 'Unit'}
        id="society-unit-label"
        label="Unit label"
        helpText="Use 1–24 letters or spaces, for example Flat."
        maxLength={24}
        name="unitLabel"
        pattern="[\p{L} ]+"
        required
      />
      <TextInput
        defaultValue={initial?.plan ?? ''}
        id="society-plan"
        label="Plan"
        maxLength={120}
        name="plan"
      />
      <div className="flex flex-col gap-space-2 medium:flex-row">
        <Button
          disabled={pending || uploadingLogo}
          loading={pending || uploadingLogo}
          type="submit"
        >
          {isEditing ? 'Save Society' : 'Create Society'}
        </Button>
        {isEditing ? (
          <Button
            disabled={pending}
            onClick={() => router.back()}
            variant="secondary"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const societyStatusDescriptions: Readonly<
  Record<DeveloperSocietyStatus, string>
> = {
  trial: 'Trial access is available.',
  active: 'The society is active.',
  suspended:
    'Members can read existing information, but they cannot make changes.',
  archived: 'The society becomes unavailable. Its data is kept.',
};

export function SocietyStatusControl({
  societyId,
  currentStatus,
}: {
  societyId: string;
  currentStatus: DeveloperSocietyStatus;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(currentStatus);
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    const formData = new FormData();
    formData.set('societyId', societyId);
    formData.set('status', nextStatus);
    startTransition(async () => {
      const result = await setSocietyStatusAction(formData);
      setState(result);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-space-3">
      {state ? <ActionMessage state={state} /> : null}
      <div className="flex flex-wrap items-end gap-space-3">
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="society-status"
        >
          Status
          <select
            className="min-h-12 min-w-48 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
            id="society-status"
            onChange={(event) => {
              const status = societyStatusSchema.safeParse(
                event.currentTarget.value,
              );
              if (status.success) setNextStatus(status.data);
            }}
            value={nextStatus}
          >
            {(['trial', 'active', 'suspended', 'archived'] as const).map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        </label>
        <Button
          disabled={pending || nextStatus === currentStatus}
          onClick={() => setOpen(true)}
          variant={
            nextStatus === 'suspended' || nextStatus === 'archived'
              ? 'destructive'
              : 'secondary'
          }
        >
          Review status change
        </Button>
      </div>
      <ConfirmDialog
        actionLabel={`Set ${nextStatus}`}
        description={societyStatusDescriptions[nextStatus]}
        id={`society-status-${societyId}`}
        loading={pending}
        onConfirm={confirm}
        onOpenChange={setOpen}
        open={open}
        title={`Change society status to ${nextStatus}?`}
        variant={
          nextStatus === 'suspended' || nextStatus === 'archived'
            ? 'destructive'
            : 'primary'
        }
      />
    </div>
  );
}

export function FirstAdminForm({ societyId }: { societyId: string }) {
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('societyId', societyId);
    setState(null);
    startTransition(async () => {
      const result = await createFirstAdminAction(formData);
      setState(result);
      if (result.ok) form.reset();
    });
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <p className="text-caption text-ink-muted">
        The admin will receive an invitation record. They can request a sign-in
        code with this email address.
      </p>
      <TextInput
        autoComplete="email"
        id={`first-admin-email-${societyId}`}
        label="First admin email"
        maxLength={254}
        name="email"
        required
        type="email"
      />
      {state ? <ActionMessage state={state} /> : null}
      <Button disabled={pending} loading={pending} type="submit">
        Create first admin invitation
      </Button>
    </form>
  );
}

export function ModuleToggleControl({
  societyId,
  moduleKey,
  name,
  enabled,
}: {
  societyId: string;
  moduleKey: ModuleKey;
  name: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const nextEnabled = !enabled;

  function confirm() {
    const formData = new FormData();
    formData.set('societyId', societyId);
    formData.set('moduleKey', moduleKey);
    formData.set('enabled', String(nextEnabled));
    startTransition(async () => {
      const result = await toggleModuleAction(formData);
      setState(result);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid justify-items-start gap-space-2">
      {state ? <ActionMessage state={state} /> : null}
      <Button
        disabled={pending}
        onClick={() => setOpen(true)}
        variant={nextEnabled ? 'primary' : 'secondary'}
      >
        Turn {nextEnabled ? 'On' : 'Off'}
      </Button>
      <ConfirmDialog
        actionLabel={`Turn ${nextEnabled ? 'On' : 'Off'}`}
        description={
          nextEnabled
            ? `${name} will become available to this society.`
            : `${name} will no longer be available to members. Existing information is kept.`
        }
        id={`module-toggle-${societyId}-${moduleKey}`}
        loading={pending}
        onConfirm={confirm}
        onOpenChange={setOpen}
        open={open}
        title={`${nextEnabled ? 'Enable' : 'Disable'} ${name}?`}
        variant={nextEnabled ? 'primary' : 'destructive'}
      />
    </div>
  );
}

export function ModuleSettingsControl({
  societyId,
  moduleKey,
  settings,
}: {
  societyId: string;
  moduleKey: ModuleKey;
  settings: unknown;
}) {
  const router = useRouter();
  const [value, setValue] = useState(JSON.stringify(settings, null, 2));
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set('societyId', societyId);
    formData.set('moduleKey', moduleKey);
    formData.set('settings', value);
    setState(null);
    startTransition(async () => {
      const result = await updateModuleSettingsAction(formData);
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <form className="grid gap-space-2" onSubmit={submit}>
      <TextAreaInput
        id={`module-settings-${societyId}-${moduleKey}`}
        label="Settings (JSON)"
        maxLength={8000}
        onChange={(event) => setValue(event.currentTarget.value)}
        rows={8}
        value={value}
      />
      {state ? <ActionMessage state={state} /> : null}
      <Button disabled={pending} loading={pending} type="submit">
        Save Settings
      </Button>
    </form>
  );
}

export function ModuleSettingAccessControl({
  societyId,
  moduleKey,
  settings,
}: {
  societyId: string;
  moduleKey: ModuleKey;
  settings: readonly {
    module_key: string;
    setting_key: string;
    admin_can_edit: boolean;
  }[];
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const visible = settings.filter(
    (setting) => setting.module_key === moduleKey,
  );
  if (!visible.length) return null;

  function save(settingKey: string, adminCanEdit: boolean) {
    const formData = new FormData();
    formData.set('societyId', societyId);
    formData.set('moduleKey', moduleKey);
    formData.set('settingKey', settingKey);
    formData.set('adminCanEdit', String(adminCanEdit));
    setPendingKey(settingKey);
    setState(null);
    startTransition(async () => {
      const result = await updateModuleSettingAccessAction(formData);
      setState(result);
      setPendingKey(null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-space-3 border-t border-rule pt-space-4">
      <div className="grid gap-space-1">
        <h3 className="text-body-strong">Admins can edit</h3>
        <p className="text-caption text-ink-muted">
          Closed settings stay in this developer console and are refused on the
          server.
        </p>
      </div>
      {visible.map((setting) => (
        <label
          className="flex min-h-12 items-center justify-between gap-space-3 rounded-md border border-rule px-space-3"
          key={setting.setting_key}
        >
          <span className="text-body">
            {setting.setting_key.replaceAll('_', ' ')}
          </span>
          <input
            aria-label={`Allow admins to edit ${setting.setting_key}`}
            checked={setting.admin_can_edit}
            disabled={pendingKey === setting.setting_key}
            onChange={(event) =>
              save(setting.setting_key, event.currentTarget.checked)
            }
            type="checkbox"
          />
        </label>
      ))}
      {state ? <ActionMessage state={state} /> : null}
    </div>
  );
}

const QUICK_ACTION_ROLES = [
  'admin',
  'committee',
  'resident',
  'guard',
  'hk_supervisor',
] as const satisfies readonly SocietyRole[];

export function QuickActionDefaultsControls({
  societyId,
  defaults,
  overrides,
}: {
  societyId: string;
  defaults: readonly { role: string; actionKeys: string[] }[];
  overrides: readonly { role: string; actionKeys: string[] }[];
}) {
  const [scope, setScope] = useState<'all' | 'society'>('society');
  return (
    <div className="grid gap-space-4">
      <label className="grid gap-space-1 text-body-strong">
        Applies to
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
          onChange={(event) =>
            setScope(event.currentTarget.value as 'all' | 'society')
          }

          value={scope}
        >
          <option value="society">This society</option>
          <option value="all">All societies</option>
        </select>
      </label>
      {QUICK_ACTION_ROLES.map((role) => {
        const globalKeys =
          defaults.find((item) => item.role === role)?.actionKeys ?? [];
        const overrideKeys =
          overrides.find((item) => item.role === role)?.actionKeys ?? null;
        return (
          <QuickActionRoleEditor
            initialKeys={
              scope === 'all' ? globalKeys : (overrideKeys ?? globalKeys)
            }
            key={`${scope}-${role}`}
            role={role}
            scope={scope}
            showReset={scope === 'society' && overrideKeys !== null}
            societyId={societyId}
          />
        );
      })}
    </div>
  );
}

function QuickActionRoleEditor({
  initialKeys,
  role,
  scope,
  showReset,
  societyId,
}: {
  initialKeys: string[];
  role: SocietyRole;
  scope: 'all' | 'society';
  showReset: boolean;
  societyId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const roleActions = QUICK_ACTIONS.filter(
    (action) => action.permissions[role],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('societyId', scope === 'all' ? 'all' : societyId);
    formData.set('role', role);
    setState(null);
    startTransition(async () => {
      const result = await updateQuickActionDefaultsAction(formData);
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  function reset() {
    const formData = new FormData();
    formData.set('societyId', societyId);
    formData.set('role', role);
    setState(null);
    startTransition(async () => {
      const result = await resetQuickActionDefaultsAction(formData);
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <form
      className="grid gap-space-3 rounded-md border border-rule p-space-4"
      onSubmit={submit}
    >
      <h3 className="text-body-strong capitalize">
        {role.replaceAll('_', ' ')}
      </h3>
      <div className="grid gap-space-2 medium:grid-cols-2">
        {roleActions.map((action) => (
          <label
            className="flex min-h-11 items-center gap-space-2 rounded-md border border-rule px-space-3 text-body"
            key={action.key}
          >
            <input
              defaultChecked={initialKeys.includes(
                action.key as QuickActionKey,
              )}
              name="actionKey"
              type="checkbox"
              value={action.key}
            />
            {action.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-space-2">
        <Button disabled={pending} loading={pending} type="submit">
          Save defaults
        </Button>
        {showReset ? (
          <Button
            disabled={pending}
            onClick={reset}
            type="button"
            variant="secondary"
          >
            Reset to all societies
          </Button>
        ) : null}
      </div>
      {state ? <ActionMessage state={state} /> : null}
    </form>
  );
}

type OnboardingRecord = Awaited<
  ReturnType<typeof import('@/core/developer/console').getDeveloperOnboarding>
>;

export function DeveloperOnboardingForm({
  societyId,
  record,
}: {
  societyId: string;
  record: OnboardingRecord;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('societyId', societyId);
    setState(null);
    startTransition(async () => {
      const result = await saveDeveloperOnboardingAction(formData);
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  function savePercent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('societyId', societyId);
    startTransition(async () => {
      const result = await setResidentsJoinedPercentAction(formData);
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-space-5">
      <div className="rounded-md border border-rule bg-surface p-space-4">
        <p className="text-body-strong">Admin setup progress</p>
        <p className="text-caption text-ink-muted">
          {record.progress.steps.filter((step) => step.complete).length} of{' '}
          {record.progress.steps.length} complete
        </p>
        <ul className="mt-space-3 grid gap-space-1 text-caption">
          {record.progress.steps.map((step) => (
            <li key={step.key}>
              {step.complete ? 'Complete' : 'Open'} · {step.title}
            </li>
          ))}
        </ul>
      </div>
      <form className="grid gap-space-4" onSubmit={submit}>
        <label className="grid gap-space-1 text-body-strong">
          Stage
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            defaultValue={record.stage}
            name="stage"
          >
            <option value="agreed">Agreed</option>
            <option value="setting_up">Setting up</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <TextInput
          defaultValue={record.go_live_on ?? ''}
          id={`onboarding-go-live-${societyId}`}
          label="Go-live date"
          name="goLiveOn"
          type="date"
        />
        <fieldset className="grid gap-space-2">
          <legend className="text-body-strong">Agreed modules</legend>
          {MODULE_KEYS.filter((key) => key !== 'core').map((key) => (
            <label className="flex min-h-10 items-center gap-space-2" key={key}>
              <input
                defaultChecked={record.agreed_modules.includes(key)}
                name="agreedModule"
                type="checkbox"
                value={key}
              />
              {key}
            </label>
          ))}
        </fieldset>
        <TextInput
          defaultValue={record.contact_name ?? ''}
          id={`onboarding-contact-name-${societyId}`}
          label="Contact name"
          maxLength={120}
          name="contactName"
        />
        <TextInput
          defaultValue={record.contact_phone ?? ''}
          id={`onboarding-contact-phone-${societyId}`}
          label="Contact phone"
          maxLength={16}
          name="contactPhone"
        />
        <TextInput
          defaultValue={record.contact_email ?? ''}
          id={`onboarding-contact-email-${societyId}`}
          label="Contact email"
          maxLength={254}
          name="contactEmail"
          type="email"
        />
        <TextAreaInput
          defaultValue={record.notes ?? ''}
          id={`onboarding-notes-${societyId}`}
          label="Private notes"
          maxLength={1000}
          name="notes"
          rows={4}
        />
        <Button disabled={pending} loading={pending} type="submit">
          Save onboarding
        </Button>
      </form>
      <form
        className="flex flex-wrap items-end gap-space-3"
        onSubmit={savePercent}
      >
        <TextInput
          defaultValue={record.progress.residents_joined_percent}
          id={`onboarding-percent-${societyId}`}
          inputMode="numeric"
          label="Residents-joined target (%)"
          max={100}
          min={1}
          name="percent"
          type="number"
        />
        <Button disabled={pending} type="submit" variant="secondary">
          Save threshold
        </Button>
      </form>
      {state ? <ActionMessage state={state} /> : null}
    </div>
  );
}

export function DeveloperFeatureRequests({
  requests,
}: {
  requests: Awaited<
    ReturnType<
      typeof import('@/core/developer/console').getDeveloperFeatureRequests
    >
  >;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  function save(requestId: string, status: string) {
    const formData = new FormData();
    formData.set('requestId', requestId);
    formData.set('status', status);
    setPendingId(requestId);
    startTransition(async () => {
      const result = await setDeveloperFeatureRequestStatusAction(formData);
      setState(result);
      setPendingId(null);
      if (result.ok) router.refresh();
    });
  }

  if (!requests.length) {
    return <p className="text-body text-ink-muted">No feature requests.</p>;
  }
  return (
    <div className="grid gap-space-3">
      <ul className="grid gap-space-3">
        {requests.map((request) => (
          <li
            className="grid gap-space-2 rounded-md border border-rule p-space-4"
            key={request.id}
          >
            <p className="text-body-strong">
              {request.society_name} · {request.module_key}
            </p>
            {request.note ? (
              <p className="text-body text-ink-muted">{request.note}</p>
            ) : null}
            <p className="text-caption text-ink-muted">
              {request.requested_by} ·{' '}
              {new Date(request.created_at).toLocaleString('en-IN')}
            </p>
            <label className="grid gap-space-1 text-body-strong">
              Status
              <select
                className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                disabled={pendingId === request.id}
                onChange={(event) =>
                  save(request.id, event.currentTarget.value)
                }
                value={request.status}
              >
                <option value="new">New</option>
                <option value="agreed">Agreed</option>
                <option value="declined">Declined</option>
              </select>
            </label>
          </li>
        ))}
      </ul>
      {state ? <ActionMessage state={state} /> : null}
    </div>
  );
}

type WebsiteSettings = Awaited<
  ReturnType<
    typeof import('@/core/website/enquiries').getDeveloperWebsiteSettings
  >
>;
type WebsiteEnquiry = Awaited<
  ReturnType<
    typeof import('@/core/website/enquiries').getDeveloperWebsiteEnquiries
  >
>[number];

export function DeveloperWebsiteSettings({
  settings,
  saveAction = saveDeveloperWebsiteSettingsAction,
}: {
  settings: WebsiteSettings;
  saveAction?: (formData: FormData) => Promise<DeveloperActionResult>;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveAction(new FormData(event.currentTarget));
      setState(result);
      if (result.ok) router.refresh();
    });
  }
  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <TextInput
        defaultValue={settings.contactEmail ?? ''}
        helpText="When empty, the Talk to us link is hidden on the public website."
        id="website-contact-email"
        label="Public contact email"
        maxLength={254}
        name="contactEmail"
        type="email"
      />
      <TextInput
        defaultValue={settings.enquiryHourlyLimit}
        helpText="Valid enquiries allowed from one network address per hour."
        id="website-enquiry-hourly-limit"
        inputMode="numeric"
        label="Enquiries per network per hour"
        max={100}
        min={1}
        name="enquiryHourlyLimit"
        required
        type="number"
      />
      <Button disabled={pending} loading={pending} type="submit">
        Save website settings
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

function WebsiteEnquiryRow({
  enquiry,
  handleAction = handleWebsiteEnquiryAction,
  deleteAction = deleteWebsiteEnquiryAction,
}: {
  enquiry: WebsiteEnquiry;
  handleAction?: (formData: FormData) => Promise<DeveloperActionResult>;
  deleteAction?: (formData: FormData) => Promise<DeveloperActionResult>;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handle(action: 'handle' | 'delete') {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('enquiryId', enquiry.id);
      const result =
        action === 'handle'
          ? await handleAction(formData)
          : await deleteAction(formData);
      setState(result);
      if (result.ok) router.refresh();
      if (action === 'delete') setDeleteOpen(false);
    });
  }

  return (
    <li className="grid gap-space-3 rounded-md border border-rule p-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h3 className="text-body-strong">{enquiry.full_name}</h3>
          <p className="text-caption text-ink-muted">
            {enquiry.society_name ?? 'Society not supplied'} ·{' '}
            {enquiry.city ?? 'City not supplied'}
          </p>
        </div>
        <span className="rounded-sm bg-brand-tint px-space-2 py-space-1 text-micro font-semibold text-brand">
          {enquiry.status === 'new' ? 'New' : 'Handled'}
        </span>
      </div>
      <dl className="grid gap-space-1 text-caption">
        <div>
          <dt className="inline font-semibold">Email: </dt>
          <dd className="inline">{enquiry.email ?? 'Not supplied'}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Phone: </dt>
          <dd className="inline">{enquiry.phone ?? 'Not supplied'}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Flats: </dt>
          <dd className="inline">{enquiry.flat_count ?? 'Not supplied'}</dd>
        </div>
      </dl>
      {enquiry.message ? (
        <p className="whitespace-pre-wrap text-body">{enquiry.message}</p>
      ) : null}
      <div className="flex flex-wrap gap-space-2">
        {enquiry.status === 'new' ? (
          <Button
            disabled={pending}
            onClick={() => handle('handle')}
            type="button"
            variant="secondary"
          >
            Mark handled
          </Button>
        ) : null}
        <Button
          disabled={pending}
          onClick={() => setDeleteOpen(true)}
          type="button"
          variant="destructive"
        >
          Delete
        </Button>
      </div>
      <ActionMessage state={state} />
      <ConfirmDialog
        actionLabel="Delete enquiry"
        description="Delete this enquiry and its contact details permanently? The deletion is audit-logged without copying the details."
        id={`delete-website-enquiry-${enquiry.id}`}
        loading={pending}
        onConfirm={() => handle('delete')}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="Delete enquiry"
        variant="destructive"
      />
    </li>
  );
}

export function DeveloperWebsiteEnquiries({
  enquiries,
  handleAction,
  deleteAction,
}: {
  enquiries: WebsiteEnquiry[];
  handleAction?: (formData: FormData) => Promise<DeveloperActionResult>;
  deleteAction?: (formData: FormData) => Promise<DeveloperActionResult>;
}) {
  if (!enquiries.length) {
    return <p className="text-body text-ink-muted">No website enquiries.</p>;
  }
  return (
    <ul className="grid gap-space-4">
      {enquiries.map((enquiry) => (
        <WebsiteEnquiryRow
          deleteAction={deleteAction}
          enquiry={enquiry}
          handleAction={handleAction}
          key={enquiry.id}
        />
      ))}
    </ul>
  );
}

export function ErrorStatusControl({
  errorId,
  currentStatus,
}: {
  errorId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  if (currentStatus !== 'open') return null;

  function setStatus(status: 'resolved' | 'ignored') {
    const formData = new FormData();
    formData.set('errorId', errorId);
    formData.set('status', status);
    formData.set('note', note);
    startTransition(async () => {
      const result = await setErrorStatusAction(formData);
      setState(result);
      if (result.ok) {
        setNote('');
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-space-2">
      {state ? <ActionMessage state={state} /> : null}
      <TextAreaInput
        id={`error-note-${errorId}`}
        label="Note (optional)"
        maxLength={500}
        onChange={(event) => setNote(event.currentTarget.value)}
        value={note}
      />
      <div className="flex flex-wrap gap-space-2">
        <Button
          disabled={pending}
          onClick={() => setStatus('resolved')}
          variant="secondary"
        >
          Resolve
        </Button>
        <Button
          disabled={pending}
          onClick={() => setStatus('ignored')}
          variant="tertiary"
        >
          Ignore
        </Button>
      </div>
    </div>
  );
}
