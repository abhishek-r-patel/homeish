// Manage staff profiles, resident submissions, registration rules and shifts.
import { Avatar, Card } from '@/components/ui/data-display';
import {
  SocietyStaffShiftCard,
  StaffAdminProfileForm,
  StaffApprovalForm,
  StaffApprovalSetting,
} from '@/components/staff/admin-controls';
import {
  getSocietyStaffAttendance,
  getStaffSettings,
  getStaffWorkspace,
} from '@/core/staff/operations';

export const metadata = {
  title: 'Staff management | Homeish',
  robots: { index: false, follow: false },
};

function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date());
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((value) => value.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) {
    throw new Error('Could not determine today in the society timezone.');
  }
  return `${year}-${month}-${day}`;
}

export default async function AdminStaffPage() {
  const [workspace, settings] = await Promise.all([
    getStaffWorkspace(),
    getStaffSettings(),
  ]);
  const today = localDate(workspace.timezone);
  const [year, month] = today.split('-');
  const monthStart = `${year}-${month}-01`;
  const shifts = await getSocietyStaffAttendance(monthStart);
  const pendingLinks = workspace.staff.flatMap((staff) =>
    staff.unit_links
      .filter(({ status }) => status === 'pending')
      .map((link) => ({ staff, link })),
  );
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Staff management</h1>
        <p className="text-body text-ink-muted">
          Maintain staff profiles, review resident registrations and record
          society staff shifts.
        </p>
      </header>

      <Card
        description="Domestic staff can be linked to one or more units. Society staff are managed at the community level."
        title="Add staff"
      >
        <StaffAdminProfileForm units={workspace.units} />
      </Card>

      <Card title="Resident registration approvals">
        {pendingLinks.length ? (
          <ul className="grid gap-space-3">
            {pendingLinks.map(({ staff, link }) => (
              <li
                className="grid gap-space-3 rounded-md border border-rule p-space-4"
                key={link.id}
              >
                <Avatar
                  name={staff.full_name}
                  photoUrl={staff.photoUrl ?? undefined}
                />
                <p className="text-caption text-ink-muted">
                  {staff.job_role} · {link.unit_label} · {staff.phone}
                </p>
                <p className="text-caption text-ink-muted">
                  {staff.id_type
                    ? `${staff.id_type}, ending ${staff.id_last_four}`
                    : 'No ID proof details submitted'}
                  {staff.police_verified
                    ? ' · Police verification checked'
                    : ''}
                </p>
                <div className="flex flex-wrap gap-space-3">
                  <StaffApprovalForm
                    decision="active"
                    label="Approve unit link"
                    linkId={link.id}
                  />
                  <StaffApprovalForm
                    decision="rejected"
                    label="Reject unit link"
                    linkId={link.id}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            There are no registrations waiting for review.
          </p>
        )}
      </Card>

      <Card title="Staff directory">
        {workspace.staff.length ? (
          <div className="grid gap-space-4">
            {workspace.staff.map((staff) => (
              <details
                className="rounded-md border border-rule p-space-4"
                key={staff.id}
              >
                <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-focus">
                  <span className="inline-flex items-center gap-space-3">
                    <Avatar
                      name={staff.full_name}
                      photoUrl={staff.photoUrl ?? undefined}
                    />
                    <span className="text-caption text-ink-muted">
                      {staff.staff_type === 'society'
                        ? 'Society staff'
                        : 'Domestic staff'}{' '}
                      · {staff.status}
                    </span>
                  </span>
                </summary>
                <div className="mt-space-4 grid gap-space-5">
                  <StaffAdminProfileForm
                    staff={staff}
                    units={workspace.units}
                  />
                  {staff.staff_type === 'society' ? (
                    <SocietyStaffShiftCard
                      attendance={shifts.filter(
                        ({ staff_id }) => staff_id === staff.id,
                      )}
                      staff={staff}
                      today={today}
                    />
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            No staff have been registered yet.
          </p>
        )}
      </Card>

      <Card title="Registration settings">
        <StaffApprovalSetting
          residentApprovalRequired={settings.residentApprovalRequired}
        />
      </Card>
    </section>
  );
}
