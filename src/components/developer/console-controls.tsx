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
  updateModuleSettingsAction,
  updateSocietyAction,
} from '@/app/developer/actions';
import type { DeveloperActionResult } from '@/core/developer/console';
import type { Database } from '@/core/db/database.types';
import type { ModuleKey } from '@/core/modules';
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

type SocietyRow = Omit<
  Database['public']['Tables']['societies']['Row'],
  'join_code'
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
      <TextInput
        defaultValue={initial?.timezone ?? 'Asia/Kolkata'}
        id="society-timezone"
        label="Time zone"
        maxLength={64}
        name="timezone"
        required
      />
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
