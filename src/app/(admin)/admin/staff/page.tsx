// Manage staff profiles, resident submissions, registration rules and shifts.
import { Avatar, Card } from '@/components/ui/data-display';
import {
  SocietyStaffShiftCard,
  StaffAdminProfileForm,
  StaffApprovalForm,
  StaffApprovalSetting,
  StaffEmploymentChips,
  StaffNotesPanel,
} from '@/components/staff/admin-controls';
import { Banner } from '@/components/ui/feedback';
import {
  getSocietyStaffAttendance,
  getStaffSettings,
  getStaffWorkspace,
} from '@/core/staff/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

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
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const workspace = await getStaffWorkspace();
  const today = localDate(workspace.timezone);
  if (!workspace.canManage) {
    return <CommitteeStaffView today={today} workspace={workspace} />;
  }
  const settings = await getStaffSettings();
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
        <h1 className="text-title font-semibold">{t('Staff management')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Maintain staff profiles, review resident registrations and record society staff shifts.',
          )}
        </p>
      </header>

      <Card
        description={t(
          'Domestic staff can be linked to one or more units. Society staff are managed at the community level.',
        )}
        title={t('Add staff')}
      >
        <StaffAdminProfileForm units={workspace.units} />
      </Card>

      <Card title={t('Resident registration approvals')}>
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
                    : t('No ID proof details submitted')}
                  {staff.police_verified
                    ? ' · Police verification checked'
                    : ''}
                </p>
                <div className="flex flex-wrap gap-space-3">
                  <StaffApprovalForm
                    decision="active"
                    label={t('Approve unit link')}
                    linkId={link.id}
                  />
                  <StaffApprovalForm
                    decision="rejected"
                    label={t('Reject unit link')}
                    linkId={link.id}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('There are no registrations waiting for review.')}
          </p>
        )}
      </Card>

      <Card title={t('Staff directory')}>
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
                        ? t('Society staff')
                        : t('Domestic staff')}{' '}
                      · {staff.status}
                    </span>
                    <StaffEmploymentChips staff={staff} />
                  </span>
                </summary>
                <div className="mt-space-4 grid gap-space-5">
                  <StaffAdminProfileForm
                    staff={staff}
                    units={workspace.units}
                  />
                  {staff.staff_type === 'society' ? (
                    <>
                      <SocietyStaffShiftCard
                        attendance={shifts.filter(
                          ({ staff_id }) => staff_id === staff.id,
                        )}
                        staff={staff}
                        today={today}
                      />
                      <StaffNotesPanel
                        canManage
                        notes={workspace.notesByStaffId[staff.id] ?? []}
                        staffId={staff.id}
                        staffName={staff.full_name}
                        today={today}
                      />
                    </>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No staff have been registered yet.')}
          </p>
        )}
      </Card>

      <Card title={t('Registration settings')}>
        <StaffApprovalSetting
          residentApprovalRequired={settings.residentApprovalRequired}
        />
      </Card>
    </section>
  );
}

async function CommitteeStaffView({
  workspace,
  today,
}: {
  workspace: Awaited<ReturnType<typeof getStaffWorkspace>>;
  today: string;
}) {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const societyStaff = workspace.staff.filter(
    ({ staff_type }) => staff_type === 'society',
  );
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Society staff')}</h1>
        <Banner title={t('View only')} tone="info">
          {t('Committee members can read notes but cannot change them.')}
        </Banner>
      </header>
      {societyStaff.length ? (
        <div className="grid gap-space-4">
          {societyStaff.map((staff) => (
            <details
              className="rounded-md border border-rule p-space-4"
              key={staff.id}
            >
              <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-focus">
                <span className="inline-flex flex-wrap items-center gap-space-3">
                  <Avatar name={staff.full_name} />
                  <span className="text-caption text-ink-muted">
                    {staff.job_role} · {staff.status}
                  </span>
                  <StaffEmploymentChips staff={staff} />
                </span>
              </summary>
              <div className="mt-space-4">
                <StaffNotesPanel
                  canManage={false}
                  notes={workspace.notesByStaffId[staff.id] ?? []}
                  staffId={staff.id}
                  staffName={staff.full_name}
                  today={today}
                />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-body text-ink-muted">
          {t('No society staff have been added yet.')}
        </p>
      )}
    </section>
  );
}
