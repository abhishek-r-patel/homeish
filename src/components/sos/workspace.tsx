// Raise, follow and respond to emergency SOS alerts, with tap-to-call contacts for every role.
'use client';
import { useUiTranslator } from '@/components/ui/language';
import { useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  acknowledgeSosAction,
  addSosUpdateAction,
  archiveSosContactAction,
  cancelSosAction,
  closeSosAction,
  raiseSosAction,
  saveSosContactAction,
  saveSosSettingsAction,
} from '@/app/(resident)/sos/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  SOS_CATEGORY_LABELS,
  SOS_CLOSE_REASON_LABELS,
  SOS_EMERGENCY_NOTICE,
  SOS_EVENT_LABELS,
  SOS_SCOPE_LABELS,
  formatSosTimestamp,
  sosRecipientSummary,
  sosTelHref,
} from '@/core/sos/presentation';
import {
  SOS_CATEGORIES,
  SOS_CLOSE_REASONS,
  SOS_NOTE_MAX,
  SOS_RESIDENT_SCOPES,
  SOS_UPDATE_MAX,
  sosCategorySchema,
  sosCloseInputSchema,
  sosCloseNoteRequired,
  sosCloseReasonSchema,
  sosContactInputSchema,
  sosRaiseInputSchema,
  sosSettingsInputSchema,
  sosUpdateInputSchema,
  type SosAlert,
  type SosCategory,
  type SosCloseReason,
  type SosContact,
  type SosResidentScope,
  type SosWorkspace,
} from '@/core/sos/validation';
import { Button } from '@/components/ui/button';
import { RadioGroup, SwitchInput } from '@/components/ui/choice-controls';
import { Combobox } from '@/components/ui/combobox';
import { Card, StatusChip } from '@/components/ui/data-display';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  Banner,
  EmptyState,
  ErrorPanel,
  Skeleton,
} from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { Pagination, type PageSize } from '@/components/ui/table-controls';
import { TextInput } from '@/components/ui/text-input';

export type SosAudience = 'resident' | 'management' | 'guard';
export type SosRouteStateKind =
  'loading' | 'disabled' | 'denied' | 'invalid_filters' | 'error';

export type SosActions = {
  raise: ModuleFormAction;
  cancel: ModuleFormAction;
  acknowledge: ModuleFormAction;
  update: ModuleFormAction;
  close: ModuleFormAction;
  settings: ModuleFormAction;
  saveContact: ModuleFormAction;
  archiveContact: ModuleFormAction;
};

export const DEFAULT_SOS_ACTIONS: SosActions = {
  raise: raiseSosAction,
  cancel: cancelSosAction,
  acknowledge: acknowledgeSosAction,
  update: addSosUpdateAction,
  close: closeSosAction,
  settings: saveSosSettingsAction,
  saveContact: saveSosContactAction,
  archiveContact: archiveSosContactAction,
};

const PAGE_SIZE = z.union([
  z.literal(10),
  z.literal(25),
  z.literal(50),
  z.literal(100),
]);

export function SosRouteState({
  kind,
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: SosRouteStateKind;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage embedded moduleKey="sos" returnHref={returnHref} />
    );
  const copy = {
    loading: {
      title: 'Loading emergency alerts',
      message: 'Loading open alerts and emergency contacts.',
    },
    denied: {
      title: 'Emergency access is restricted',
      message:
        'You do not have access to this view. In an emergency, call 112 directly.',
    },
    invalid_filters: {
      title: 'Check the history page',
      message:
        'Choose a valid page and 10, 25, 50 or 100 rows per page. Clear the filters to continue.',
    },
    error: {
      title: 'Could not load emergency alerts',
      message:
        'Alert status could not be confirmed. Retry, and in an emergency call 112 directly.',
    },
  }[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{t('Emergency SOS')}</h1>
      {kind === 'loading' ? (
        <Skeleton label={t(copy.title)} rows={5} />
      ) : (
        <ErrorPanel
          title={t(copy.title)}
          message={message ? translateFeedback(message) : t(copy.message)}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              <a
                href="tel:112"
                className="inline-flex min-h-12 items-center font-semibold text-danger underline"
              >
                {t('Call 112')}
              </a>
              {retryHref ? (
                <a
                  href={retryHref}
                  className="inline-flex min-h-12 items-center text-brand underline"
                >
                  {t('Retry')}
                </a>
              ) : null}
              <a
                href={returnHref}
                className="inline-flex min-h-12 items-center text-brand underline"
              >
                {kind === 'invalid_filters'
                  ? t('Clear filters')
                  : t('Back to workspace')}
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

type ActionResult = ServerActionResult<unknown>;

function useSosAction(action: ModuleFormAction) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  function run(input: unknown, onSaved?: (result: ActionResult) => void) {
    const form = new FormData();
    form.set('input', JSON.stringify(input));
    setResult(null);
    startTransition(async () => {
      try {
        const response = await action(form);
        setResult(response);
        if (response.ok) {
          onSaved?.(response);
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          code: 'INTERNAL_ERROR',
          message:
            'Could not reach the server. Retry, and call an emergency number if you need help now.',
        });
      }
    });
  }
  return { pending, result, run, reset: () => setResult(null) };
}

function ActionMessage({ result }: { result: ActionResult | null }) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (!result) return null;
  return (
    <p
      role={result.ok ? 'status' : 'alert'}
      className={`text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
    >
      {result.message ? translateFeedback(result.message) : null}
      {!result.ok && result.referenceId
        ? ` ${t('Reference: {id}', { id: result.referenceId })}`
        : ''}
    </p>
  );
}

function statusChip(status: SosAlert['status']) {
  return <StatusChip status={`sos.${status}`} />;
}

export function SosContactsCard({
  contacts,
  dense = false,
}: {
  contacts: readonly SosContact[];
  dense?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const active = contacts.filter((contact) => !contact.archived);
  return (
    <Card
      title={t('Emergency contacts')}
      description={t('Tap a number to call from this device.')}
    >
      <div className="grid gap-space-3">
        <p className="text-caption text-ink-muted">{t(SOS_EMERGENCY_NOTICE)}</p>
        {active.length === 0 ? (
          <p className="text-body">
            {t('No society contacts are listed. Call')}{' '}
            <a className="font-semibold text-danger underline" href="tel:112">
              112
            </a>{' '}
            {t('in an emergency.')}
          </p>
        ) : (
          <ul
            className={`grid gap-space-2 ${dense ? '' : 'medium:grid-cols-2'}`}
          >
            {active.map((contact) => (
              <li key={contact.id}>
                <a
                  href={sosTelHref(contact.phone)}
                  className="flex min-h-12 items-center justify-between gap-space-3 rounded-md border border-rule-strong px-space-4 py-space-2 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="text-body-strong">{contact.label}</span>
                  <span className="text-body text-danger">
                    <span className="sr-only">{t('Call ')}</span>
                    {contact.phone}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function SosRaiseForm({
  workspace,
  audience,
  action,
}: {
  workspace: SosWorkspace & { can_edit_settings?: boolean };
  audience: SosAudience;
  action: ModuleFormAction;
}) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  const id = useId();
  const retryId = useRef<string | null>(null);
  const [category, setCategory] = useState<SosCategory | null>(null);
  const [unitId, setUnitId] = useState<string | null>(
    audience === 'resident' && workspace.my_units.length === 1
      ? workspace.my_units[0]!.id
      : null,
  );
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { pending, result, run, reset } = useSosAction(action);
  const isGuard = audience === 'guard';
  const unitChoices = isGuard ? workspace.units : workspace.my_units;
  const unitLabel = unitChoices.find((unit) => unit.id === unitId)?.label;
  const needsUnit = !isGuard && !unitId;

  function prepare() {
    reset();
    if (!category) {
      setLocalError('Choose what kind of emergency this is.');
      return;
    }
    if (needsUnit) {
      setLocalError(`Choose your ${workspace.unit_label.toLowerCase()}.`);
      return;
    }
    if (note.trim().length > SOS_NOTE_MAX) {
      setLocalError(`Keep the note under ${SOS_NOTE_MAX} characters.`);
      return;
    }
    setLocalError(null);
    setConfirming(true);
  }

  function send() {
    retryId.current ??= crypto.randomUUID();
    const input = sosRaiseInputSchema.parse({
      unitId,
      category,
      note: note.trim() || null,
      clientRequestId: retryId.current,
    });
    run(input, () => {
      retryId.current = null;
      setCategory(null);
      setNote('');
    });
    setConfirming(false);
  }

  return (
    <Card
      title={isGuard ? t('Raise an SOS from the gate') : t('Raise an SOS')}
      description={sosRecipientSummary(workspace.settings, locale ?? 'en')}
    >
      <form
        className="grid gap-space-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          prepare();
        }}
      >
        <RadioGroup
          id={`${id}-category`}
          name={`${id}-category`}
          label={t('What is the emergency?')}
          required
          variant="cards"
          value={category ?? ''}
          onChange={(value) => setCategory(sosCategorySchema.parse(value))}
          options={SOS_CATEGORIES.map((value) => ({
            value,
            label: t(SOS_CATEGORY_LABELS[value]),
          }))}
        />
        {isGuard ? (
          <Combobox
            id={`${id}-unit`}
            label={t('{unit} (optional)', { unit: workspace.unit_label })}
            value={unitId}
            onChange={setUnitId}
            options={workspace.units.map((unit) => ({
              value: unit.id,
              label: unit.label,
            }))}
            helpText={t('Leave empty for the gate or a common area.')}
            emptyMessage={t('No matching unit.')}
          />
        ) : workspace.my_units.length > 1 ? (
          <SelectInput
            id={`${id}-unit`}
            label={workspace.unit_label}
            required
            placeholder={t('Choose your {unit}', {
              unit: workspace.unit_label.toLowerCase(),
            })}
            value={unitId ?? ''}
            onChange={(event) => setUnitId(event.currentTarget.value || null)}
            options={workspace.my_units.map((unit) => ({
              value: unit.id,
              label: unit.label,
            }))}
          />
        ) : unitLabel ? (
          <p className="text-body">
            {t('Location: ')}
            <span className="font-semibold">{unitLabel}</span>{' '}
            {t('(attached automatically)')}
          </p>
        ) : null}
        <TextAreaInput
          id={`${id}-note`}
          label={t('Short note (optional)')}
          helpText={t('For example: who needs help or where exactly.')}
          maxLength={SOS_NOTE_MAX}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
        />
        {localError ? (
          <p role="alert" className="text-caption text-danger">
            {translateFeedback(localError)}
          </p>
        ) : null}
        <ActionMessage result={result} />
        <Button
          variant="destructive"
          size="guard"
          className="text-heading"
          loading={pending}
          type="submit"
        >
          {t('Send SOS')}
        </Button>
      </form>
      <ConfirmDialog
        id={`${id}-confirm`}
        open={confirming}
        onOpenChange={setConfirming}
        title={t('Send this SOS now?')}
        description={
          <>
            {t('{category} alert{location}.', {
              category: t(
                category ? SOS_CATEGORY_LABELS[category] : 'Emergency',
              ),
              location: unitLabel
                ? t(' for {unit}', { unit: unitLabel })
                : isGuard
                  ? t(' from the gate')
                  : '',
            })}{' '}
            {sosRecipientSummary(workspace.settings, locale ?? 'en')}{' '}
            {t(SOS_EMERGENCY_NOTICE)}
          </>
        }
        actionLabel={t('Send SOS')}
        loading={pending}
        onConfirm={send}
      />
    </Card>
  );
}

function SosEventList({
  alert,
  timezone,
}: {
  alert: SosAlert;
  timezone: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <ol className="grid gap-space-2 border-l-2 border-rule pl-space-4">
      {alert.events.map((event) => (
        <li key={event.id} className="grid gap-space-1">
          <p className="text-body-strong">
            {t(SOS_EVENT_LABELS[event.action])}
            <span className="font-normal text-ink-muted">
              {' '}
              · {event.actor_name} ·{' '}
              <time dateTime={event.created_at}>
                {formatSosTimestamp(event.created_at, timezone, locale ?? 'en')}
              </time>
            </span>
          </p>
          {event.note ? <p className="text-body">{event.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function SosCancelControl({
  alert,
  action,
}: {
  alert: SosAlert;
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [open, setOpen] = useState(false);
  const { pending, result, run } = useSosAction(action);
  return (
    <div className="grid gap-space-2">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('Cancel — raised by mistake')}
      </Button>
      <ActionMessage result={result} />
      <ConfirmDialog
        id={`${id}-cancel`}
        open={open}
        onOpenChange={setOpen}
        title={t('Cancel this SOS?')}
        description={t(
          'Responders will be told it was raised by mistake. This is recorded.',
        )}
        actionLabel={t('Cancel SOS')}
        loading={pending}
        onConfirm={() => {
          run({ alertId: alert.id }, () => setOpen(false));
        }}
      />
    </div>
  );
}

function SosRespondControls({
  alert,
  actions,
  size,
}: {
  alert: SosAlert;
  actions: SosActions;
  size: 'default' | 'guard';
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [reason, setReason] = useState<SosCloseReason>('resolved');
  const acknowledge = useSosAction(actions.acknowledge);
  if (alert.status === 'raised') {
    return (
      <div className="grid gap-space-2">
        <Button
          size={size}
          loading={acknowledge.pending}
          onClick={() => acknowledge.run({ alertId: alert.id })}
        >
          {t('Acknowledge — I am responding')}
        </Button>
        <ActionMessage result={acknowledge.result} />
      </div>
    );
  }
  const noteRequired = sosCloseNoteRequired(reason);
  return (
    <div className="grid gap-space-4 medium:grid-cols-2">
      <ModuleActionForm
        action={actions.update}
        submitLabel={t('Post update')}
        input={(form) =>
          sosUpdateInputSchema.parse({
            alertId: alert.id,
            note: String(form.get('note') ?? ''),
          })
        }
      >
        <TextAreaInput
          id={`${id}-update`}
          name="note"
          label={t('Update for the raiser')}
          maxLength={SOS_UPDATE_MAX}
          rows={2}
          required
        />
      </ModuleActionForm>
      <ModuleActionForm
        action={actions.close}
        submitLabel={t('Close SOS')}
        input={(form) =>
          sosCloseInputSchema.parse({
            alertId: alert.id,
            reason,
            note: String(form.get('note') ?? '').trim() || null,
          })
        }
      >
        <SelectInput
          id={`${id}-reason`}
          label={t('Close reason')}
          value={reason}
          onChange={(event) =>
            setReason(sosCloseReasonSchema.parse(event.currentTarget.value))
          }
          options={SOS_CLOSE_REASONS.map((value) => ({
            value,
            label: t(SOS_CLOSE_REASON_LABELS[value]),
          }))}
        />
        <TextAreaInput
          id={`${id}-close-note`}
          name="note"
          label={
            noteRequired ? t('Closing note') : t('Closing note (optional)')
          }
          maxLength={SOS_UPDATE_MAX}
          rows={2}
          required={noteRequired}
        />
      </ModuleActionForm>
    </div>
  );
}

function SosAlertCard({
  alert,
  workspace,
  actions,
  audience,
  heading = 'h3',
}: {
  alert: SosAlert;
  workspace: SosWorkspace;
  actions: SosActions;
  audience: SosAudience;
  heading?: 'h2' | 'h3';
}) {
  const { locale, translate: t } = useUiTranslator();
  const Heading = heading;
  const open = alert.status === 'raised' || alert.status === 'acknowledged';
  const where =
    alert.unit_label ??
    t(alert.raised_role === 'guard' ? 'Gate' : 'Unit not set');
  return (
    <article
      className={`grid min-w-0 gap-space-3 rounded-md border p-space-4 ${alert.status === 'raised' ? 'border-danger bg-danger-tint' : 'border-rule bg-surface'}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-space-2">
        <div className="grid gap-space-1">
          <Heading className="text-subheading font-semibold">
            {t(SOS_CATEGORY_LABELS[alert.category])} · {where}
          </Heading>
          <p className="text-caption text-ink-muted">
            {t('Raised by {name}', { name: alert.raised_by_name })}
            {alert.is_mine ? t(' (you)') : ''} ·{' '}
            <time dateTime={alert.raised_at}>
              {formatSosTimestamp(
                alert.raised_at,
                workspace.timezone,
                locale ?? 'en',
              )}
            </time>
          </p>
        </div>
        {statusChip(alert.status)}
      </header>
      {alert.note ? (
        <p className="text-body">{t('Note: {note}', { note: alert.note })}</p>
      ) : null}
      {alert.close_reason ? (
        <p className="text-body">
          {t(SOS_CLOSE_REASON_LABELS[alert.close_reason])}
          {alert.close_note ? ` — ${alert.close_note}` : ''}
        </p>
      ) : null}
      <SosEventList alert={alert} timezone={workspace.timezone} />
      {open && workspace.can_write ? (
        alert.can_respond ? (
          <SosRespondControls
            alert={alert}
            actions={actions}
            size={audience === 'guard' ? 'guard' : 'default'}
          />
        ) : alert.can_cancel ? (
          <SosCancelControl alert={alert} action={actions.cancel} />
        ) : alert.status === 'raised' ? (
          <p className="text-caption text-ink-muted">
            {t('Waiting for a responder to acknowledge.')}
          </p>
        ) : null
      ) : null}
    </article>
  );
}

function SosSettingsForm({
  workspace,
  action,
}: {
  workspace: SosWorkspace;
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [guards, setGuards] = useState(workspace.settings.notify_guards);
  const [admins, setAdmins] = useState(workspace.settings.notify_admins);
  const [committee, setCommittee] = useState(
    workspace.settings.notify_committee,
  );
  const [scope, setScope] = useState<SosResidentScope>(
    workspace.settings.resident_scope,
  );
  return (
    <Card
      title={t('Who gets SOS alerts')}
      description={t(
        'Recipients see a banner on every screen until they dismiss it. Alerts are in-app only; there are no SMS or calls.',
      )}
    >
      <ModuleActionForm
        action={action}
        submitLabel={t('Save recipients')}
        submitDisabled={!guards && !admins && !committee}
        input={() =>
          sosSettingsInputSchema.parse({
            notifyGuards: guards,
            notifyAdmins: admins,
            notifyCommittee: committee,
            residentScope: scope,
          })
        }
      >
        <SwitchInput
          id={`${id}-guards`}
          label={t('All guards')}
          checked={guards}
          onChange={(event) => setGuards(event.currentTarget.checked)}
        />
        <SwitchInput
          id={`${id}-admins`}
          label={t('Administrators')}
          checked={admins}
          onChange={(event) => setAdmins(event.currentTarget.checked)}
        />
        <SwitchInput
          id={`${id}-committee`}
          label={t('Committee members')}
          checked={committee}
          onChange={(event) => setCommittee(event.currentTarget.checked)}
        />
        <SelectInput
          id={`${id}-scope`}
          label={t('Also alert residents')}
          helpText={t('Floor matching skips units without a floor number.')}
          value={scope}
          onChange={(event) =>
            setScope(
              z.enum(SOS_RESIDENT_SCOPES).parse(event.currentTarget.value),
            )
          }
          options={SOS_RESIDENT_SCOPES.map((value) => ({
            value,
            label: t(SOS_SCOPE_LABELS[value]),
          }))}
        />
        {!guards && !admins && !committee ? (
          <p role="alert" className="text-caption text-danger">
            {t('Keep at least one responder group notified.')}
          </p>
        ) : null}
      </ModuleActionForm>
    </Card>
  );
}

function SosContactForm({
  contact,
  action,
  nextOrder,
}: {
  contact?: SosContact;
  action: ModuleFormAction;
  nextOrder: number;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={contact ? t('Save contact') : t('Add contact')}
      input={(form) =>
        sosContactInputSchema.parse({
          contactId: contact?.id ?? null,
          label: String(form.get('label') ?? ''),
          phone: String(form.get('phone') ?? ''),
          sortOrder: Number(form.get('sortOrder') ?? nextOrder),
        })
      }
    >
      <TextInput
        id={`${id}-label`}
        name="label"
        label={t('Name')}
        required
        maxLength={60}
        defaultValue={contact?.label}
      />
      <TextInput
        id={`${id}-phone`}
        name="phone"
        label={t('Phone number')}
        type="tel"
        inputMode="tel"
        required
        maxLength={20}
        defaultValue={contact?.phone}
      />
      <TextInput
        id={`${id}-order`}
        name="sortOrder"
        label={t('Display order')}
        type="number"
        min={0}
        max={999}
        required
        defaultValue={contact?.sort_order ?? nextOrder}
      />
    </ModuleActionForm>
  );
}

function SosContactManager({
  contacts,
  actions,
}: {
  contacts: readonly SosContact[];
  actions: SosActions;
}) {
  const { translate: t } = useUiTranslator();
  const archive = useSosAction(actions.archiveContact);
  const [editing, setEditing] = useState<string | null>(null);
  const nextOrder = Math.min(
    999,
    contacts.reduce((max, contact) => Math.max(max, contact.sort_order), 0) +
      10,
  );
  return (
    <Card
      title={t('Manage emergency contacts')}
      description={t(
        'Shown to everyone on the SOS screens. Archived contacts are hidden but kept.',
      )}
    >
      <div className="grid gap-space-4">
        <ul className="grid gap-space-3">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="grid gap-space-2 rounded-md border border-rule p-space-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-space-2">
                <p className="text-body-strong">
                  {contact.label} · {contact.phone}
                  {contact.archived ? (
                    <span className="font-normal text-ink-muted">
                      {' '}
                      {t('(archived)')}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-space-2">
                  <Button
                    variant="tertiary"
                    aria-label={t(
                      editing === contact.id
                        ? 'Stop editing {name}'
                        : 'Edit {name}',
                      { name: contact.label },
                    )}
                    onClick={() =>
                      setEditing(editing === contact.id ? null : contact.id)
                    }
                  >
                    {editing === contact.id ? t('Close') : t('Edit')}
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label={t(
                      contact.archived ? 'Restore {name}' : 'Archive {name}',
                      { name: contact.label },
                    )}
                    loading={archive.pending}
                    onClick={() =>
                      archive.run({
                        contactId: contact.id,
                        archived: !contact.archived,
                      })
                    }
                  >
                    {contact.archived ? t('Restore') : t('Archive')}
                  </Button>
                </div>
              </div>
              {editing === contact.id ? (
                <SosContactForm
                  contact={contact}
                  action={actions.saveContact}
                  nextOrder={nextOrder}
                />
              ) : null}
            </li>
          ))}
        </ul>
        <ActionMessage result={archive.result} />
        <section aria-label={t('Add a contact')} className="grid gap-space-2">
          <h3 className="text-body-strong">{t('Add a contact')}</h3>
          <SosContactForm action={actions.saveContact} nextOrder={nextOrder} />
        </section>
      </div>
    </Card>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-space-3">
      <div className="grid gap-space-1">
        <h2 id={id} className="text-heading font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="text-caption text-ink-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SosWorkspaceView({
  workspace,
  audience,
  baseHref,
  actions = DEFAULT_SOS_ACTIONS,
  onPageChange,
}: {
  workspace: SosWorkspace & { can_edit_settings?: boolean };
  audience: SosAudience;
  baseHref: string;
  actions?: SosActions;
  onPageChange?: (offset: number, size: PageSize) => void;
}) {
  const { translate: t } = useUiTranslator();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const size = PAGE_SIZE.catch(25).parse(workspace.history.limit);
  const showRaise =
    audience !== 'management' && workspace.can_raise && workspace.can_write;
  const responder = workspace.can_respond && audience !== 'resident';
  const openTitle = responder
    ? 'Open alerts'
    : audience === 'resident'
      ? "Your household's open SOS"
      : 'Your open SOS';
  function paginate(offset: number, limit: PageSize) {
    if (onPageChange) return onPageChange(offset, limit);
    const query = new URLSearchParams({ limit: String(limit) });
    if (offset > 0) query.set('offset', String(offset));
    startTransition(() => router.push(`${baseHref}?${query}`));
  }
  const open = responder
    ? workspace.open
    : workspace.open.filter(
        (alert) =>
          alert.is_mine ||
          workspace.my_units.some((unit) => unit.id === alert.unit_id),
      );
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          {audience === 'management' ? t('SOS alerts') : t('Emergency SOS')}
        </h1>
        <Banner
          tone="warning"
          title={t('Not a replacement for emergency services')}
        >
          {t(SOS_EMERGENCY_NOTICE)}{' '}
          <a className="font-semibold underline" href="tel:112">
            {t('Call 112')}
          </a>
        </Banner>
        {!workspace.can_write ? (
          <Banner tone="neutral">
            {t(
              'This society is read-only. SOS alerts cannot be raised or changed here; call an emergency number instead.',
            )}
          </Banner>
        ) : null}
      </header>
      {showRaise ? (
        <SosRaiseForm
          workspace={workspace}
          audience={audience}
          action={actions.raise}
        />
      ) : audience === 'resident' && !workspace.can_raise ? (
        <Banner tone="info">
          {t(
            'Your account is not linked to an active {unit}, so you cannot raise an SOS here. Use the emergency contacts below.',
            { unit: workspace.unit_label.toLowerCase() },
          )}
        </Banner>
      ) : null}
      <Section
        title={t(openTitle)}
        description={
          responder
            ? t(
                'Acknowledge to tell the raiser help is coming, post updates, then close with a reason.',
              )
            : t('You can cancel only until a responder acknowledges it.')
        }
      >
        {open.length === 0 ? (
          <EmptyState
            title={t('No open SOS')}
            description={
              responder
                ? t('New alerts appear here and in a banner on every screen.')
                : t('Nothing is open right now.')
            }
          />
        ) : (
          <div className="grid gap-space-3">
            {open.map((alert) => (
              <SosAlertCard
                key={alert.id}
                alert={alert}
                workspace={workspace}
                actions={actions}
                audience={audience}
              />
            ))}
          </div>
        )}
      </Section>
      <SosContactsCard contacts={workspace.contacts} />
      {audience === 'management' &&
      workspace.can_manage &&
      workspace.can_edit_settings !== false ? (
        <div className="grid gap-space-5 expanded:grid-cols-2">
          <SosSettingsForm workspace={workspace} action={actions.settings} />
          <SosContactManager contacts={workspace.contacts} actions={actions} />
        </div>
      ) : null}
      <Section
        title={t('History')}
        description={t('Closed and cancelled alerts.')}
      >
        {workspace.history.items.length === 0 ? (
          <EmptyState
            title={t('No past alerts')}
            description={t('Closed and cancelled alerts will be listed here.')}
          />
        ) : (
          <div className="grid gap-space-3">
            {workspace.history.items.map((alert) => (
              <SosAlertCard
                key={alert.id}
                alert={alert}
                workspace={workspace}
                actions={actions}
                audience={audience}
              />
            ))}
          </div>
        )}
        {workspace.history.total > size ? (
          <Pagination
            page={Math.floor(workspace.history.offset / size) + 1}
            pageSize={size}
            total={workspace.history.total}
            onPageChange={(page) => paginate((page - 1) * size, size)}
            onPageSizeChange={(next) => paginate(0, next)}
          />
        ) : null}
      </Section>
    </section>
  );
}
