// Compose scoped moving forms and explicit confirmations from shared accessible controls.
'use client';
import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z, ZodError } from 'zod';
import {
  attachTenancyProofAction,
  completeTenancyAction,
  consentTenancyAction,
  createTenancyAction,
  decideTenancyAction,
  issueTenancyNocAction,
  saveTenancySettingsAction,
} from '@/app/(resident)/tenancy/actions';
import { ValidationError } from '@/core/errors';
import {
  TENANCY_KIND_LABELS,
  tenancyTenantChoices,
} from '@/core/tenancy/moves/presentation';
import {
  tenancyKindSchema,
  tenancyMoveInputSchema,
  tenancyDecisionInputSchema,
  tenancySettingsInputSchema,
  tenancyVersionInputSchema,
  tenancyCompleteInputSchema,
  type TenancyMoveDetail,
  type TenancyWorkspace,
} from '@/core/tenancy/moves/validation';
import { localTimeToIso } from '@/lib/local-time';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/data-display';
import {
  DatePicker,
  TimePicker,
  type TimeParts,
} from '@/components/ui/date-time-inputs';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { useTenancyPresentation } from './presentation';

export type TenancyActions = {
  create: ModuleFormAction;
  attach: ModuleFormAction;
  consent: ModuleFormAction;
  decide: ModuleFormAction;
  complete: ModuleFormAction;
  issue: ModuleFormAction;
  settings: ModuleFormAction;
};

export const DEFAULT_TENANCY_ACTIONS: TenancyActions = {
  create: createTenancyAction,
  attach: attachTenancyProofAction,
  consent: consentTenancyAction,
  decide: decideTenancyAction,
  complete: completeTenancyAction,
  issue: issueTenancyNocAction,
  settings: saveTenancySettingsAction,
};

function localInstant(date: string, time: TimeParts, timezone: string) {
  const hour = (Number(time.hour) % 12) + (time.period === 'PM' ? 12 : 0);
  return localTimeToIso(
    `${date}T${String(hour).padStart(2, '0')}:${time.minute}`,
    timezone,
  );
}

export function TenancyCreateForm({
  workspace,
  baseHref,
  action = createTenancyAction,
  onCreated,
}: {
  workspace: TenancyWorkspace;
  baseHref: string;
  action?: ModuleFormAction;
  onCreated?: (moveId: string) => void;
}) {
  const { t, time } = useTenancyPresentation();
  const id = useId();
  const router = useRouter();
  const [kind, setKind] = useState<'move_in' | 'move_out'>('move_in');
  const [unitId, setUnitId] = useState<string | null>(
    workspace.units.length === 1 ? workspace.units[0]!.id : null,
  );
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date(`${workspace.today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(startDate);
  const [expiry, setExpiry] = useState('');
  const [startTime, setStartTime] = useState<TimeParts>({
    hour: '9',
    minute: '00',
    period: 'AM',
  });
  const [endTime, setEndTime] = useState<TimeParts>({
    hour: '10',
    minute: '00',
    period: 'AM',
  });
  const tenants = tenancyTenantChoices(workspace, unitId, kind);
  const bookings = workspace.bookings.filter(
    (booking) => booking.unit_id === unitId,
  );

  return (
    <Card
      title={t('New move request')}
      description={t(
        'Approval schedules the move only. An administrator confirms actual completion before household access changes.',
      )}
    >
      <ModuleActionForm
        action={action}
        idempotent
        refresh={false}
        submitDisabled={
          !unitId ||
          !tenantId ||
          !startDate ||
          !endDate ||
          (kind === 'move_in' && !expiry)
        }
        submitLabel={t('Create Move Request')}
        onSaved={(data) => {
          const moveId = z.uuid().parse(data);
          if (onCreated) onCreated(moveId);
          else router.push(`${baseHref}/${moveId}`);
        }}
        input={(_, clientRequestId) => {
          const startsAt = localInstant(
            startDate,
            startTime,
            workspace.timezone,
          );
          const endsAt = localInstant(endDate, endTime, workspace.timezone);
          const booking = bookings.find((item) => item.id === bookingId);
          if (
            booking &&
            (Date.parse(booking.starts_at) > Date.parse(startsAt) ||
              Date.parse(booking.ends_at) < Date.parse(endsAt))
          ) {
            throw new ValidationError({
              amenityBookingId:
                'Choose a confirmed amenity booking covering the entire moving window, or leave it unlinked.',
            });
          }
          return tenancyMoveInputSchema.parse({
            unitId,
            tenantMembershipId: tenantId,
            kind,
            startsAt,
            endsAt,
            agreementExpiresOn: kind === 'move_in' ? expiry : null,
            amenityBookingId: bookingId,
            clientRequestId,
          });
        }}
      >
        <SelectInput
          id={`${id}-kind`}
          label={t('Move type')}
          value={kind}
          options={Object.entries(TENANCY_KIND_LABELS).map(
            ([value, label]) => ({ value, label: t(label) }),
          )}
          onChange={(event) => {
            setKind(tenancyKindSchema.parse(event.currentTarget.value));
            setTenantId(null);
          }}
        />
        <Combobox
          id={`${id}-unit`}
          label={workspace.unit_label}
          required
          value={unitId}
          options={workspace.units.map((unit) => ({
            value: unit.id,
            label: unit.number,
          }))}
          onChange={(value) => {
            setUnitId(value);
            setTenantId(null);
            setBookingId(null);
          }}
          emptyMessage={t(
            'No eligible household. Ask an administrator to review Core setup.',
          )}
        />
        <Combobox
          id={`${id}-tenant`}
          label={t('Tenant or invitation')}
          required
          value={tenantId}
          disabled={!unitId}
          options={tenants.map((tenant) => ({
            value: tenant.id,
            label: `${tenant.name}${tenant.status === 'active' ? '' : t(' (invitation)')}`,
          }))}
          onChange={setTenantId}
          helpText={t(
            kind === 'move_in'
              ? 'Use the existing Core invitation. The tenant must claim it before completion.'
              : 'Choose a currently active tenant of this household.',
          )}
          emptyMessage={t(
            'No eligible tenant. Ask an administrator to invite or assign the tenant in Core first.',
          )}
        />
        <div className="grid gap-space-4 expanded:grid-cols-2">
          <div className="grid content-start gap-space-3">
            <DatePicker
              id={`${id}-start-date`}
              label={t('Move start date')}
              min={workspace.today}
              value={startDate}
              onChange={(value) => {
                setStartDate(value);
                if (endDate < value) setEndDate(value);
                if (expiry && expiry < value) setExpiry('');
              }}
            />
            <TimePicker
              id={`${id}-start-time`}
              label={t('Move start time')}
              required
              timeZone={workspace.timezone}
              value={startTime}
              onChange={setStartTime}
            />
          </div>
          <div className="grid content-start gap-space-3">
            <DatePicker
              id={`${id}-end-date`}
              label={t('Move end date')}
              min={startDate}
              value={endDate}
              onChange={setEndDate}
            />
            <TimePicker
              id={`${id}-end-time`}
              label={t('Move end time')}
              required
              timeZone={workspace.timezone}
              value={endTime}
              onChange={setEndTime}
            />
          </div>
        </div>
        {kind === 'move_in' ? (
          <DatePicker
            id={`${id}-expiry`}
            label={t('Rental agreement expiry (required)')}
            min={startDate}
            helpText={t(
              'Use the actual expiry date in the mandatory rental agreement.',
            )}
            value={expiry}
            onChange={setExpiry}
          />
        ) : null}
        {workspace.amenity_enabled ? (
          <SelectInput
            id={`${id}-booking`}
            label={t('Existing amenity booking (optional)')}
            helpText={t(
              'Only a confirmed booking for this household covering the entire window can be linked. This does not reserve anything.',
            )}
            value={bookingId ?? ''}
            onChange={(event) =>
              setBookingId(event.currentTarget.value || null)
            }
            options={[
              { value: '', label: t('No linked booking') },
              ...bookings.map((booking) => ({
                value: booking.id,
                label: `${booking.name}: ${time(booking.starts_at, workspace.timezone)}`,
              })),
            ]}
          />
        ) : null}
        <p className="text-caption text-ink-muted">
          {t(
            'No move fee or deposit. Choose all required details to create a request.',
          )}
          {t(
            kind === 'move_in'
              ? ' Attach the rental agreement after creation; an active owner must then consent.'
              : ' Positive unit dues block completion when Billing is enabled.',
          )}
        </p>
      </ModuleActionForm>
    </Card>
  );
}

function TenancyConfirmation({
  action,
  input,
  label,
  description,
  requiresReason = false,
  destructive = false,
}: {
  action: ModuleFormAction;
  input: (reason: string | null) => unknown;
  label: string;
  description: string;
  requiresReason?: boolean;
  destructive?: boolean;
}) {
  const { translateFeedback } = useTenancyPresentation();
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-space-2">
      <Button
        variant={destructive ? 'destructive' : 'secondary'}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {translateFeedback(message)}
        </p>
      ) : null}
      <ConfirmDialog
        id={id}
        open={open}
        onOpenChange={setOpen}
        loading={pending}
        title={label}
        actionLabel={label}
        description={description}
        requiresReason={requiresReason}
        variant={destructive ? 'destructive' : 'primary'}
        error={error ? translateFeedback(error) : undefined}
        onConfirm={(reason) => {
          setError(undefined);
          startTransition(async () => {
            try {
              const form = new FormData();
              form.set('input', JSON.stringify(input(reason)));
              const result = await action(form);
              if (!result.ok) {
                setError(
                  `${result.message}${result.referenceId ? ` Reference: ${result.referenceId}` : ''}`,
                );
                return;
              }
              setMessage(result.message ?? 'Change saved.');
              setOpen(false);
              router.refresh();
            } catch (cause) {
              setError(
                cause instanceof ZodError
                  ? (cause.issues[0]?.message ??
                      'Check the decision details and retry.')
                  : 'Could not reach the server. Your decision is not confirmed; reconnect and retry.',
              );
            }
          });
        }}
      />
    </div>
  );
}

export function TenancyDecisionControl({
  detail,
  decision,
  action,
}: {
  detail: TenancyMoveDetail;
  decision:
    'consent' | 'approved' | 'rejected' | 'cancelled' | 'complete' | 'issue';
  action: ModuleFormAction;
}) {
  const { t } = useTenancyPresentation();
  const copy = {
    consent: {
      label: 'Give Owner Consent',
      description:
        'Confirm that you are an active owner of this household and consent to this tenant moving in. This does not activate tenant access.',
    },
    approved: {
      label: 'Approve Schedule',
      description:
        'Approve this moving schedule? Household access will not change until an administrator confirms actual completion.',
    },
    rejected: {
      label: 'Reject Request',
      description:
        'Reject this request with a reason? The history is kept; any private proofs are retained for 30 days.',
    },
    cancelled: {
      label: 'Cancel Request',
      description:
        'Cancel this request with a reason? Household access will not change. The history is kept; any private proofs are retained for 30 days.',
    },
    complete: {
      label:
        detail.move.kind === 'move_in'
          ? 'Confirm Actual Move-in'
          : 'Confirm Actual Move-out',
      description:
        detail.move.kind === 'move_in'
          ? 'Confirm the tenant has actually moved in during the approved window. This activates the Core tenant occupancy and household access.'
          : 'Confirm the tenant has actually moved out during the approved window. This ends the Core tenant occupancy and household access. Positive dues block completion when Billing is enabled. If a linked unit handover is still open, confirming here records Complete anyway in the audit log.',
    },
    issue: {
      label: 'Issue Move-out NOC',
      description:
        'Issue the approved society move-out NOC? Current dues are checked again. If Billing is disabled, the document explicitly records that dues were not checked.',
    },
  }[decision];
  return (
    <TenancyConfirmation
      label={t(copy.label)}
      description={t(copy.description)}
      action={action}
      requiresReason={decision === 'rejected' || decision === 'cancelled'}
      destructive={decision === 'rejected' || decision === 'cancelled'}
      input={(reason) => {
        const version = {
          moveId: detail.move.id,
          expectedVersion: detail.move.version,
        };
        return ['approved', 'rejected', 'cancelled'].includes(decision)
          ? tenancyDecisionInputSchema.parse({ ...version, decision, reason })
          : decision === 'complete'
            ? tenancyCompleteInputSchema.parse({
                ...version,
                overrideOpenHandover: detail.move.kind === 'move_out',
              })
            : tenancyVersionInputSchema.parse(version);
      }}
    />
  );
}

export function TenancySettingsControl({
  workspace,
  action = saveTenancySettingsAction,
}: {
  workspace: TenancyWorkspace;
  action?: ModuleFormAction;
}) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const [required, setRequired] = useState(
    workspace.police_verification_required,
  );
  const [verificationTracking, setVerificationTracking] = useState(
    workspace.verification_tracking_enabled ?? false,
  );
  const [handoverBasis, setHandoverBasis] = useState(
    workspace.clearance_handover_basis ?? 'bills',
  );
  const [agreementEvidence, setAgreementEvidence] = useState(
    workspace.clearance_agreement_evidence ?? 'admin_note',
  );
  const changed =
    required !== workspace.police_verification_required ||
    verificationTracking !==
      (workspace.verification_tracking_enabled ?? false) ||
    handoverBasis !== (workspace.clearance_handover_basis ?? 'bills') ||
    agreementEvidence !==
      (workspace.clearance_agreement_evidence ?? 'admin_note');
  return (
    <Card
      title={t('Proof requirements')}
      description={t(
        'Rental agreements are always required. Police-verification proof is off by default. Never collect Aadhaar or other government ID copies.',
      )}
    >
      <CheckboxInput
        id={id}
        label={t('Require police-verification proof')}
        checked={required}
        onChange={(event) => setRequired(event.currentTarget.checked)}
      />
      <CheckboxInput
        id={`${id}-verification`}
        label={t('Track optional verification status')}
        checked={verificationTracking}
        onChange={(event) =>
          setVerificationTracking(event.currentTarget.checked)
        }
        description={t(
          'Stores only pending, verified or rejected, plus a date and reference. It does not establish legal compliance.',
        )}
      />
      <SelectInput
        id={`${id}-basis`}
        label={t('Conditional handover basis')}
        value={handoverBasis}
        options={[
          { value: 'bills', label: t('Specific unpaid bills (default)') },
          { value: 'total', label: t('Total outstanding unit balance') },
        ]}
        onChange={(event) =>
          setHandoverBasis(
            z.enum(['bills', 'total']).parse(event.currentTarget.value),
          )
        }
      />
      <SelectInput
        id={`${id}-evidence`}
        label={t('Handover agreement evidence')}
        value={agreementEvidence}
        options={[
          { value: 'admin_note', label: t('Administrator note (default)') },
          { value: 'signed_upload', label: t('Uploaded signed agreement') },
          {
            value: 'in_app_and_upload',
            label: t('In-app consent and upload for parties without accounts'),
          },
        ]}
        onChange={(event) =>
          setAgreementEvidence(
            z
              .enum(['admin_note', 'signed_upload', 'in_app_and_upload'])
              .parse(event.currentTarget.value),
          )
        }
      />
      {changed ? (
        <TenancyConfirmation
          action={action}
          label={t('Save Proof Requirement')}
          description={t(
            required
              ? 'Require police-verification proof before consenting, approving or completing open move-in requests? Existing consent cannot bypass the required proof.'
              : 'Make police-verification proof optional? The rental agreement remains mandatory.',
          )}
          input={() =>
            tenancySettingsInputSchema.parse({
              policeVerificationRequired: required,
              verificationTrackingEnabled: verificationTracking,
              clearanceHandoverBasis: handoverBasis,
              clearanceAgreementEvidence: agreementEvidence,
            })
          }
        />
      ) : (
        <Banner tone="neutral">
          {t('The current proof requirement is saved.')}
        </Banner>
      )}
    </Card>
  );
}
