// Provide touch-friendly, privacy-limited staff entry and exit controls.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { Avatar, Card } from '@/components/ui/data-display';
import { StaffActionForm, type StaffFormAction } from './action-form';
import {
  checkInDomesticStaffAction,
  checkOutDomesticStaffAction,
} from '@/app/(guard)/guard/staff/actions';
import type { GateStaffWorkspaceMember } from '@/core/staff/operations';
import type { StaffUnit } from '@/core/staff/validation';

export function GateUnitSelector({
  units,
  selectedUnitId,
}: {
  units: readonly StaffUnit[];
  selectedUnitId: string | null;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <form
      action="/guard/staff"
      className="flex flex-wrap items-end gap-space-3"
      method="get"
    >
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="staff-gate-unit"
      >
        {t('Destination unit')}
        <select
          className="min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={selectedUnitId ?? ''}
          id="staff-gate-unit"
          name="unitId"
          required
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
        type="submit"
      >
        {t('Show unit staff')}
      </button>
    </form>
  );
}

export function GateStaffCodeForm({
  unitId,
  action = checkInDomesticStaffAction,
}: {
  unitId: string;
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <StaffActionForm
      action={action}
      className="grid gap-space-3 sm:grid-cols-[minmax(0,1fr)_auto]"
      input={(formData) => ({
        unitId,
        staffCode: formData.get('staffCode'),
      })}
      submitLabel={t('Check in by staff code')}
    >
      <label className="grid gap-space-1 text-body-strong" htmlFor="staff-code">
        {t('Staff code')}
        <input
          autoComplete="off"
          className="min-h-14 rounded-md border border-rule px-space-3 font-mono uppercase tracking-widest focus-visible:outline-2 focus-visible:outline-focus"
          id="staff-code"
          maxLength={10}
          name="staffCode"
          pattern="[A-Fa-f0-9]{10}"
          required
          spellCheck={false}
        />
      </label>
    </StaffActionForm>
  );
}

function GateStaffCard({
  staff,
  checkInAction,
  checkOutAction,
}: {
  staff: GateStaffWorkspaceMember & { unitId: string };
  checkInAction: StaffFormAction;
  checkOutAction: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const isBlocked = staff.status === 'blocked' || staff.blocked_today;
  return (
    <Card title={staff.full_name}>
      <div className="grid gap-space-3">
        <Avatar
          name={staff.full_name}
          photoUrl={staff.photoUrl ?? undefined}
          size="guard"
        />
        <p className="text-body text-ink-muted">{staff.job_role}</p>
        {staff.status === 'blocked' ? (
          <p className="text-body-strong text-danger" role="alert">
            {t('Entry is blocked by the society.')}
          </p>
        ) : staff.blocked_today ? (
          <p className="text-body-strong text-danger" role="alert">
            {t('Entry to this unit is blocked for today.')}
          </p>
        ) : null}
        {staff.inside && staff.open_attendance_id ? (
          <>
            <p className="text-body-strong text-info">
              {t('Currently inside')}
            </p>
            <StaffActionForm
              action={checkOutAction}
              className="grid"
              input={() => ({
                attendanceId: staff.open_attendance_id,
              })}
              submitLabel={t('Record exit for {name}', {
                name: staff.full_name,
              })}
              submitVariant="secondary"
            >
              <span className="sr-only">
                {t('Record staff exit for {name}', { name: staff.full_name })}
              </span>
            </StaffActionForm>
          </>
        ) : !isBlocked ? (
          <StaffActionForm
            action={checkInAction}
            className="grid"
            input={() => ({
              unitId: staff.unitId,
              staffCode: staff.staff_code,
            })}
            submitLabel={t('Check in {name}', { name: staff.full_name })}
          >
            <span className="sr-only">
              {t('Check in staff member {name}', { name: staff.full_name })}
            </span>
          </StaffActionForm>
        ) : null}
      </div>
    </Card>
  );
}

export function GateStaffList({
  staff,
  checkInAction = checkInDomesticStaffAction,
  checkOutAction = checkOutDomesticStaffAction,
}: {
  staff: readonly (GateStaffWorkspaceMember & { unitId: string })[];
  checkInAction?: StaffFormAction;
  checkOutAction?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return staff.length ? (
    <ul className="grid gap-space-3 medium:grid-cols-2">
      {staff.map((member) => (
        <li key={member.id}>
          <GateStaffCard
            checkInAction={checkInAction}
            checkOutAction={checkOutAction}
            staff={member}
          />
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-body text-ink-muted">
      {t('No registered domestic staff are linked to this unit.')}
    </p>
  );
}
