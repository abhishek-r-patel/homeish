// Exercise staff registration, administration and gate controls with synthetic data.
'use client';

import { useState } from 'react';
import {
  StaffAdminProfileForm,
  StaffApprovalForm,
  StaffApprovalSetting,
  SocietyStaffShiftForm,
  StaffEmploymentChips,
  StaffNotesPanel,
} from '@/components/staff/admin-controls';
import type { StaffFormAction } from '@/components/staff/action-form';
import { GateStaffList } from '@/components/staff/gate-controls';
import { DomesticStaffRegistrationForm } from '@/components/staff/resident-controls';
import { Banner } from '@/components/ui/feedback';
import { publicEnvironment } from '@/core/config/public-env';
import type {
  GateStaffWorkspaceMember,
  StaffWorkspaceMember,
} from '@/core/staff/operations';
import type { StaffNote, StaffUnit } from '@/core/staff/validation';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const residentId = '8a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const unitId = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const staffId = '6a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const linkId = '7a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const attendanceId = '5a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const noteId = '3a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const today = new Date().toISOString().slice(0, 10);
const units: StaffUnit[] = [{ id: unitId, label: 'A · A-101' }];

const societyStaff: StaffWorkspaceMember = {
  id: staffId,
  staff_code: 'AB12CD34EF',
  staff_type: 'society',
  full_name: 'Fixture Society Staff',
  phone: '+911234567890',
  photo_path: `${societyId}/${residentId}/staff/${staffId}.jpg`,
  id_type: 'other',
  id_last_four: '1234',
  job_role: 'Maintenance',
  police_verified: false,
  status: 'active',
  created_by: residentId,
  department: 'Maintenance',
  designation: 'Electrician',
  employment_type: 'permanent',
  joining_date: '2024-04-01',
  weekly_off: 'sunday',
  employment_status: 'on_notice',
  exit_date: null,
  unit_links: [],
  photoUrl: null,
};

const initialNote: StaffNote = {
  id: noteId,
  staff_id: staffId,
  note_date: '2026-11-01',
  category: 'appreciation',
  rating: 4,
  note: 'Fixed the lobby lights quickly.',
  action: null,
  follow_up_date: null,
  status: 'closed',
  recorded_by: 'Fixture Admin',
  created_at: '2026-11-01T10:00:00.000000+00:00',
  updated_at: '2026-11-01T10:00:00.000000+00:00',
  can_edit: true,
};

function readInput(formData: FormData) {
  const value = formData.get('input');
  if (typeof value !== 'string') throw new Error('Missing fixture form input.');
  return JSON.parse(value) as Record<string, unknown>;
}

function fixtureAction(
  message: string,
  handle: (input: Record<string, unknown>) => void = () => {},
): StaffFormAction {
  return async (formData) => {
    handle(readInput(formData));
    return { ok: true, message, data: null };
  };
}

export default function StaffFixturePage() {
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);
  const [inside, setInside] = useState(false);
  const [shiftStatus, setShiftStatus] = useState('not recorded');
  const [employment, setEmployment] = useState('not saved');
  const [notes, setNotes] = useState<StaffNote[]>([initialNote]);

  const gateStaff: GateStaffWorkspaceMember = {
    id: staffId,
    staff_code: 'AB12CD34EF',
    full_name: 'Fixture Domestic Staff',
    photo_path: null,
    job_role: 'Cook',
    status: 'active',
    open_attendance_id: inside ? attendanceId : null,
    blocked_today: false,
    inside,
    photoUrl: null,
  };

  return (
    <main
      className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink"
      data-storage-origin={
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      }
    >
      <Banner title="Synthetic staff fixture" tone="info">
        Development-only in-memory data. Actions are simulated; no staff or
        attendance records are written to a database. Reload to reset.
      </Banner>
      <h1 className="text-title font-semibold">Staff workflows</h1>

      <section aria-label="Resident registration" className="grid gap-space-4">
        <h2 className="text-heading font-semibold">Resident registration</h2>
        <DomesticStaffRegistrationForm
          action={fixtureAction(
            'Staff registration submitted for administrator review.',
            () => setSubmitted(true),
          )}
          societyId={societyId}
          units={units}
        />
      </section>

      {submitted ? (
        <section aria-label="Administrator review" className="grid gap-space-4">
          <h2 className="text-heading font-semibold">Administrator review</h2>
          {approved ? (
            <p role="status">Resident registration approved.</p>
          ) : (
            <StaffApprovalForm
              action={fixtureAction('Registration approved.', () =>
                setApproved(true),
              )}
              decision="active"
              label="Approve unit link"
              linkId={linkId}
            />
          )}
        </section>
      ) : null}

      <section
        aria-label="Administrator management"
        className="grid gap-space-4"
      >
        <h2 className="text-heading font-semibold">Administrator management</h2>
        <StaffEmploymentChips staff={societyStaff} />
        <StaffAdminProfileForm
          action={fixtureAction('Staff profile saved.', (input) =>
            setEmployment(
              `${String(input.employmentStatus)} ${String(input.exitDate)}`,
            ),
          )}
          staff={societyStaff}
          units={units}
        />
        <p role="status">Employment saved: {employment}</p>
        <StaffNotesPanel
          canManage
          deleteAction={fixtureAction('Staff note deleted.', (input) =>
            setNotes((current) =>
              current.filter(({ id }) => id !== input.noteId),
            ),
          )}
          notes={notes}
          saveAction={fixtureAction('Staff note saved.', (input) =>
            setNotes((current) => [
              {
                ...initialNote,
                id: crypto.randomUUID(),
                note: String(input.note),
                category: 'training_needed',
                rating: null,
                status: 'open',
              },
              ...current,
            ]),
          )}
          staffId={staffId}
          staffName={societyStaff.full_name}
          today={today}
        />
        <StaffApprovalSetting
          action={fixtureAction('Approval setting saved.')}
          residentApprovalRequired
        />
        <SocietyStaffShiftForm
          action={fixtureAction('Shift attendance saved.', (input) =>
            setShiftStatus(String(input.status)),
          )}
          attendanceDate={today}
          staffId={staffId}
          staffName={societyStaff.full_name}
        />
        <p role="status">Shift status: {shiftStatus}</p>
      </section>

      <section aria-label="Committee view" className="grid gap-space-4">
        <h2 className="text-heading font-semibold">Committee view</h2>
        <StaffNotesPanel
          canManage={false}
          notes={[{ ...initialNote, can_edit: false }]}
          staffId={staffId}
          staffName="Fixture Gardener"
          today={today}
        />
      </section>

      <section aria-label="Guard gate controls" className="grid gap-space-4">
        <h2 className="text-heading font-semibold">Guard gate controls</h2>
        <GateStaffList
          checkInAction={fixtureAction('Staff entry recorded.', () =>
            setInside(true),
          )}
          checkOutAction={fixtureAction('Staff exit recorded.', () =>
            setInside(false),
          )}
          staff={[{ ...gateStaff, unitId }]}
        />
      </section>
    </main>
  );
}
