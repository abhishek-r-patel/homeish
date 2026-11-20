// Render the staff directory, resident approvals and society shift records.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useId, useState } from 'react';
import { Card } from '@/components/ui/data-display';
import { TextInput } from '@/components/ui/text-input';
import { StaffActionForm, type StaffFormAction } from './action-form';
import { StaffPhotoUpload } from './photo-upload';
import {
  deleteStaffNoteAction,
  markSocietyStaffShiftAction,
  reviewStaffRegistrationAction,
  saveStaffAction,
  saveStaffNoteAction,
  updateStaffSettingsAction,
} from '@/app/(admin)/admin/staff/actions';
import type { StaffWorkspaceMember } from '@/core/staff/operations';
import {
  staffEmploymentStatusSchema,
  type StaffNote,
  type StaffShiftAttendance,
  type StaffUnit,
} from '@/core/staff/validation';

const selectClass =
  'min-h-12 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus';
const dateClass =
  'min-h-12 rounded-md border border-rule px-space-3 focus-visible:outline-2 focus-visible:outline-focus';

const EMPLOYMENT_TYPES = [
  ['permanent', 'Permanent'],
  ['contract', 'Contract'],
  ['daily_wage', 'Daily wage'],
  ['part_time', 'Part time'],
] as const;

const WEEKDAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
] as const;

const NOTE_CATEGORIES = [
  ['training_needed', 'Training needed'],
  ['warning', 'Warning'],
  ['appraisal', 'Appraisal'],
  ['appreciation', 'Appreciation'],
  ['other', 'Other'],
] as const;

function StaffEmploymentFields({ staff }: { staff?: StaffWorkspaceMember }) {
  const { translate: t } = useUiTranslator();
  const prefix = useId();
  const [employmentStatus, setEmploymentStatus] = useState(
    staff?.employment_status ?? 'active',
  );
  return (
    <fieldset className="grid gap-space-3 rounded-md border border-rule p-space-4">
      <legend className="px-space-1 text-body-strong">{t('Employment')}</legend>
      <TextInput
        defaultValue={staff?.department ?? ''}
        id={`${prefix}-department`}
        label={t('Department (optional)')}
        maxLength={80}
        name="department"
      />
      <TextInput
        defaultValue={staff?.designation ?? ''}
        id={`${prefix}-designation`}
        label={t('Designation (optional)')}
        maxLength={80}
        name="designation"
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-employment-type`}
      >
        {t('Employment type')}
        <select
          className={selectClass}
          defaultValue={staff?.employment_type ?? ''}
          id={`${prefix}-employment-type`}
          name="employmentType"
        >
          <option value="">{t('Not set')}</option>
          {EMPLOYMENT_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-joining-date`}
      >
        {t('Joining date (optional)')}
        <input
          className={dateClass}
          defaultValue={staff?.joining_date ?? ''}
          id={`${prefix}-joining-date`}
          name="joiningDate"
          type="date"
        />
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-weekly-off`}
      >
        {t('Weekly off')}
        <select
          className={selectClass}
          defaultValue={staff?.weekly_off ?? ''}
          id={`${prefix}-weekly-off`}
          name="weeklyOff"
        >
          <option value="">{t('Not set')}</option>
          {WEEKDAYS.map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-employment-status`}
      >
        {t('Employment status')}
        <select
          className={selectClass}
          id={`${prefix}-employment-status`}
          name="employmentStatus"
          onChange={(event) => {
            const next = staffEmploymentStatusSchema.safeParse(
              event.target.value,
            );
            if (next.success) setEmploymentStatus(next.data);
          }}
          value={employmentStatus}
        >
          <option value="active">{t('Active')}</option>
          <option value="on_notice">{t('On notice')}</option>
          <option value="left">{t('Left')}</option>
        </select>
      </label>
      {employmentStatus === 'left' ? (
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor={`${prefix}-exit-date`}
        >
          {t('Exit date')}
          <input
            className={dateClass}
            defaultValue={staff?.exit_date ?? ''}
            id={`${prefix}-exit-date`}
            name="exitDate"
            required
            type="date"
          />
        </label>
      ) : null}
    </fieldset>
  );
}

export function StaffEmploymentChips({
  staff,
}: {
  staff: Pick<StaffWorkspaceMember, 'employment_status' | 'staff_type'>;
}) {
  const { translate: t } = useUiTranslator();
  if (staff.staff_type !== 'society' || staff.employment_status === 'active') {
    return null;
  }
  const chipClass =
    'inline-flex min-h-6 items-center rounded-sm px-space-2 text-micro';
  return staff.employment_status === 'on_notice' ? (
    <span className={`${chipClass} bg-warning-tint text-warning`}>
      {t('On notice')}
    </span>
  ) : (
    <>
      <span className={`${chipClass} bg-danger-tint text-danger`}>
        {t('Left')}
      </span>
      <span className={`${chipClass} bg-danger-tint text-danger`}>
        {t('Blocked')}
      </span>
    </>
  );
}

function StaffProfileFields({
  staff,
  units,
}: {
  staff?: StaffWorkspaceMember;
  units: readonly StaffUnit[];
}) {
  const { translate: t } = useUiTranslator();
  const prefix = useId();
  const [staffType, setStaffType] = useState(staff?.staff_type ?? 'domestic');
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
            id={`${prefix}-type`}
            name="staffType"
            onChange={(event) =>
              setStaffType(
                event.target.value === 'society' ? 'society' : 'domestic',
              )
            }
            value={staffType}
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
      {staffType === 'society' ? <StaffEmploymentFields staff={staff} /> : null}
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
          ...(type === 'society'
            ? {
                department: formData.get('department') || null,
                designation: formData.get('designation') || null,
                employmentType: formData.get('employmentType') || null,
                joiningDate: formData.get('joiningDate') || null,
                weeklyOff: formData.get('weeklyOff') || null,
                employmentStatus: formData.get('employmentStatus') ?? 'active',
                exitDate: formData.get('exitDate') || null,
              }
            : {}),
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

function StaffNoteForm({
  staffId,
  note,
  today,
  action = saveStaffNoteAction,
}: {
  staffId: string;
  note?: StaffNote;
  today: string;
  action?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const prefix = useId();
  return (
    <StaffActionForm
      action={action}
      input={(formData) => {
        const rating = String(formData.get('rating') ?? '');
        return {
          noteId: note?.id ?? null,
          staffId,
          noteDate: formData.get('noteDate'),
          category: formData.get('category'),
          rating: rating ? Number(rating) : null,
          note: formData.get('note'),
          action: formData.get('action') || null,
          followUpDate: formData.get('followUpDate') || null,
          status: formData.get('status'),
          expectedUpdatedAt: note?.updated_at ?? null,
        };
      }}
      submitLabel={note ? t('Save note') : t('Add note')}
      submitVariant="secondary"
    >
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-date`}
      >
        {t('Note date')}
        <input
          className={dateClass}
          defaultValue={note?.note_date ?? today}
          id={`${prefix}-date`}
          max={today}
          name="noteDate"
          required
          type="date"
        />
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-category`}
      >
        {t('Category')}
        <select
          className={selectClass}
          defaultValue={note?.category ?? 'appraisal'}
          id={`${prefix}-category`}
          name="category"
        >
          {NOTE_CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-rating`}
      >
        {t('Rating (optional)')}
        <select
          className={selectClass}
          defaultValue={note?.rating ? String(note.rating) : ''}
          id={`${prefix}-rating`}
          name="rating"
        >
          <option value="">{t('No rating')}</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {t('{rating} out of 5', { rating: value })}
            </option>
          ))}
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-note`}
      >
        {t('Note')}
        <textarea
          className="min-h-24 rounded-md border border-rule bg-surface p-space-3 focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={note?.note ?? ''}
          id={`${prefix}-note`}
          maxLength={2000}
          name="note"
          required
        />
      </label>
      <TextInput
        defaultValue={note?.action ?? ''}
        id={`${prefix}-action`}
        label={t('Action (optional)')}
        maxLength={500}
        name="action"
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-follow-up`}
      >
        {t('Follow-up date (optional)')}
        <input
          className={dateClass}
          defaultValue={note?.follow_up_date ?? ''}
          id={`${prefix}-follow-up`}
          name="followUpDate"
          type="date"
        />
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-status`}
      >
        {t('Note status')}
        <select
          className={selectClass}
          defaultValue={note?.status ?? 'open'}
          id={`${prefix}-status`}
          name="status"
        >
          <option value="open">{t('Open')}</option>
          <option value="closed">{t('Closed')}</option>
        </select>
      </label>
    </StaffActionForm>
  );
}

export function StaffNotesPanel({
  staffId,
  staffName,
  notes,
  canManage,
  today,
  saveAction = saveStaffNoteAction,
  deleteAction = deleteStaffNoteAction,
}: {
  staffId: string;
  staffName: string;
  notes: readonly StaffNote[];
  canManage: boolean;
  today: string;
  saveAction?: StaffFormAction;
  deleteAction?: StaffFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const categoryLabel = (value: StaffNote['category']) =>
    t(NOTE_CATEGORIES.find(([key]) => key === value)?.[1] ?? 'Other');
  return (
    <Card title={t('Performance notes for {name}', { name: staffName })}>
      <div className="grid gap-space-4">
        {notes.length ? (
          <ul className="grid gap-space-3">
            {notes.map((note) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={note.id}
              >
                <p className="text-body-strong">
                  {categoryLabel(note.category)} · {note.note_date} ·{' '}
                  {note.status === 'open' ? t('Open') : t('Closed')}
                </p>
                {note.rating ? (
                  <p className="text-caption">
                    {t('{rating} out of 5', { rating: note.rating })}
                  </p>
                ) : null}
                <p className="text-body whitespace-pre-line">{note.note}</p>
                {note.action ? (
                  <p className="text-caption">
                    {t('Action: {action}', { action: note.action })}
                  </p>
                ) : null}
                <p className="text-caption text-ink-muted">
                  {t('Recorded by {name}', { name: note.recorded_by })}
                  {note.follow_up_date
                    ? ` · ${t('Follow up on {date}', { date: note.follow_up_date })}`
                    : ''}
                </p>
                {canManage && note.can_edit ? (
                  <details>
                    <summary className="cursor-pointer rounded-sm text-caption focus-visible:outline-2 focus-visible:outline-focus">
                      {t('Edit note')}
                    </summary>
                    <div className="mt-space-3">
                      <StaffNoteForm
                        action={saveAction}
                        note={note}
                        staffId={staffId}
                        today={today}
                      />
                    </div>
                  </details>
                ) : null}
                {canManage ? (
                  <StaffActionForm
                    action={deleteAction}
                    confirmMessage={t(
                      'Delete this note? This cannot be undone.',
                    )}
                    input={() => ({ noteId: note.id })}
                    submitLabel={t('Delete note')}
                    submitVariant="destructive"
                  >
                    <span className="sr-only">{t('Delete note')}</span>
                  </StaffActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No performance notes yet.')}
          </p>
        )}
        {canManage ? (
          <details>
            <summary className="cursor-pointer rounded-sm text-body-strong focus-visible:outline-2 focus-visible:outline-focus">
              {t('Add a note')}
            </summary>
            <div className="mt-space-3">
              <StaffNoteForm
                action={saveAction}
                staffId={staffId}
                today={today}
              />
            </div>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
