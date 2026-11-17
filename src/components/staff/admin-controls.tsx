// Render the staff directory, resident approvals and society shift records.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useId } from 'react';
import { Card } from '@/components/ui/data-display';
import { TextInput } from '@/components/ui/text-input';
import { StaffActionForm, type StaffFormAction } from './action-form';
import { StaffPhotoUpload } from './photo-upload';
import {
  markSocietyStaffShiftAction,
  reviewStaffRegistrationAction,
  saveStaffAction,
  updateStaffSettingsAction,
} from '@/app/(admin)/admin/staff/actions';
import type { StaffWorkspaceMember } from '@/core/staff/operations';
import type { StaffShiftAttendance, StaffUnit } from '@/core/staff/validation';

function StaffProfileFields({
  staff,
  units,
}: {
  staff?: StaffWorkspaceMember;
  units: readonly StaffUnit[];
}) {
  const { translate: t } = useUiTranslator();
  const prefix = useId();
  const staffType = staff?.staff_type ?? 'domestic';
  const selectedUnits =
    staff?.unit_links
      .filter(({ status }) => status === 'active')
      .map(({ unit_id }) => unit_id) ?? [];
  return (
    <>
      <input name="staffId" type="hidden" value={staff?.id ?? ''} />
      {staff ? (
        <input name="staffType" type="hidden" value={staffType} />
      ) : (
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor={`${prefix}-type`}
        >
          {t('Staff type')}
          <select
            className="min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
            defaultValue={staffType}
            id={`${prefix}-type`}
            name="staffType"
          >
            <option value="domestic">{t('Domestic staff')}</option>
            <option value="society">{t('Society staff')}</option>
          </select>
        </label>
      )}
      <TextInput
        defaultValue={staff?.full_name ?? ''}
        id={`${prefix}-name`}
        label={t('Full name')}
        maxLength={120}
        name="fullName"
        required
      />
      <TextInput
        defaultValue={staff?.phone ?? ''}
        id={`${prefix}-phone`}
        inputMode="tel"
        label={t('Phone number')}
        name="phone"
        required
        type="tel"
      />
      <TextInput
        defaultValue={staff?.job_role ?? ''}
        id={`${prefix}-role`}
        label={t('Role (for example, cook or electrician)')}
        maxLength={80}
        name="jobRole"
        required
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-id-type`}
      >
        {t('ID proof type (optional; do not enter a document number)')}
        <select
          className="min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={staff?.id_type ?? ''}
          id={`${prefix}-id-type`}
          name="idType"
        >
          <option value="">{t('Not provided')}</option>
          <option value="aadhaar">{t('Aadhaar')}</option>
          <option value="pan">{t('PAN')}</option>
          <option value="voter_id">{t('Voter ID')}</option>
          <option value="passport">{t('Passport')}</option>
          <option value="other">{t('Other')}</option>
        </select>
      </label>
      <TextInput
        defaultValue={staff?.id_last_four ?? ''}
        id={`${prefix}-id-last-four`}
        label={t('Last four characters only')}
        maxLength={4}
        name="idLastFour"
      />
      <label className="flex min-h-11 items-center gap-space-2 text-body">
        <input
          defaultChecked={staff?.police_verified ?? false}
          name="policeVerified"
          type="checkbox"
        />
        {t('Police verification checked')}
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-status`}
      >
        {t('Society status')}
        <select
          className="min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={staff?.status ?? 'active'}
          id={`${prefix}-status`}
          name="status"
        >
          <option value="active">{t('Active')}</option>
          <option value="blocked">{t('Blocked society-wide')}</option>
        </select>
      </label>
      <StaffPhotoUpload
        initialPath={staff?.photo_path}
        required={!staff?.photo_path}
      />
      <fieldset className="grid gap-space-2">
        <legend className="text-body-strong">
          {t('Linked units (domestic staff)')}
        </legend>
        {units.length ? (
          <div className="grid gap-space-2 sm:grid-cols-2">
            {units.map((unit) => (
              <label
                className="flex min-h-11 items-center gap-space-2 text-body"
                key={unit.id}
              >
                <input
                  defaultChecked={selectedUnits.includes(unit.id)}
                  name="unitIds"
                  type="checkbox"
                  value={unit.id}
                />
                {unit.label}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-caption text-ink-muted">
            {t('Add an active unit before linking domestic staff.')}
          </p>
        )}
      </fieldset>
    </>
  );
}

export function StaffAdminProfileForm({
  staff,
  units,
  action = saveStaffAction,
}: {
  staff?: StaffWorkspaceMember;
  units: readonly StaffUnit[];
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <StaffActionForm
      action={action}
      input={(formData) => {
        const type = String(formData.get('staffType'));
        return {
          staffId: String(formData.get('staffId') || '') || null,
          staffType: type,
          fullName: formData.get('fullName'),
          phone: formData.get('phone'),
          photoPath: formData.get('photoPath') || null,
          idType: formData.get('idType') || null,
          idLastFour: formData.get('idLastFour') || null,
          jobRole: formData.get('jobRole'),
          policeVerified: formData.get('policeVerified') === 'on',
          status: formData.get('status'),
          unitIds:
            type === 'society' ? [] : formData.getAll('unitIds').map(String),
        };
      }}
      submitLabel={staff ? t('Save staff details') : t('Add staff')}
      submitVariant={staff?.status === 'blocked' ? 'destructive' : 'primary'}
    >
      <StaffProfileFields staff={staff} units={units} />
    </StaffActionForm>
  );
}

export function StaffApprovalForm({
  linkId,
  decision,
  label,
  action = reviewStaffRegistrationAction,
}: {
  linkId: string;
  decision: 'active' | 'rejected';
  label: string;
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <StaffActionForm
      action={action}
      className="grid gap-space-2"
      input={() => ({ linkId, decision })}
      submitLabel={label}
      submitVariant={decision === 'rejected' ? 'destructive' : 'secondary'}
    >
      <span className="sr-only">{t('Registration review')}</span>
    </StaffActionForm>
  );
}

export function StaffApprovalSetting({
  residentApprovalRequired,
  action = updateStaffSettingsAction,
}: {
  residentApprovalRequired: boolean;
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <StaffActionForm
      action={action}
      input={(formData) => ({
        residentApprovalRequired: formData.get('approvalRequired') === 'on',
      })}
      submitLabel={t('Save approval setting')}
      submitVariant="secondary"
    >
      <label className="flex min-h-11 items-center gap-space-2 text-body">
        <input
          defaultChecked={residentApprovalRequired}
          name="approvalRequired"
          type="checkbox"
        />
        {t('Require administrator approval for resident registrations')}
      </label>
    </StaffActionForm>
  );
}

export function SocietyStaffShiftForm({
  staffId,
  staffName,
  attendanceDate,
  initialStatus = 'present',
  fixedDate = false,
  action = markSocietyStaffShiftAction,
}: {
  staffId: string;
  staffName: string;
  attendanceDate: string;
  initialStatus?: 'present' | 'absent' | 'leave';
  fixedDate?: boolean;
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const prefix = useId();
  return (
    <StaffActionForm
      action={action}
      className="grid gap-space-2 sm:grid-cols-[1fr_auto]"
      input={(formData) => ({
        staffId,
        attendanceDate: formData.get('attendanceDate'),
        status: formData.get('status'),
      })}
      submitLabel={t('Save {name} attendance', { name: staffName })}
      submitVariant="secondary"
    >
      <label
        className="grid gap-space-1 text-caption"
        htmlFor={`${prefix}-date`}
      >
        {t('Shift date')}
        {fixedDate ? (
          <input name="attendanceDate" type="hidden" value={attendanceDate} />
        ) : null}
        <input
          className="min-h-11 rounded-md border border-rule px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={attendanceDate}
          disabled={fixedDate}
          id={`${prefix}-date`}
          max={fixedDate ? undefined : attendanceDate}
          name={fixedDate ? undefined : 'attendanceDate'}
          required
          type="date"
        />
      </label>
      <label
        className="grid gap-space-1 text-caption"
        htmlFor={`${prefix}-status`}
      >
        {t('Attendance')}
        <select
          className="min-h-11 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={initialStatus}
          id={`${prefix}-status`}
          name="status"
        >
          <option value="present">{t('Present')}</option>
          <option value="absent">{t('Absent')}</option>
          <option value="leave">{t('Leave')}</option>
        </select>
      </label>
    </StaffActionForm>
  );
}

export function SocietyStaffShiftCard({
  staff,
  attendance,
  today,
}: {
  staff: StaffWorkspaceMember;
  attendance: readonly StaffShiftAttendance[];
  today: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <Card
      description={staff.job_role}
      title={`${staff.full_name} · ${t(staff.status === 'blocked' ? 'Blocked' : 'Active')}`}
    >
      <div className="grid gap-space-3">
        {attendance.length ? (
          attendance.map((record) => (
            <SocietyStaffShiftForm
              attendanceDate={record.attendance_date}
              fixedDate
              initialStatus={record.status}
              key={record.attendance_date}
              staffId={staff.id}
              staffName={staff.full_name}
            />
          ))
        ) : (
          <p className="text-caption text-ink-muted">
            {t('No shift attendance is recorded for this month.')}
          </p>
        )}
        {!attendance.some(
          ({ attendance_date }) => attendance_date === today,
        ) ? (
          <SocietyStaffShiftForm
            attendanceDate={today}
            staffId={staff.id}
            staffName={staff.full_name}
          />
        ) : null}
      </div>
    </Card>
  );
}
