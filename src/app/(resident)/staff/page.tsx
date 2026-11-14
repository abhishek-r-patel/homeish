// Show resident-linked staff, registration state and gate attendance history.
import { Avatar, Card } from '@/components/ui/data-display';
import {
  DomesticStaffRegistrationForm,
  UnitStaffDayBlockForm,
} from '@/components/staff/resident-controls';
import { getStaffWorkspace } from '@/core/staff/operations';

export const metadata = {
  title: 'Domestic staff | Homeish',
  robots: { index: false, follow: false },
};

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export default async function ResidentStaffPage() {
  const workspace = await getStaffWorkspace();
  const visibleStaff = workspace.staff.filter(
    ({ staff_type }) => staff_type === 'domestic',
  );
  const pendingLinks = visibleStaff.flatMap((staff) =>
    staff.unit_links
      .filter(({ status }) => status === 'pending')
      .map((link) => ({ staff, link })),
  );
  const activeLinks = visibleStaff.flatMap((staff) =>
    staff.unit_links
      .filter(({ status }) => status === 'active')
      .map((link) => ({ staff, link })),
  );

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Domestic staff</h1>
        <p className="text-body text-ink-muted">
          Register staff for your unit, review gate attendance and block unit
          access for today when needed.
        </p>
      </header>

      <Card
        description="A registration may be routed to an administrator if approval is required or the person matches an existing profile."
        title="Register staff"
      >
        {workspace.units.length ? (
          <DomesticStaffRegistrationForm
            societyId={workspace.societyId}
            units={workspace.units}
          />
        ) : (
          <p className="text-body text-ink-muted">
            No active units are available for your account.
          </p>
        )}
      </Card>

      <Card title="Waiting for administrator review">
        {pendingLinks.length ? (
          <ul className="grid gap-space-3">
            {pendingLinks.map(({ staff, link }) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-4"
                key={link.id}
              >
                <Avatar
                  name={staff.full_name}
                  photoUrl={staff.photoUrl ?? undefined}
                />
                <p className="text-caption text-ink-muted">
                  {staff.job_role} · {link.unit_label}
                </p>
                <p className="text-caption text-warning">
                  Pending approval. Gate access is not available until approved.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            No registrations are waiting for review.
          </p>
        )}
      </Card>

      <Card title="Staff linked to your units">
        {activeLinks.length ? (
          <ul className="grid gap-space-3">
            {activeLinks.map(({ staff, link }) => {
              const attendance = workspace.attendanceByStaffId[staff.id] ?? [];
              return (
                <li
                  className="grid gap-space-3 rounded-md border border-rule p-space-4"
                  key={link.id}
                >
                  <Avatar
                    name={staff.full_name}
                    photoUrl={staff.photoUrl ?? undefined}
                  />
                  <p className="text-caption text-ink-muted">
                    {staff.job_role} · {link.unit_label}
                  </p>
                  {staff.status === 'blocked' ? (
                    <p className="text-caption text-danger">
                      This profile is blocked society-wide.
                    </p>
                  ) : null}
                  {attendance.length ? (
                    <div className="grid gap-space-1">
                      <h2 className="text-body-strong">
                        Gate attendance · {workspace.month.slice(0, 7)}
                      </h2>
                      <ul className="grid gap-space-1">
                        {attendance.map((record) => (
                          <li
                            className="text-caption text-ink-muted"
                            key={record.id}
                          >
                            {record.unit_label} · Entered{' '}
                            {formatTime(
                              record.checked_in_at,
                              workspace.timezone,
                            )}
                            {record.checked_out_at
                              ? ` · Exited ${formatTime(record.checked_out_at, workspace.timezone)}`
                              : ' · Currently inside'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-caption text-ink-muted">
                      No gate attendance is recorded for this month.
                    </p>
                  )}
                  {link.blocked_today ? (
                    <p className="text-caption text-danger" role="status">
                      This staff member is blocked from this unit for today.
                    </p>
                  ) : staff.status === 'active' ? (
                    <UnitStaffDayBlockForm
                      staffId={staff.id}
                      staffName={staff.full_name}
                      unitId={link.unit_id}
                      unitLabel={link.unit_label}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            No staff are linked to your units yet.
          </p>
        )}
      </Card>
    </section>
  );
}
